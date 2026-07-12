import { fetch } from '@tauri-apps/plugin-http'
import { format } from 'date-fns'

import { getDb, isTauriRuntime, upsertRow } from '@/services/db'
import type { Rates } from '@/features/currencies/types'

// Fiat: ücretsiz, anahtarsız (USD tabanlı). rates[code] = 1 USD kaç birim.
const FIAT_URL = 'https://open.er-api.com/v6/latest/USD'

// Kripto: CoinGecko simple price (USD). rates[CODE] = 1/price (getAmountInRate ile uyumlu).
const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', BNB: 'binancecoin', XRP: 'ripple',
  SOL: 'solana', ADA: 'cardano', DOGE: 'dogecoin', TON: 'the-open-network', LTC: 'litecoin',
}
const CRYPTO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_IDS).join(',')}&vs_currencies=usd`

async function fetchFiat(): Promise<Rates | null> {
  try {
    const res = await fetch(FIAT_URL, { method: 'GET' })
    if (!res.ok)
      return null
    const data = await res.json() as { result?: string, rates?: Rates }
    return data.result === 'success' && data.rates ? data.rates : null
  }
  catch {
    return null
  }
}

async function fetchCrypto(): Promise<Rates> {
  const out: Rates = {}
  try {
    const res = await fetch(CRYPTO_URL, { method: 'GET' })
    if (!res.ok)
      return out
    const data = await res.json() as Record<string, { usd?: number }>
    for (const [code, id] of Object.entries(CRYPTO_IDS)) {
      const price = data[id]?.usd
      if (price && price > 0)
        out[code] = 1 / price // 1 USD kaç birim kripto
    }
  }
  catch { /* kripto başarısızsa fiat yeterli */ }
  return out
}

/**
 * Günlük fiat + kripto kurlarını çeker, birleştirir ve `rates` tablosuna yazar.
 * Aynı gün zaten varsa atlar. Offline'da sessizce başarısız; son kurlar kullanılır.
 */
export async function refreshRates(force = false): Promise<void> {
  if (!isTauriRuntime())
    return

  const today = format(new Date(), 'yyyy-MM-dd')

  try {
    const db = await getDb()
    if (!force) {
      const rows = await db.select<{ date: string }[]>('SELECT date FROM rates ORDER BY date DESC LIMIT 1')
      if (rows[0]?.date === today)
        return
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
