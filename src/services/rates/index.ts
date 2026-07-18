import type { RateSourceKey } from '@/features/currencies/sources'
import type { Rates } from '@/features/currencies/types'
import type { ParsedRates } from '@/services/rates/sources/parse'
import { fetch } from '@tauri-apps/plugin-http'
import { format } from 'date-fns'

import { CRYPTO_IDS } from '@/features/currencies/crypto'
import { DEFAULT_RATE_SOURCE, isRateSourceKey } from '@/features/currencies/sources'
import { sanitizeRates } from '@/features/currencies/types'
import { getDb, isTauriRuntime, upsertRow } from '@/services/db'
import {
  domXmlParse,
  parseErApi,
  parseFrankfurter,
  parseTcmb
} from '@/services/rates/sources/parse'
import { logger } from '@/shared/lib/logger'

// Uzak API asılırsa sonsuz beklememek için üst sınır.
const FETCH_TIMEOUT_MS = 10_000

/** AbortController ile timeout'lu fetch. Süre aşımı/ağ hatasında throw eder. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { method: 'GET', signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * FİAT kaynakları: url + saf ayrıştırıcı. Üçü de anahtarsız.
 * Hepsi aynı sözleşmeye normalize eder: rates[KOD] = 1 USD kaç birim KOD.
 * Yeni kaynak eklerken capabilities/default.json http allow-list'i de güncelle —
 * yoksa istek SESSİZCE başarısız olur.
 */
const FIAT_SOURCES: Record<RateSourceKey, { url: string; parse: (text: string) => ParsedRates }> = {
  frankfurter: {
    url: 'https://api.frankfurter.dev/v1/latest?base=USD',
    parse: parseFrankfurter
  },
  tcmb: {
    url: 'https://www.tcmb.gov.tr/kurlar/today.xml',
    parse: (text) => parseTcmb(text, domXmlParse)
  },
  'open-er-api': {
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: parseErApi
  }
}

