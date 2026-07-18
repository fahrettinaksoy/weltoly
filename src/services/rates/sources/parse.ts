import type { Rates } from '@/features/currencies/types'
import { sanitizeRates } from '@/features/currencies/types'

/**
 * Kur kaynağı yanıtlarını uygulamanın SÖZLEŞMESİNE çeviren SAF ayrıştırıcılar.
 *
 * SÖZLEŞME: `rates[KOD] = 1 USD kaç birim KOD`. USD tabanlıdır ve `rates.USD`
 * her zaman 1'dir. Kripto (CoinGecko, `1/price`) aynı sözleşmeyi paylaştığı için
 * fiat ile tek homojen sözlükte yaşayabilir ve getAmountInRate ayrım yapmadan
 * çalışır.
 *
 * Ağ YOK: bu modül metin alır, sözlük döndürür → gerçek yanıtlarla test edilebilir.
 */

export interface ParsedRates {
  /** USD tabanlı, temizlenmiş kur sözlüğü (rates.USD === 1). */
  rates: Rates
  /**
   * KAYNAĞIN kendi kur tarihi (yyyy-MM-dd). Bizim çekme günümüzle AYNI DEĞİL:
   * ECB/TCMB iş günü sonunda yayımlar, hafta sonu güncellenmez. Güncellik
   * ekranı "kur ne zamanın" sorusunu bu alandan yanıtlar; `updatedAt` yalnız
   * "biz ne zaman çektik"i söyler. null = kaynak tarih vermiyor.
   */
  rateDate: string | null
}

const EMPTY: ParsedRates = { rates: {}, rateDate: null }

/**
 * Frankfurter (ECB) — `?base=USD` ile zaten USD tabanlı gelir.
 * Örnek: `{"base":"USD","date":"2026-07-16","rates":{"EUR":0.87207, ...}}`
 *
 * DİKKAT: yanıt TABANI kendi sözlüğüne KOYMAZ (base=USD iken `rates.USD` yok).
 * Enjekte edilmezse `getAmountInRate` USD cüzdanlar için `rates.USD`'yi
 * bulamaz, null döner ve HER ŞEY "kur eksik"e düşerdi.
 */
export function parseFrankfurter(text: string): ParsedRates {
  let d: { base?: unknown; date?: unknown; rates?: unknown }
  try {
    d = JSON.parse(text)
  } catch {
    return EMPTY
  }
  if (d.base !== 'USD') return EMPTY // base=USD istedik; başka bir şey geldiyse matematik tutmaz

  const rates = sanitizeRates(d.rates)
  if (!Object.keys(rates).length) return EMPTY

  rates.USD = 1 // taban her zaman 1 — kaynak vermez
  return { rates, rateDate: typeof d.date === 'string' ? d.date : null }
}

/**
 * open.er-api.com — USD tabanlı, `rates.USD` yanıtta ZATEN var.
 * Örnek: `{"result":"success","time_last_update_utc":"...","rates":{...}}`
 */
export function parseErApi(text: string): ParsedRates {
  let d: { result?: unknown; rates?: unknown; time_last_update_utc?: unknown }
  try {
    d = JSON.parse(text)
  } catch {
    return EMPTY
  }
  if (d.result !== 'success') return EMPTY

  const rates = sanitizeRates(d.rates)
  if (!Object.keys(rates).length) return EMPTY

  rates.USD = 1 // gelmiş olsa da sabitle: taban tanım gereği 1
  return { rates, rateDate: erApiDate(d.time_last_update_utc) }
}

/** "Tue, 16 Jul 2026 00:02:31 +0000" → "2026-07-16". Ayrıştırılamazsa null. */
function erApiDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10)
}

/**
 * TCMB today.xml — TRY tabanlı, XML. İki tuzak var:
 *
 * 1. `<Unit>` HER ZAMAN 1 DEĞİL. JPY için 100'dür: `<ForexSelling>` "100 JPY kaç
 *    TRY" demektir. Unit'e bölmezsen JPY 100 KAT yanlış çıkar — ve bu sessizdir,
 *    ekranda makul bir sayı görünür.
 * 2. TRY listede YOKTUR (kaynağın tabanı odur) → elle eklenir.
 *
 * Dönüşüm: 1 X = ForexSelling_X / Unit_X TRY olduğundan
 *   rates[X] = usdTry / (ForexSelling_X / Unit_X)      (1 USD kaç birim X)
 *   rates[TRY] = usdTry,  rates[USD] = 1
 * Oranlar aynı birimden (TRY) türediği için TCMB'nin alış/satış makası
 * sadeleşir; tutarlılık için baştan sona ForexSelling kullanılır.
 *
 * Doğrulandı: bu formülle türetilen kurlar Frankfurter ile %0.0–0.5 arasında
 * örtüşüyor (EUR %0.00, JPY %0.28) — fark TCMB satış kuru ile ECB orta kuru
 * arasındaki makastır, beklenen.
 *
 * @param text ham XML
 * @param parseXml Ortam bağımsızlığı için enjekte edilir: tarayıcıda DOMParser,
 *                 testte node XML ayrıştırıcısı. Bu modül saf kalsın diye.
 */
export function parseTcmb(text: string, parseXml: XmlParse): ParsedRates {
  let doc: XmlDoc
  try {
    doc = parseXml(text)
  } catch {
    return EMPTY
  }

  const raw = new Map<string, number>() // KOD -> 1 birim KOD kaç TRY
  for (const c of doc.currencies) {
    const sell = Number.parseFloat(c.forexSelling ?? '')
    const unit = Number.parseFloat(c.unit ?? '')
    // Bazı satırlarda ForexSelling boştur (yalnız efektif kuru olanlar) → atla.
    if (!c.code || !Number.isFinite(sell) || !Number.isFinite(unit) || unit <= 0 || sell <= 0)
      continue
    raw.set(c.code, sell / unit)
  }

  const usdTry = raw.get('USD')
  if (!usdTry)
    // USD olmadan USD tabanına çeviremeyiz
    return EMPTY

  const out: Rates = { USD: 1, TRY: usdTry }
  for (const [code, tryPerUnit] of raw) {
    if (code === 'USD') continue
    out[code] = usdTry / tryPerUnit
  }

  return { rates: sanitizeRates(out), rateDate: tcmbDate(doc.date) }
}

/** TCMB `Tarih="16.07.2026"` (dd.MM.yyyy) → "2026-07-16". */
function tcmbDate(v: string | null): string | null {
  const m = v?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// --- XML soyutlaması (ortamdan bağımsız) ------------------------------------

export interface XmlCurrency {
  code: string | null
  unit: string | null
  forexSelling: string | null
}
export interface XmlDoc {
  date: string | null
  currencies: XmlCurrency[]
}
export type XmlParse = (text: string) => XmlDoc

/** Tarayıcı/WebView ayrıştırıcısı (DOMParser). Testler kendi parser'ını verir. */
export const domXmlParse: XmlParse = (text) => {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('TCMB XML ayrıştırılamadı')
  return {
    date: doc.documentElement?.getAttribute('Tarih') ?? null,
    currencies: [...doc.querySelectorAll('Currency')].map((el) => ({
      code: el.getAttribute('Kod'),
      unit: el.querySelector('Unit')?.textContent ?? null,
      forexSelling: el.querySelector('ForexSelling')?.textContent ?? null
    }))
  }
}
