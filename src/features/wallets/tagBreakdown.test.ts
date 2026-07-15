import { describe, expect, it } from 'vitest'

/**
 * WalletDetailPage'deki etiket dağılımının aynı mantığı.
 *
 * Neden ayrı test: buradaki asıl kural sezgiye TERS — etiket çoklu seçim olduğu
 * için toplamlar birbiriyle çakışır ve %100'ü aşar. Bunu bilmeyen biri "hata
 * var" deyip payda'yı etiket toplamına çevirebilir; o an bütün yüzdeler sessizce
 * yanlışa döner (ekranda yine makul görünürler).
 */
type Row = { amount: number, tagIds?: string[] }

function tagBreakdown(rows: Row[]) {
  const sums = new Map<string, number>()
  let untagged = 0
  let total = 0
  for (const r of rows) {
    total += r.amount
    const ids = r.tagIds ?? []
    if (!ids.length) {
      untagged += r.amount
      continue
    }
    for (const id of ids)
      sums.set(id, (sums.get(id) ?? 0) + r.amount)
  }
  const out = [...sums.entries()]
    .map(([key, value]) => ({ key, value, ratio: total > 0 ? (value / total) * 100 : 0 }))
    .toSorted((a, b) => b.value - a.value)
  if (untagged > 0)
    out.push({ key: '__untagged', value: untagged, ratio: total > 0 ? (untagged / total) * 100 : 0 })
  return { rows: out, total }
}

const rows: Row[] = [
  { amount: 1000, tagIds: ['zorunlu', 'aile'] },
  { amount: 500, tagIds: ['zorunlu'] },
  { amount: 300, tagIds: ['keyfi', 'kisisel'] },
  { amount: 200 }, // etiketsiz
]

describe('etiket dağılımı', () => {
  it('bir işlem TAŞIDIĞI HER etikete tam tutarıyla sayılır', () => {
    const { rows: r } = tagBreakdown(rows)
    // 1000'lik işlem hem zorunlu'ya hem aile'ye TAM yazılır, bölünmez.
    expect(r.find(x => x.key === 'zorunlu')!.value).toBe(1500)
    expect(r.find(x => x.key === 'aile')!.value).toBe(1000)
  })

  it('etiket toplamları toplam gideri AŞAR — bu doğru davranış', () => {
    const { rows: r, total } = tagBreakdown(rows)
    const etiketToplami = r.filter(x => x.key !== '__untagged').reduce((s, x) => s + x.value, 0)
    expect(total).toBe(2000)
    // zorunlu 1500 + aile 1000 + keyfi 300 + kişisel 300 = 3100, yani giderin %155'i.
    expect(etiketToplami).toBe(3100)
    expect(etiketToplami).toBeGreaterThan(total)
  })

  it('oranların paydası TOPLAM GİDER, etiket toplamı değil', () => {
    // Payda etiket toplamı (2800) olsaydı zorunlu %54 çıkardı — yanlış.
    // Doğrusu 1500/2000 = %75.
    const { rows: r } = tagBreakdown(rows)
    expect(r.find(x => x.key === 'zorunlu')!.ratio).toBe(75)
  })

  it('oranların toplamı %100 ETMEZ — pasta bu yüzden kullanılamaz', () => {
    const { rows: r } = tagBreakdown(rows)
    const toplam = r.reduce((s, x) => s + x.ratio, 0)
    // %155 (etiketler) + %10 (etiketsiz) = %165.
    expect(Math.round(toplam)).toBe(165)
  })

  it('hiçbir oran %100\'ü geçmez', () => {
    const { rows: r } = tagBreakdown(rows)
    for (const x of r)
      expect(x.ratio, x.key).toBeLessThanOrEqual(100)
  })

  it('etiketsiz gider ayrı satır olur — sessizce kaybolmaz', () => {
    const { rows: r } = tagBreakdown(rows)
    const u = r.find(x => x.key === '__untagged')!
    expect(u.value).toBe(200)
    expect(u.ratio).toBe(10)
  })

  it('etiketsiz gider yoksa satır da yok', () => {
    const { rows: r } = tagBreakdown([{ amount: 100, tagIds: ['zorunlu'] }])
    expect(r.some(x => x.key === '__untagged')).toBe(false)
  })

  it('gider yoksa sıfıra bölme olmaz', () => {
    const { rows: r } = tagBreakdown([])
    expect(r).toEqual([])
  })
})
