import type { TagBreakdownInput } from '@/features/wallets/lib/tagBreakdown'

import { describe, expect, it } from 'vitest'
import { buildTagBreakdown, UNTAGGED_KEY } from '@/features/wallets/lib/tagBreakdown'
import { sumMoney } from '@/shared/lib/money'

/**
 * ÜRETİM etiket-dağılımı modülünü test eder (Y-5).
 *
 * Eskiden bu dosya WalletDetailPage.vue içindeki mantığın ELLE KOPYALANMIŞ
 * eşdeğerini test ediyordu — kopyalar ayrışsa test yeşil kalır, çubuklar sessizce
 * yanlış oran gösterirdi. Artık sayfa da test de aynı modülü import ediyor.
 *
 * Neden bu kurallar kilitli: asıl kural sezgiye TERS — etiket çoklu seçim olduğu
 * için toplamlar birbiriyle çakışır ve %100'ü aşar. Bunu bilmeyen biri "hata var"
 * deyip paydayı etiket toplamına çevirebilir; o an bütün yüzdeler sessizce
 * yanlışa döner (ekranda yine makul görünürler).
 */

const rows: TagBreakdownInput[] = [
  { amount: 1000, tagIds: ['zorunlu', 'aile'] },
  { amount: 500, tagIds: ['zorunlu'] },
  { amount: 300, tagIds: ['keyfi', 'kisisel'] },
  { amount: 200 } // etiketsiz
]

/** Payda: dönemin TOPLAM gideri (sayfada periodExpenseTotal ile aynı anlam). */
const total = sumMoney(rows.map((r) => r.amount))
const breakdown = (rs: TagBreakdownInput[] = rows, t = total) => buildTagBreakdown(rs, t)

describe('etiket dağılımı', () => {
  it('bir işlem TAŞIDIĞI HER etikete tam tutarıyla sayılır', () => {
    const r = breakdown()
    // 1000'lik işlem hem zorunlu'ya hem aile'ye TAM yazılır, bölünmez.
    expect(r.find((x) => x.key === 'zorunlu')!.value).toBe(1500)
    expect(r.find((x) => x.key === 'aile')!.value).toBe(1000)
  })

  it('etiket toplamları toplam gideri AŞAR — bu doğru davranış', () => {
    const r = breakdown()
    const etiketToplami = r.filter((x) => x.key !== UNTAGGED_KEY).reduce((s, x) => s + x.value, 0)
    expect(total).toBe(2000)
    // zorunlu 1500 + aile 1000 + keyfi 300 + kişisel 300 = 3100, yani giderin %155'i.
    expect(etiketToplami).toBe(3100)
    expect(etiketToplami).toBeGreaterThan(total)
  })

  it('oranların paydası TOPLAM GİDER, etiket toplamı değil', () => {
    // Payda etiket toplamı olsaydı zorunlu %54 çıkardı — yanlış.
    // Doğrusu 1500/2000 = %75.
    expect(breakdown().find((x) => x.key === 'zorunlu')!.ratio).toBe(75)
  })

  it('oranların toplamı %100 ETMEZ — pasta bu yüzden kullanılamaz', () => {
    const toplam = breakdown().reduce((s, x) => s + x.ratio, 0)
    // %155 (etiketler) + %10 (etiketsiz) = %165.
    expect(Math.round(toplam)).toBe(165)
  })

  it("hiçbir oran %100'ü geçmez", () => {
    for (const x of breakdown()) expect(x.ratio, x.key).toBeLessThanOrEqual(100)
  })

  it('etiketsiz gider ayrı satır olur — sessizce kaybolmaz', () => {
    const u = breakdown().find((x) => x.key === UNTAGGED_KEY)!
    expect(u.value).toBe(200)
    expect(u.ratio).toBe(10)
  })

  it('etiketsiz gider yoksa satır da yok', () => {
    const r = breakdown([{ amount: 100, tagIds: ['zorunlu'] }], 100)
    expect(r.some((x) => x.key === UNTAGGED_KEY)).toBe(false)
  })

  it('gider yoksa sıfıra bölme olmaz', () => {
    expect(breakdown([], 0)).toEqual([])
  })

  it('limit uygulanır ama etiketsiz satır limitin dışındadır', () => {
    const r = buildTagBreakdown(rows, total, 2)
    const tagRows = r.filter((x) => x.key !== UNTAGGED_KEY)
    expect(tagRows).toHaveLength(2) // en büyük iki etiket
    expect(tagRows.map((x) => x.key)).toEqual(['zorunlu', 'aile'])
    expect(r.some((x) => x.key === UNTAGGED_KEY)).toBe(true)
  })
})
