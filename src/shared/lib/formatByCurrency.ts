/** Binlik ayraç ekler ("1234567" → "1 234 567"). */
export function formatByCurrency(value: string, separator: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}
