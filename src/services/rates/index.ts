import type { Rates } from '@/features/currencies/types'
import { fetch } from '@tauri-apps/plugin-http'

import { format } from 'date-fns'
import { sanitizeRates } from '@/features/currencies/types'
import { getDb, isTauriRuntime, upsertRow } from '@/services/db'

// Uzak API asılırsa sonsuz beklememek için üst sınır.
const FETCH_TIMEOUT_MS = 10_000

/** AbortController ile timeout'lu fetch. Süre aşımı/ağ hatasında throw eder. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { method: 'GET', signal: ctrl.signal })
  }
  finally {
    clearTimeout(timer)
  }
}

// Fiat: ücretsiz, anahtarsız (USD tabanlı). rates[code] = 1 USD kaç birim.
const FIAT_URL = 'https://open.er-api.com/v6/latest/USD'

// Kripto: CoinGecko simple price (USD). rates[CODE] = 1/price (getAmountInRate ile uyumlu).
const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  XRP: 'ripple',
  SOL: 'solana',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TON: 'the-open-network',
  LTC: 'litecoin',
}
const CRYPTO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_IDS).join(',')}&vs_currencies=usd`

async function fetchFiat(): Promise<Rates | null> {
  try {
    const res = await fetchWithTimeout(FIAT_URL)
    if (!res.ok)
      return null
    const data = await res.json() as { result?: string, rates?: unknown }
    if (data.result !== 'success')
      return null
    // Yanıt tip-cast'le kabul edilmez: sadece sayı/pozitif/sonlu kurları geçir (Y-2).
    const clean = sanitizeRates(data.rates)
    return Object.keys(clean).length ? clean : null
  }
  catch {
    return null
  }
}

/**
 * Kripto kurları. Başarısızlık fiat'ı bloklamaz ama SESSİZ DE KALMAZ.
 *
 * Neden gürültülü: kripto düştüğünde `merged` yalnız fiat taşır, satır yine
 * yazılır ve (aşağıdaki gün kontrolü yüzünden) o gün BİR DAHA denenmez. Yani tek
 * bir 429/timeout tüm günü kurtarılamaz biçimde kriptosuz bırakır. Eskiden bu
 * tümüyle sessizdi (`catch {}` + `if (!res.ok) return out`): kripto kurları
 * günlerce eksik kalabiliyor, kimse fark etmiyordu.
 */
async function fetchCrypto(): Promise<Rates> {
  const out: Rates = {}
  try {
    const res = await fetchWithTimeout(CRYPTO_URL)
    if (!res.ok) {
      console.warn(`[rates] kripto çekilemedi — HTTP ${res.status}. Kripto cüzdanlar bugün toplamlara giremeyecek.`)
      return out
    }
    const data = await res.json() as Record<string, { usd?: unknown }>
    for (const [code, id] of Object.entries(CRYPTO_IDS)) {
      const price = data[id]?.usd
      // Sadece geçerli fiyatları al: 0/negatif/NaN/Infinity → Infinity/NaN kur üretmesin.
      if (typeof price === 'number' && Number.isFinite(price) && price > 0)
        out[code] = 1 / price // 1 USD kaç birim kripto
      else
        console.warn(`[rates] ${code} fiyatı geçersiz/eksik:`, price)
    }
  }
  catch (e) {
    console.warn('[rates] kripto isteği başarısız (ağ/timeout). Kripto cüzdanlar bugün toplamlara giremeyecek.', e)
  }
  return out
}

/** Kayıtlı kur seti kripto taşıyor mu? (Eksikse gün "tamamlanmış" sayılmaz.) */
function hasCryptoRates(raw: unknown): boolean {
  const clean = sanitizeRates(typeof raw === 'string' ? safeParse(raw) : raw)
  return Object.keys(CRYPTO_IDS).some(code => clean[code] !== undefined)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  }
  catch {
    return null
  }
}

/**
 * Günlük fiat + kripto kurlarını çeker, birleştirir ve `rates` tablosuna yazar.
 * Offline'da sessizce başarısız; son kurlar kullanılır.
 *
 * GÜN ATLAMA KURALI: bugünün satırı olsa BİLE, içinde kripto yoksa yeniden
 * denenir. Eskiden yalnız tarihe bakılıyordu; kripto isteği tek seferlik bir
 * 429/timeout ile düşse satır yine yazılıyor ve gün "tamamlandı" sayılıyordu —
 * kurlar o gün BİR DAHA denenmiyordu. Sonuç: kripto cüzdanlar günlerce
 * toplamların dışında kalıyor ve durum kendiliğinden HİÇ düzelmiyordu
 * (gerçek veride 2 gün boyunca böyle kalmış). Fiat zaten yazılı olduğu için
 * yeniden deneme ucuz: en kötü ihtimalle aynı fiat üzerine yazılır.
 */
export async function refreshRates(force = false): Promise<void> {
  if (!isTauriRuntime())
    return

  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    const db = await getDb()
    if (!force) {
      const rows = await db.select<{ date: string, rates: string }[]>(
        'SELECT date, rates FROM rates ORDER BY date DESC LIMIT 1',
      )
      const latest = rows[0]
      if (latest?.date === today && hasCryptoRates(latest.rates))
        return
      if (latest?.date === today)
        console.warn('[rates] bugünün kurlarında kripto eksik — yeniden deneniyor.')
    }

    const fiat = await fetchFiat()
    if (!fiat)
      return // fiat olmadan yazma (kur temeli eksik)

    const crypto = await fetchCrypto()
    const merged: Rates = { ...fiat, ...crypto }

    await upsertRow('rates', today, {
      date: today,
      rates: JSON.stringify(merged),
      source: 'open-er-api+coingecko',
      updatedAt: Date.now(),
    })
  }
  catch (e) {
    console.error('[rates] refresh failed', e)
  }
}
