import { z } from 'zod'

export type CurrencyCode = string

export const ratesSchema = z.record(z.string(), z.number())

export type Rates = z.infer<typeof ratesSchema>

/**
 * Güvenilmeyen kur nesnesini (uzak API/DB) temizler: yalnızca değeri sayı,
 * SONLU ve POZİTİF olan kodları geçirir. 0/negatif/NaN/Infinity/null değerler
 * atılır — aksi halde çoklu-para toplamları Infinity/NaN'la zehirlenir (Y-2).
 */
export function sanitizeRates(input: unknown): Rates {
  const out: Rates = {}
  if (!input || typeof input !== 'object')
    return out
  for (const [code, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0)
      out[code] = value
  }
  return out
}
