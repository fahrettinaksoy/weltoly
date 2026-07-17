export type CurrencyCode = string

/**
 * Kur haritası: para birimi kodu → 1 temel birim kaç o para eder.
 *
 * Burada bir zod şeması (`ratesSchema` + `z.infer`) vardı; kaldırıldı. Sebebi
 * "kullanılmıyor" değil — `Rates` tipini O üretiyordu. Sebep, şemanın DOĞRULAMA
 * SÖZLEŞMESİ gibi görünüp hiç `.parse` edilmemesiydi: gerçek doğrulama aşağıdaki
 * `sanitizeRates`'te ve şema ondan DAHA GEVŞEKTİ (0, negatif, NaN, Infinity'ye
 * izin verir — hepsi toplamları zehirleyen değerler, Y-2). İki çelişen sözleşmeden
 * yanlış olanı okuyup "kurlar doğrulanıyor" sanmak kolaydı.
 */
export type Rates = Record<string, number>

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
