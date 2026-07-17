import type { XmlDoc, XmlParse } from './parse'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseErApi, parseFrankfurter, parseTcmb } from './parse'

/**
 * GERÇEK yanıtlarla test edilir (fixtures/, canlı API'den alındı).
 *
 * Neden bu kadar sıkı: kur ayrıştırma hatası SESSİZDİR. Yanlış bir sayı ekranda
 * makul görünür, hiçbir uyarı çıkmaz ve doğrudan net varlığa girer. Bu projede
 * tam olarak bu sınıftan bir hata yaşandı: kripto 1:1 sayılıp net varlık 5 kat
 * düşük gösterildi (bkz. Y-1).
 */

const fixture = (f: string) => readFileSync(join(__dirname, '__fixtures__', f), 'utf8')

/** Test ortamı için minimal XML ayrıştırıcı — DOMParser node'da yok. */
const regexXmlParse: XmlParse = (text): XmlDoc => {
  const date = text.match(/Tarih="([^"]+)"/)?.[1] ?? null
  const currencies = [...text.matchAll(/<Currency[^>]*Kod="([^"]+)"[^>]*>([\s\S]*?)<\/Currency>/g)].map(m => ({
    code: m[1] ?? null,
    unit: m[2]?.match(/<Unit>([^<]*)<\/Unit>/)?.[1] ?? null,
    forexSelling: m[2]?.match(/<ForexSelling>([^<]*)<\/ForexSelling>/)?.[1] ?? null,
  }))
  return { date, currencies }
}

describe('parseFrankfurter', () => {
  const out = parseFrankfurter(fixture('frankfurter.json'))

  it('kaynağın KENDİ kur tarihini alır (bizim çekme günümüzü değil)', () => {
    expect(out.rateDate).toBe('2026-07-16')
  })

  it('uSD tabanını 1 olarak ENJEKTE eder — yanıt onu içermez', () => {
    // Enjekte edilmezse USD cüzdanlar için rates.USD bulunamaz ve
    // getAmountInRate null döner → her şey "kur eksik"e düşerdi.
    expect(out.rates.USD).toBe(1)
  })

  it('kurları olduğu gibi geçirir (zaten USD tabanlı)', () => {
    expect(out.rates.EUR).toBe(0.87207)
    expect(out.rates.TRY).toBe(47.055)
  })

  it('base USD değilse reddeder — matematik tutmaz', () => {
    const r = parseFrankfurter(JSON.stringify({ base: 'EUR', date: '2026-07-16', rates: { USD: 1.15 } }))
    expect(r.rates).toEqual({})
  })

  it('bozuk JSON / boş sözlük güvenli', () => {
    expect(parseFrankfurter('{bozuk').rates).toEqual({})
    expect(parseFrankfurter(JSON.stringify({ base: 'USD', rates: {} })).rates).toEqual({})
  })
})

describe('parseErApi', () => {
  const raw = JSON.stringify({
    result: 'success',
    time_last_update_utc: 'Thu, 16 Jul 2026 00:02:31 +0000',
    rates: { USD: 1, EUR: 0.873, TRY: 47.09, BAD: 0, NEG: -1 },
  })
  const out = parseErApi(raw)

  it('rFC tarihini yyyy-MM-dd yapar', () => {
    expect(out.rateDate).toBe('2026-07-16')
  })

  it('geçersiz kurları eler (0/negatif)', () => {
    expect(out.rates.BAD).toBeUndefined()
    expect(out.rates.NEG).toBeUndefined()
    expect(out.rates.EUR).toBe(0.873)
  })

  it('result success değilse reddeder', () => {
    expect(parseErApi(JSON.stringify({ result: 'error', rates: { EUR: 1 } })).rates).toEqual({})
  })
})

describe('parseTcmb — TRY tabanından USD tabanına', () => {
  const out = parseTcmb(fixture('tcmb.xml'), regexXmlParse)

  it('dd.MM.yyyy tarihini yyyy-MM-dd yapar', () => {
    expect(out.rateDate).toBe('2026-07-16')
  })

  it('uSD tabanı 1, TRY kaynağın USD/TRY satış kuru', () => {
    expect(out.rates.USD).toBe(1)
    expect(out.rates.TRY).toBeCloseTo(47.0517, 4)
  })

  /**
   * En kritik test. TCMB'de JPY `Unit=100`: ForexSelling "100 JPY kaç TRY".
   * Unit'e bölünmezse JPY 100 KAT yanlış çıkar ve bu SESSİZDİR.
   */
  it('unit=100 olan JPY doğru ölçeklenir (100 kat hata yok)', () => {
    // Beklenen ~162 (1 USD ≈ 162 JPY). Unit yok sayılsaydı ~1.62 çıkardı.
    expect(out.rates.JPY).toBeGreaterThan(100)
    expect(out.rates.JPY).toBeLessThan(200)
    expect(out.rates.JPY).toBeCloseTo(161.75, 1)
  })

  it('türetilen kurlar Frankfurter ile örtüşür (bağımsız doğrulama)', () => {
    // İki bağımsız kaynak aynı gerçeği ölçüyor; fark yalnız alış/satış makası.
    const fr = parseFrankfurter(fixture('frankfurter.json')).rates
    for (const code of ['EUR', 'GBP', 'JPY'] as const) {
      const diff = Math.abs(out.rates[code]! - fr[code]!) / fr[code]! * 100
      expect(diff, `${code} sapması`).toBeLessThan(1)
    }
  })

  it('forexSelling boş olan satırı atlar (çökmez)', () => {
    expect(out.rates.XDR).toBeUndefined()
  })

  it('uSD yoksa reddeder — tabana çevrilemez', () => {
    const noUsd = '<Tarih_Date Tarih="16.07.2026"><Currency Kod="EUR"><Unit>1</Unit><ForexSelling>53.95</ForexSelling></Currency></Tarih_Date>'
    expect(parseTcmb(noUsd, regexXmlParse).rates).toEqual({})
  })

  it('ayrıştırıcı hata fırlatırsa güvenli döner', () => {
    const boom: XmlParse = () => {
      throw new Error('bozuk')
    }
    expect(parseTcmb('<x/>', boom).rates).toEqual({})
  })
})
