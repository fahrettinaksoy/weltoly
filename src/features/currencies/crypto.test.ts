import { describe, expect, it } from 'vitest'
import {
  CRYPTO_CODES,
  CRYPTO_CURRENCIES,
  CRYPTO_IDS,
  cryptoCurrencyOptions,
  isCryptoCode
} from './crypto'
import { allCurrencies } from './list'

// B-3 sonrası kripto TEK KAYNAKTAN türetiliyor, bu yüzden "iki liste aynı mı"
// testine gerek yok — türetme bunu garanti eder. Burada test edilenler, türetmenin
// GARANTİ ETMEDİĞİ şeyler: liste içi çakışmalar ve fiat listesiyle etkileşim.

describe('kripto tek kaynağı', () => {
  it('kod tekrarı yok', () => {
    // Tekrar olsaydı Object.fromEntries sessizce sonuncuyu kazandırır, önceki
    // paranın CoinGecko id'si kaybolur → o para hiç fiyatlanmaz.
    expect(new Set(CRYPTO_CODES).size).toBe(CRYPTO_CODES.length)
  })

  it('aynı CoinGecko id iki paraya verilmemiş', () => {
    // İki kod aynı id'ye bakarsa ikisi de AYNI fiyatı alır — sessizce yanlış
    // net değer (ör. ETH'ye bitcoin fiyatı).
    const ids = CRYPTO_CURRENCIES.map((c) => c.coingeckoId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("her paranın kodu, adı ve id'si dolu", () => {
    for (const c of CRYPTO_CURRENCIES) {
      expect(c.code, `kod boş: ${JSON.stringify(c)}`).toBeTruthy()
      expect(c.name, `ad boş: ${c.code}`).toBeTruthy()
      expect(c.coingeckoId, `coingeckoId boş: ${c.code}`).toBeTruthy()
    }
  })

  it('kod ile CoinGecko id karıştırılmamış', () => {
    // Klasik hata: coingeckoId'ye 'BTC' yazmak. CoinGecko id'leri küçük harf
    // slug'dır; kodla aynıysa neredeyse kesin yanlıştır ve istek sessizce o
    // parayı atlar (404 değil, eksik alan döner).
    for (const c of CRYPTO_CURRENCIES)
      expect(c.coingeckoId, `${c.code}: coingeckoId kod ile aynı`).not.toBe(c.code)
  })

  it('her kodun bir CoinGecko id eşlemesi var', () => {
    expect(Object.keys(CRYPTO_IDS).toSorted()).toEqual(CRYPTO_CODES.toSorted())
  })

  it('isCryptoCode doğru ayırıyor', () => {
    expect(isCryptoCode('BTC')).toBe(true)
    expect(isCryptoCode('USD')).toBe(false)
    expect(isCryptoCode('')).toBe(false)
  })
})

describe('para birimi listesiyle bütünlük', () => {
  it('her kripto seçicide görünüyor', () => {
    // Görünmezse kullanıcı o cüzdanı hiç oluşturamaz ama fiyatı boşuna çekilir.
    const codes = new Set(allCurrencies.map((c) => c.code))
    for (const code of CRYPTO_CODES)
      expect(codes.has(code), `${code} allCurrencies'te yok`).toBe(true)
  })

  it('kripto kodu bir fiat koduyla çakışmıyor', () => {
    // ASIL RİSK: türetme bunu engellemez. Bir kripto kodu ISO 4217 koduyla
    // çakışsaydı seçicide iki kez görünür ve kur eşlemesi hangisinin kastedildiğini
    // bilemezdi — sessizce yanlış dönüşüm.
    const seen = new Set<string>()
    const dupes = allCurrencies
      .map((c) => c.code)
      .filter((code) => {
        if (seen.has(code)) return true
        seen.add(code)
        return false
      })
    expect(dupes).toEqual([])
  })

  it('seçici girdileri kaynakla aynı sırada ve içerikte', () => {
    expect(cryptoCurrencyOptions).toEqual(
      CRYPTO_CURRENCIES.map(({ code, name }) => ({ code, name }))
    )
  })
})
