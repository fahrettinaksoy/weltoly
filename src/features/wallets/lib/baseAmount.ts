/**
 * Cüzdan tutarının TEMEL para birimi karşılığı — TEK KAYNAK.
 *
 * `null` = kur eksik, karşılık BİLİNMİYOR. Çağıran bunu göstermemeli /
 * toplamdan hariç tutmalı; ASLA 1:1 varsaymamalı.
 *
 * Neden ayrı bir fonksiyon: bu kural iki ekranda birden `w.amount * (w.rate ?? 1)`
 * diye elle yazılmıştı ve ikisi de Y-1 politikasını deliyordu — kuru olmayan
 * cüzdan 1:1 çevriliyordu (3,15 ETH "≈ 3,15 $"). Üstelik store'un `totals`'ı o
 * cüzdanı net'ten zaten HARİÇ tutuyordu → aynı veri iki ekranda çelişik
 * görünüyordu ve hiçbir uyarı yoktu. Kural artık tek yerde ve testli.
 */
export function toBaseAmount(amount: number, rate: number | null | undefined): number | null {
  return rate == null ? null : amount * rate
}
