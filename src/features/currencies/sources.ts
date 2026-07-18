/**
 * FİAT kur kaynakları — TEK KAYNAK (kayıt defteri).
 *
 * Kripto BURADA DEĞİL: üç kaynağın hiçbiri kripto vermiyor. Kripto her zaman
 * CoinGecko'dan gelir ve fiat setinin ÜSTÜNE eklenir (services/rates/index.ts).
 * Yani bu seçim yalnız fiat kurlarını değiştirir; BTC/ETH/USDT cüzdanları
 * kaynaktan bağımsız olarak toplamlarda kalır.
 *
 * Yeni kaynak eklerken 3 yer: burası + services/rates/sources/<key>.ts +
 * src-tauri/capabilities/default.json (http allow-list — eklenmezse istek
 * SESSİZCE başarısız olur).
 */

export const RATE_SOURCE_KEYS = ['frankfurter', 'tcmb', 'open-er-api'] as const
export type RateSourceKey = (typeof RATE_SOURCE_KEYS)[number]

/** Ayar okunamadığında/boşken kullanılan kaynak. */
export const DEFAULT_RATE_SOURCE: RateSourceKey = 'frankfurter'

export function isRateSourceKey(v: unknown): v is RateSourceKey {
  return typeof v === 'string' && (RATE_SOURCE_KEYS as readonly string[]).includes(v)
}

export interface RateSourceMeta {
  key: RateSourceKey
  /** Ayarlarda görünen ad (çeviri değil — marka adı). */
  label: string
  /** i18n anahtarı: kaynağın kısa açıklaması. */
  descKey: string
  /** Kaç fiat para birimi kapsıyor (yaklaşık; UI'da beklenti kurar). */
  currencyCount: number
}

export const RATE_SOURCES: Record<RateSourceKey, RateSourceMeta> = {
  frankfurter: {
    key: 'frankfurter',
    label: 'Frankfurter (ECB)',
    descKey: 'settings.rateSourceFrankfurterDesc',
    currencyCount: 29
  },
  tcmb: {
    key: 'tcmb',
    label: 'TCMB',
    descKey: 'settings.rateSourceTcmbDesc',
    currencyCount: 22
  },
  'open-er-api': {
    key: 'open-er-api',
    label: 'open.er-api.com',
    descKey: 'settings.rateSourceErApiDesc',
    currencyCount: 160
  }
}
