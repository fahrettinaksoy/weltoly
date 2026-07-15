import { endOfDay, startOfDay } from 'date-fns'
import { describe, expect, it } from 'vitest'

/**
 * WalletDetailPage'deki işlem süzgeci mantığının aynısı.
 *
 * Neden ayrı test: süzgeç hatası SESSİZDİR — tablo yanlış satırları gösterir,
 * ne build ne typecheck fark eder. Kolay ters çevrilen kurallar:
 * - tarih aralığında BİTİŞ GÜNÜNÜN TAMAMI dahil olmalı (00:00 ile kıyaslamak
 *   o günün işlemlerini eler),
 * - kategori VEYA, etiket ise "en az biri" (işlem çok etiketlidir),
 * - tutar MUTLAK değere bakar (gider negatif),
 * - açıklama araması boşluğa takılmamalı (trim).
 */
type Kind = 'income' | 'expense' | 'transfer' | 'adjustment'
type Row = { date: number, kind: Kind, categoryName: string, desc: string, tagNames: string[], amount: number }
type Filters = {
  dateRange: Date[]
  kinds: Kind[]
  categories: string[]
  desc: string
  tags: string[]
  minAmount: number | null
}

function applyFilters(rows: Row[], f: Filters) {
  return rows.filter((r) => {
    if (f.dateRange.length) {
      const days = f.dateRange.map(d => d.getTime()).toSorted((a, b) => a - b)
      const start = startOfDay(days[0]!).getTime()
      const end = endOfDay(days.at(-1)!).getTime()
      if (r.date < start || r.date > end)
        return false
    }
    if (f.kinds.length && !f.kinds.includes(r.kind))
      return false
    if (f.categories.length && !f.categories.includes(r.categoryName))
      return false
    if (f.desc.trim() && !r.desc.toLocaleLowerCase().includes(f.desc.trim().toLocaleLowerCase()))
      return false
    if (f.tags.length && !r.tagNames.some(n => f.tags.includes(n)))
      return false
    if (f.minAmount !== null && Math.abs(r.amount) < f.minAmount)
      return false
    return true
  })
}

const D = (s: string) => new Date(s).getTime()

const rows: Row[] = [
  { date: D('2026-07-01T09:00'), kind: 'expense', categoryName: 'Market', desc: 'Migros haftalık alışveriş', tagNames: ['Zorunlu', 'Aile'], amount: -450 },
  { date: D('2026-07-15T23:30'), kind: 'expense', categoryName: 'Kafe & Kahve', desc: 'Starbucks', tagNames: ['Keyfi'], amount: -120 },
  { date: D('2026-06-10T12:00'), kind: 'income', categoryName: 'Maaş', desc: 'Haziran maaşı', tagNames: ['İş', 'Aylık'], amount: 68000 },
  { date: D('2026-06-20T08:00'), kind: 'expense', categoryName: 'Market', desc: '', tagNames: [], amount: -1300 },
  { date: D('2026-06-05T10:00'), kind: 'transfer', categoryName: 'Transfer', desc: 'Vadesizden birikime', tagNames: [], amount: -5000 },
  { date: D('2026-06-01T00:00'), kind: 'adjustment', categoryName: 'Düzeltme', desc: 'Açılış bakiyesi', tagNames: [], amount: 12000 },
]
const none: Filters = { dateRange: [], kinds: [], categories: [], desc: '', tags: [], minAmount: null }