// Kripto: CoinGecko simple price (USD). rates[CODE] = 1/price (getAmountInRate ile uyumlu).
const CRYPTO_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_IDS).join(',')}&vs_currencies=usd`

/**
 * Seçili kaynaktan fiat kurları. Ayrıştırma SAF (sources/parse.ts, testli);
 * burada yalnız ağ + hata yüzeyi var.
 *
 * `res.text()` kullanılır, `res.json()` DEĞİL: TCMB XML döner. Her ayrıştırıcı
 * kendi biçimini bilir.
 */
async function fetchFiat(source: RateSourceKey): Promise<ParsedRates | null> {
  const { url, parse } = FIAT_SOURCES[source]
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) {
      logger.warn(`[rates] fiat çekilemedi (${source}) — HTTP ${res.status}`)
      return null
    }
    const out = parse(await res.text())
    if (!Object.keys(out.rates).length) {
      logger.warn(`[rates] fiat yanıtı ayrıştırılamadı/boş (${source})`)
      return null
    }
    return out
  } catch (e) {
    logger.warn(`[rates] fiat isteği başarısız (${source})`, e)
    return null
  }
}

/**
 * Seçili kaynağı DB'den DOĞRUDAN okur — Pinia'dan değil.
 *
 * Neden: `initUserSettings` watch'ı asenkron dolar ve ilk `run()` await
 * edilmiyor; açılışta `refreshRates` store'a sorsaydı ayar henüz gelmemiş olur,
 * sessizce varsayılan kaynaktan çekerdi. DB tek gerçek kaynak.
 */
async function readRateSource(): Promise<RateSourceKey> {
  try {
    const db = await getDb()
    const rows = await db.select<{ rateSource: string | null }[]>(
      'SELECT rateSource FROM user_settings LIMIT 1'
    )
    const v = rows[0]?.rateSource
    return isRateSourceKey(v) ? v : DEFAULT_RATE_SOURCE
  } catch {
    return DEFAULT_RATE_SOURCE
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
      logger.warn(
        `[rates] kripto çekilemedi — HTTP ${res.status}. Kripto cüzdanlar bugün toplamlara giremeyecek.`
      )
      return out
    }
    const data = (await res.json()) as Record<string, { usd?: unknown }>
    for (const [code, id] of Object.entries(CRYPTO_IDS)) {
      const price = data[id]?.usd
      // Sadece geçerli fiyatları al: 0/negatif/NaN/Infinity → Infinity/NaN kur üretmesin.
      if (typeof price === 'number' && Number.isFinite(price) && price > 0)
        out[code] = 1 / price // 1 USD kaç birim kripto
      else logger.warn(`[rates] ${code} fiyatı geçersiz/eksik:`, price)
    }
  } catch (e) {
    logger.warn(
      '[rates] kripto isteği başarısız (ağ/timeout). Kripto cüzdanlar bugün toplamlara giremeyecek.',
      e
    )
  }
  return out
}

/** Kayıtlı kur seti kripto taşıyor mu? (Eksikse gün "tamamlanmış" sayılmaz.) */
function hasCryptoRates(raw: unknown): boolean {
  const clean = sanitizeRates(typeof raw === 'string' ? safeParse(raw) : raw)
  return Object.keys(CRYPTO_IDS).some((code) => clean[code] !== undefined)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/**
 * Günlük fiat + kripto kurlarını çeker, birleştirir ve `rates` tablosuna yazar.
 * Offline'da sessizce başarısız; son kurlar kullanılır.
 *
 * GÜN ATLAMA KURALI — bugünün satırı varsa bile şu üç durumda YENİDEN çekilir:
 *  1. `force` (kullanıcı "Şimdi yenile" dedi),
 *  2. kayıtlı satır BAŞKA bir kaynaktan (kullanıcı kaynağı değiştirdi),
 *  3. kripto eksik.
 *
 * (3) neden var: kripto isteği tek seferlik bir 429/timeout ile düşse satır yine
 * yazılıyor ve gün "tamamlandı" sayılıyordu — kurlar o gün BİR DAHA
 * denenmiyordu. Sonuç: kripto cüzdanlar günlerce toplamların dışında kalıyor,
 * durum kendiliğinden HİÇ düzelmiyordu (gerçek veride 2 gün böyle kalmış).
 *
 * Gün başına TEK satır tutulur (id = tarih). Kaynak değişince satır üzerine
 * yazılır — aynı gün için iki kaynağın kuru saklanmaz; "şu an geçerli kur seti"
 * tek olmalı, yoksa hangisinin okunacağı belirsizleşir.
 *
 * DÖNÜŞ: çağıranın sonucu BİLMESİ gerekir. Önce UI, başarıyı "store'daki
 * updatedAt değişti mi" diye anlamaya çalışıyordu; ama store `watchTable`
 * üzerinden 30ms throttle ile ASENKRON doluyor → `await nextTick()` yetmiyor ve
 * BAŞARILI çekimde bile "çekilemedi" hatası basılıyordu (yanlış negatif).
 * Sonucu buradan döndürmek yarışı tümden ortadan kaldırır.
 */
export type RefreshResult = 'ok' | 'skipped' | 'error'

export async function refreshRates(force = false): Promise<RefreshResult> {
  if (!isTauriRuntime()) return 'skipped'

  const today = format(new Date(), 'yyyy-MM-dd')
  const source = await readRateSource()

  try {
    const db = await getDb()
    if (!force) {
      const rows = await db.select<{ date: string; rates: string; source: string | null }[]>(
        'SELECT date, rates, source FROM rates ORDER BY date DESC LIMIT 1'
      )
      const latest = rows[0]
      if (latest?.date === today) {
        if (latest.source !== sourceTag(source))
          logger.warn(
            `[rates] kaynak değişti (${latest.source} → ${sourceTag(source)}) — yeniden çekiliyor.`
          )
        else if (!hasCryptoRates(latest.rates))
          logger.warn('[rates] bugünün kurlarında kripto eksik — yeniden deneniyor.')
        else return 'skipped' // aynı gün, aynı kaynak, kripto tam → iş yok
      }
    }

    const fiat = await fetchFiat(source)
    if (!fiat) return 'error' // fiat olmadan yazma (kur temeli eksik)

    // Kripto fiat'ın ÜSTÜNE: USDT gibi bir kod iki kaynakta da varsa CoinGecko
    // kazanır (piyasa fiyatı, fiat listesindeki sabit değil).
    const crypto = await fetchCrypto()
    const merged: Rates = { ...fiat.rates, ...crypto }

    await upsertRow('rates', today, {
      date: today,
      rateDate: fiat.rateDate, // KAYNAĞIN kur tarihi — bizim çekme günümüz değil
      rates: JSON.stringify(merged),
      source: sourceTag(source),
      updatedAt: Date.now()
    })
    return 'ok'
  } catch (e) {
    logger.error('[rates] refresh failed', e)
    return 'error'
  }
}

/** Satıra yazılan kaynak etiketi. Kripto her zaman CoinGecko'dan geldiği için birleşik. */
function sourceTag(source: RateSourceKey): string {
  return `${source}+coingecko`
}
