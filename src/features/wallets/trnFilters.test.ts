import type { TrnFilterRow, TrnFilters } from '@/features/trns/lib/trnFilters'

import { describe, expect, it } from 'vitest'
import { applyTrnFilters, emptyTrnFilters } from '@/features/trns/lib/trnFilters'

/**
 * ÜRETİM işlem-süzgeci modülünü test eder (Y-5).
 *
 * Eskiden bu dosya kendi `applyFilters` KOPYASINI test ediyordu; aynı mantık
 * ayrıca WalletDetailPage ve TransactionsPage içinde de kopyalıydı. Üç kopyadan
 * biri kaysa test yeşil kalırdı — süzgeç hatası SESSİZDİR: tablo yanlış satırları
 * gösterir, ne build ne typecheck fark eder. Artık tek kaynak:
 * features/trns/lib/trnFilters.ts.
 *
 * Kilitlenen kurallar:
 * - tarih aralığında BİTİŞ GÜNÜNÜN TAMAMI dahil (00:00 ile kıyaslamak eler),
 * - kategori VEYA, etiket "en az biri" (işlem çok etiketlidir),
 * - kategori/etiket ID ile eşleşir, ADLA DEĞİL (O-6),
 * - tutar MUTLAK değere bakar (gider negatif),
 * - açıklama araması boşluğa takılmamalı (trim).
 */

const D = (s: string) => new Date(s).getTime()

const rows: TrnFilterRow[] = [
  { date: D('2026-07-01T09:00'), kind: 'expense', categoryId: 'c-market', desc: 'Migros haftalık alışveriş', tagIds: ['t-zorunlu', 't-aile'], amount: -450 },
  { date: D('2026-07-15T23:30'), kind: 'expense', categoryId: 'c-kafe', desc: 'Starbucks', tagIds: ['t-keyfi'], amount: -120 },
  { date: D('2026-06-10T12:00'), kind: 'income', categoryId: 'c-maas', desc: 'Haziran maaşı', tagIds: ['t-is', 't-aylik'], amount: 68000 },
  { date: D('2026-06-20T08:00'), kind: 'expense', categoryId: 'c-market', desc: '', tagIds: [], amount: -1300 },
  { date: D('2026-06-05T10:00'), kind: 'transfer', categoryId: 'transfer', desc: 'Vadesizden birikime', tagIds: [], amount: -5000 },
  { date: D('2026-06-01T00:00'), kind: 'adjustment', categoryId: 'adjustment', desc: 'Açılış bakiyesi', tagIds: [], amount: 12000 },
]

const none: TrnFilters = emptyTrnFilters()
const apply = (f: Partial<TrnFilters> = {}) => applyTrnFilters(rows, { ...none, ...f })

