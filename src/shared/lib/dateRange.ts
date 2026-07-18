/**
 * Tarih aralığının okunur metni.
 *
 * Tek gün (başlangıç = bitiş, ya da tek elemanlı dizi) → TEK tarih. Aksi halde
 * "başlangıç - bitiş". Neden ayrı: VDateInput range modunda metni SABİT
 * `${başlangıç} - ${bitiş}` üretiyor ve tek gün seçilince tarihi iki kez
 * yazıyordu; DateRangeField bu fonksiyonla kendi metnini kurar.
 *
 * `format` çağrı yerinden gelir (useFormat().date) — biçim uygulama ayarına bağlı.
 */
export function dateRangeText(dates: Date[], format: (d: Date) => string): string {
  if (!dates.length) return ''
  const start = format(dates[0]!)
  const end = format(dates[dates.length - 1]!)
  return start === end ? start : `${start} - ${end}`
}