describe('işlem süzgeçleri', () => {
  it('süzgeç yoksa hepsi geçer', () => {
    expect(applyFilters(rows, none)).toHaveLength(6)
  })

  it('tarih aralığı: sınırlar dahil', () => {
    const r = applyFilters(rows, { ...none, dateRange: [new Date('2026-07-01'), new Date('2026-07-15')] })
    expect(r.map(x => x.categoryName)).toEqual(['Market', 'Kafe & Kahve'])
  })

  it('BİTİŞ gününün tamamı dahil (23:30 elenmemeli)', () => {
    // endOfDay kullanılmasaydı 15 Tem 23:30 kaydı elenirdi.
    const r = applyFilters(rows, { ...none, dateRange: [new Date('2026-07-15'), new Date('2026-07-15')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryName).toBe('Kafe & Kahve')
  })

  it('BAŞLANGIÇ gününün tamamı dahil (09:00 elenmemeli)', () => {
    const r = applyFilters(rows, { ...none, dateRange: [new Date('2026-07-01'), new Date('2026-07-02')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryName).toBe('Market')
  })

  it('tek tarih (seçim sürerken): o günü süzer', () => {
    const r = applyFilters(rows, { ...none, dateRange: [new Date('2026-06-10')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryName).toBe('Maaş')
  })

  it('aralık ters sırada verilse de çalışır (sıralanır)', () => {
    const r = applyFilters(rows, { ...none, dateRange: [new Date('2026-07-15'), new Date('2026-07-01')] })
    expect(r).toHaveLength(2)
  })

  it('kategori: seçilenlerden biri olmalı (VEYA)', () => {
    expect(applyFilters(rows, { ...none, categories: ['Market', 'Maaş'] })).toHaveLength(3)
  })

  it('etiket: satır seçilenlerden EN AZ BİRİNİ taşımalı', () => {
    expect(applyFilters(rows, { ...none, tags: ['Aile', 'Keyfi'] })).toHaveLength(2)
  })

  it('etiket süzgeci etiketsiz satırı ELER', () => {
    const r = applyFilters(rows, { ...none, tags: ['Zorunlu'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.tagNames).toContain('Zorunlu')
  })

  it('tutar: MUTLAK değere göre — gider negatif diye elenmemeli', () => {
    const r = applyFilters(rows, { ...none, minAmount: 5000 })
    expect(r.map(x => x.amount).toSorted((a, b) => a - b)).toEqual([-5000, 12000, 68000])
  })

  it('minAmount 0: sıfır geçerli bir sınır, null ile karıştırılmamalı', () => {
    // 0 falsy'dir; `if (f.minAmount)` yazılsaydı süzgeç sessizce kapanırdı.
    expect(applyFilters(rows, { ...none, minAmount: 0 })).toHaveLength(6)
  })

  it('tür: seçilenlerden biri olmalı (VEYA)', () => {
    const r = applyFilters(rows, { ...none, kinds: ['transfer', 'adjustment'] })
    expect(r.map(x => x.kind)).toEqual(['transfer', 'adjustment'])
  })

  it('tür GİDER, tutarı negatif olan her satır DEĞİLDİR', () => {
    // Transfer de düzeltme de negatif olabilir; tür işaretten okunamaz — sütunun
    // varlık sebebi bu. Gider süzgeci transferi ELEMELİ.
    const r = applyFilters(rows, { ...none, kinds: ['expense'] })
    expect(r).toHaveLength(3)
    expect(r.map(x => x.categoryName)).not.toContain('Transfer')
  })

  it('tür GELİR, düzeltmeyi KAPSAMAZ (açılış bakiyesi gelir değil)', () => {
    // trn.type'tan okunsaydı düzeltme "Gelir" görünür, üstteki gelir toplamıyla
    // çelişirdi (flow düzeltmeyi hariç tutuyor).
    const r = applyFilters(rows, { ...none, kinds: ['income'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryName).toBe('Maaş')
  })

  it('açıklama: parça eşleşmesi, büyük/küçük harf duyarsız', () => {
    const r = applyFilters(rows, { ...none, desc: 'MIGROS' })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryName).toBe('Market')
  })

  it('açıklama araması açıklamasız satırı ELER', () => {
    const r = applyFilters(rows, { ...none, desc: 'a' })
    expect(r.every(x => x.desc !== '')).toBe(true)
  })

  it('açıklama YALNIZ boşluksa süzgeç sayılmaz', () => {
    // trim yoksa hiçbir açıklama " " içermediği için tablo tamamen boşalırdı.
    expect(applyFilters(rows, { ...none, desc: '   ' })).toHaveLength(6)
  })

  it('açıklama: baştaki/sondaki boşluk kırpılır', () => {
    expect(applyFilters(rows, { ...none, desc: '  starbucks ' })).toHaveLength(1)
  })

  it('süzgeçler VE\'lenir: her biri ayrı daraltma', () => {
    const r = applyFilters(rows, {
      ...none,
      dateRange: [new Date('2026-06-01'), new Date('2026-06-30')],
      categories: ['Market'],
    })
    expect(r).toHaveLength(1)
    expect(r[0]!.amount).toBe(-1300)
  })
})