describe('işlem süzgeçleri', () => {
  it('süzgeç yoksa hepsi geçer', () => {
    expect(apply()).toHaveLength(6)
  })

  it('tarih aralığı: sınırlar dahil', () => {
    const r = apply({ dateRange: [new Date('2026-07-01'), new Date('2026-07-15')] })
    expect(r.map(x => x.categoryId)).toEqual(['c-market', 'c-kafe'])
  })

  it('bİTİŞ gününün tamamı dahil (23:30 elenmemeli)', () => {
    // endOfDay kullanılmasaydı 15 Tem 23:30 kaydı elenirdi.
    const r = apply({ dateRange: [new Date('2026-07-15'), new Date('2026-07-15')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryId).toBe('c-kafe')
  })

  it('bAŞLANGIÇ gününün tamamı dahil (09:00 elenmemeli)', () => {
    const r = apply({ dateRange: [new Date('2026-07-01'), new Date('2026-07-02')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryId).toBe('c-market')
  })

  it('tek tarih (seçim sürerken): o günü süzer', () => {
    const r = apply({ dateRange: [new Date('2026-06-10')] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryId).toBe('c-maas')
  })

  it('aralık ters sırada verilse de çalışır (sıralanır)', () => {
    expect(apply({ dateRange: [new Date('2026-07-15'), new Date('2026-07-01')] })).toHaveLength(2)
  })

  it('kategori: seçilenlerden biri olmalı (VEYA)', () => {
    expect(apply({ categoryIds: ['c-market', 'c-maas'] })).toHaveLength(3)
  })

  /**
   * O-6 regresyonu: ad değil ID eşleşmeli. Aynı ada sahip iki kategori olduğunda
   * ada göre süzmek ötekini de getiriyordu — hata sessiz, kullanıcı istemediği
   * satırları görüyordu.
   */
  it('kategori ID ile süzülür, ADLA değil — ad çakışması yanlış satır getirmez', () => {
    const dupRows: TrnFilterRow[] = [
      { date: D('2026-07-01T09:00'), kind: 'expense', categoryId: 'c-diger-market', desc: 'A', tagIds: [], amount: -10 },
      { date: D('2026-07-02T09:00'), kind: 'expense', categoryId: 'c-diger-fatura', desc: 'B', tagIds: [], amount: -20 },
    ]
    // İki kategorinin de görünen adı "Diğer" olsa bile id'leri ayrı → yalnız biri gelir.
    const r = applyTrnFilters(dupRows, { ...none, categoryIds: ['c-diger-market'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.desc).toBe('A')
  })

  it('etiket ID ile süzülür, ADLA değil', () => {
    const dupRows: TrnFilterRow[] = [
      { date: D('2026-07-01T09:00'), kind: 'expense', categoryId: 'c1', desc: 'A', tagIds: ['t-acil-is'], amount: -10 },
      { date: D('2026-07-02T09:00'), kind: 'expense', categoryId: 'c1', desc: 'B', tagIds: ['t-acil-ev'], amount: -20 },
    ]
    const r = applyTrnFilters(dupRows, { ...none, tagIds: ['t-acil-is'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.desc).toBe('A')
  })

  it('etiket: satır seçilenlerden EN AZ BİRİNİ taşımalı', () => {
    expect(apply({ tagIds: ['t-aile', 't-keyfi'] })).toHaveLength(2)
  })

  it('etiket süzgeci etiketsiz satırı ELER', () => {
    const r = apply({ tagIds: ['t-zorunlu'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.tagIds).toContain('t-zorunlu')
  })

  it('tutar: MUTLAK değere göre — gider negatif diye elenmemeli', () => {
    const r = apply({ minAmount: 5000 })
    expect(r.map(x => x.amount).toSorted((a, b) => a - b)).toEqual([-5000, 12000, 68000])
  })

  it('minAmount 0: sıfır geçerli bir sınır, null ile karıştırılmamalı', () => {
    // 0 falsy'dir; `if (f.minAmount)` yazılsaydı süzgeç sessizce kapanırdı.
    expect(apply({ minAmount: 0 })).toHaveLength(6)
  })

  it('tür: seçilenlerden biri olmalı (VEYA)', () => {
    const r = apply({ kinds: ['transfer', 'adjustment'] })
    expect(r.map(x => x.kind)).toEqual(['transfer', 'adjustment'])
  })

  it('tür GİDER, tutarı negatif olan her satır DEĞİLDİR', () => {
    // Transfer de düzeltme de negatif olabilir; tür işaretten okunamaz — sütunun
    // varlık sebebi bu. Gider süzgeci transferi ELEMELİ.
    const r = apply({ kinds: ['expense'] })
    expect(r).toHaveLength(3)
    expect(r.map(x => x.categoryId)).not.toContain('transfer')
  })

  it('tür GELİR, düzeltmeyi KAPSAMAZ (açılış bakiyesi gelir değil)', () => {
    // trn.type'tan okunsaydı düzeltme "Gelir" görünür, üstteki gelir toplamıyla
    // çelişirdi (flow düzeltmeyi hariç tutuyor).
    const r = apply({ kinds: ['income'] })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryId).toBe('c-maas')
  })

  it('açıklama: parça eşleşmesi, büyük/küçük harf duyarsız', () => {
    const r = apply({ desc: 'MIGROS' })
    expect(r).toHaveLength(1)
    expect(r[0]!.categoryId).toBe('c-market')
  })

  it('açıklama araması açıklamasız satırı ELER', () => {
    expect(apply({ desc: 'a' }).every(x => x.desc !== '')).toBe(true)
  })

  it('açıklama YALNIZ boşluksa süzgeç sayılmaz', () => {
    // trim yoksa hiçbir açıklama " " içermediği için tablo tamamen boşalırdı.
    expect(apply({ desc: '   ' })).toHaveLength(6)
  })

  it('açıklama: baştaki/sondaki boşluk kırpılır', () => {
    expect(apply({ desc: '  starbucks ' })).toHaveLength(1)
  })

  it('süzgeçler VE\'lenir: her biri ayrı daraltma', () => {
    const r = apply({
      dateRange: [new Date('2026-06-01'), new Date('2026-06-30')],
      categoryIds: ['c-market'],
    })
    expect(r).toHaveLength(1)
    expect(r[0]!.amount).toBe(-1300)
  })

  it('girdi dizisini mutasyona uğratmaz', () => {
    const snapshot = [...rows]
    apply({ kinds: ['expense'] })
    expect(rows).toEqual(snapshot)
  })
})
