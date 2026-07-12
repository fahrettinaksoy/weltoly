/** Tutarı para birimiyle biçimlendirir. Geçersiz/kripto kodlarda güvenli fallback. */
export function formatMoney(amount: number, currency: string, locale = 'tr'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  catch {
    const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)
    return `${n} ${currency}`
  }
}
