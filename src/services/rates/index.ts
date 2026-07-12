import { fetch } from '@tauri-apps/plugin-http'
import { format } from 'date-fns'

import { getDb, isTauriRuntime, upsertRow } from '@/services/db'

// Ücretsiz, anahtarsız kur API'si (USD tabanlı). rates[code] = 1 USD kaç birim.
// getAmountInRate formülü tek referansla (USD=1) her base için doğru çevirir.
const RATES_URL = 'https://open.er-api.com/v6/latest/USD'

/**
 * Günlük kurları çeker ve `rates` tablosuna yazar. Aynı gün zaten varsa atlar (force hariç).
 * Offline'da sessizce başarısız olur; son kayıtlı kurlar kullanılmaya devam eder.
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
        return // bugünün kurları zaten var
    }

    const res = await fetch(RATES_URL, { method: 'GET' })
    if (!res.ok)
      return

    const data = await res.json() as { result?: string, rates?: Record<string, number> }
    if (data.result !== 'success' || !data.rates)
      return

    await upsertRow('rates', today, {
      date: today,
      rates: JSON.stringify(data.rates),
      source: 'open-er-api',
      updatedAt: Date.now(),
    })
  }
  catch (e) {
    console.error('[rates] refresh failed', e)
  }
}
