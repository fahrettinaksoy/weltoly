import { addMoney } from '@/shared/lib/money'

/**
 * Etiket dağılımı — TEK KAYNAK (Y-5).
 *
 * Mantık WalletDetailPage.vue içinde yaşıyordu, `tagBreakdown.test.ts` ise onun
 * elle kopyalanmış eşdeğerini test ediyordu. Artık ikisi de buradan import eder.
 *
 * ⚠️ SEZGİYE TERS KURAL — payda dönemin TOPLAM gideridir, etiketlerin toplamı
 * DEĞİL. Bir işlem birden çok etiket taşıyabildiği için etiket toplamları
 * birbiriyle çakışır ve %100'ü AŞAR. Bunu bilmeyen biri "hata var" deyip paydayı
 * etiket toplamına çevirirse bütün yüzdeler sessizce yanlışa döner (ekranda yine
 * makul görünürler). Her çubuk BAĞIMSIZ olarak toplam gidere oranlanır.
 */

export interface TagBreakdownInput { amount: number, tagIds?: string[] }

export interface TagBreakdownRow {
  /** Etiket id'si; etiketsiz satır için '__untagged'. */
  key: string
  value: number
  ratio: number
}

export const UNTAGGED_KEY = '__untagged'

/**
 * @param rows Dönemin gider işlemleri (çağıran zaten süzer).
 * @param total Oranların paydası — dönemin TOPLAM gideri.
 * @param limit En büyük kaç etiket döndürülsün (etiketsiz satır limite dahil değil).
 */
export function buildTagBreakdown(
  rows: TagBreakdownInput[],
  total: number,
  limit = Number.POSITIVE_INFINITY,
): TagBreakdownRow[] {
  const sums = new Map<string, number>()
  let untagged = 0

  for (const r of rows) {
    const ids = r.tagIds ?? []
    if (!ids.length) {
      untagged = addMoney(untagged, r.amount)
      continue
    }
    // Aynı işlem her etiketine TAM tutarla sayılır — çakışma bilinçli.
    for (const id of ids)
      sums.set(id, addMoney(sums.get(id) ?? 0, r.amount))
  }

  const ratio = (v: number) => (total > 0 ? (v / total) * 100 : 0)

  const out: TagBreakdownRow[] = [...sums.entries()]
    .map(([key, value]) => ({ key, value, ratio: ratio(value) }))
    .toSorted((a, b) => b.value - a.value)
    .slice(0, limit)

  // Etiketsiz gider ayrı satır: hiçbir çubukta görünmediği için sessizce
  // kaybolurdu — "etiketlerin toplamı neden tutmuyor" sorusunun cevabı bu.
  if (untagged > 0)
    out.push({ key: UNTAGGED_KEY, value: untagged, ratio: ratio(untagged) })

  return out
}
