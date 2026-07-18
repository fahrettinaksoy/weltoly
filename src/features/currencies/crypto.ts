/**
 * Desteklenen kripto paralar — TEK KAYNAK (B-3).
 *
 * Eskiden aynı 10 para İKİ yerde ayrı ayrı yazılıydı: `list.ts` (kod + ad, para
 * birimi seçici için) ve `services/rates/index.ts` (kod → CoinGecko id, fiyat
 * çekmek için). İkisi ELLE senkron tutuluyordu ve ayrışması SESSİZDİ:
 *
 *  - `list.ts`'e eklenip buraya eklenmeyen bir para: kullanıcı onu cüzdan para
 *    birimi olarak SEÇEBİLİR ama kuru hiç çekilmez → cüzdan net değerden sessizce
 *    düşer (Y-1 rozeti "kur eksik" der ama sebebi bulmak imkânsıza yakındır).
 *  - Buraya eklenip `list.ts`'e eklenmeyen: fiyatı boşuna çekilir, kimse seçemez.
 *
 * Artık ikisi de bu listeden TÜRETİLİYOR — ayrışma mümkün değil, test gerekmez.
 *
 * Kripto fiat kaynaklarından AYRI: Frankfurter/TCMB/er-api kripto vermez, bu
 * yüzden fiyatlar her zaman CoinGecko'dan gelir (kullanıcının kaynak seçimi
 * yalnız fiat'ı etkiler).
 */

export interface CryptoInfo {
  /** Cüzdan para birimi kodu (kullanıcıya görünür). */
  code: string
  /** Seçicide gösterilen ad. */
  name: string
  /** CoinGecko `ids` parametresindeki kimlik — kodla AYNI DEĞİL (BTC→bitcoin). */
  coingeckoId: string
}

export const CRYPTO_CURRENCIES: CryptoInfo[] = [
  { code: 'BTC', coingeckoId: 'bitcoin', name: 'Bitcoin' },
  { code: 'ETH', coingeckoId: 'ethereum', name: 'Ethereum' },
  { code: 'USDT', coingeckoId: 'tether', name: 'Tether' },
  { code: 'BNB', coingeckoId: 'binancecoin', name: 'BNB' },
  { code: 'XRP', coingeckoId: 'ripple', name: 'XRP' },
  { code: 'SOL', coingeckoId: 'solana', name: 'Solana' },
  { code: 'ADA', coingeckoId: 'cardano', name: 'Cardano' },
  { code: 'DOGE', coingeckoId: 'dogecoin', name: 'Dogecoin' },
  { code: 'TON', coingeckoId: 'the-open-network', name: 'Toncoin' },
  { code: 'LTC', coingeckoId: 'litecoin', name: 'Litecoin' }
]

/** Para birimi seçici girdileri (`allCurrencies` sonuna eklenir). */
export const cryptoCurrencyOptions = CRYPTO_CURRENCIES.map(({ code, name }) => ({ code, name }))

/** Kod → CoinGecko id. Fiyat çekme ve yanıt eşleme burayı kullanır. */
export const CRYPTO_IDS: Record<string, string> = Object.fromEntries(
  CRYPTO_CURRENCIES.map((c) => [c.code, c.coingeckoId])
)

export const CRYPTO_CODES: string[] = CRYPTO_CURRENCIES.map((c) => c.code)

export function isCryptoCode(code: string): boolean {
  return code in CRYPTO_IDS
}
