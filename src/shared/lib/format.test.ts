import type { FormatOptions } from './format'

import { describe, expect, it } from 'vitest'
import { formatPercent, getNumberSeparators } from './format'

function opts(numberFormat: FormatOptions['numberFormat']): FormatOptions {
  return { numberFormat, dateFormat: 'auto', hideDecimals: false, locale: 'en' }
}

function localeOpts(locale: string): FormatOptions {
  return { numberFormat: 'auto', dateFormat: 'auto', hideDecimals: false, locale }
}

// getNumberSeparators ayraçları Intl'den öğrenir; bu test her sayı biçiminin
// doğru binlik/ondalık çiftini ürettiğini kilitler. Kırılırsa tutar alanı
// yanlış ayraçla giriş alır.
describe('getNumberSeparators', () => {
  it('comma_dot → binlik virgül, ondalık nokta', () => {
    expect(getNumberSeparators(opts('comma_dot'))).toEqual({ group: ',', decimal: '.' })
  })

  it('dot_comma → binlik nokta, ondalık virgül', () => {
    expect(getNumberSeparators(opts('dot_comma'))).toEqual({ group: '.', decimal: ',' })
  })

  it('space_comma → ondalık virgül (binlik bir tür boşluk)', () => {
    // fr-FR binlik için dar bölünmez boşluk (U+202F) kullanabilir; karakteri
    // sabitlemek yerine yalnız ondalığı ve binliğin boşluk-benzeri olduğunu
    // doğrula — gidiş-dönüş aynı karakteri kullandığı sürece tutarlı.
    const { group, decimal } = getNumberSeparators(opts('space_comma'))
    expect(decimal).toBe(',')
    expect(/\s/u.test(group)).toBe(true)
  })

  it('apos_dot → ondalık nokta', () => {
    expect(getNumberSeparators(opts('apos_dot')).decimal).toBe('.')
  })
})

/**
 * O-5: yüzde işaretinin YERİ dile göre değişir. Şablonlarda sabit `%{{ }}`
 * ön eki yazmak en/ru'da yanlıştı ("%42" yerine "42%" olmalı). Bu test o
 * farkı kilitler — sabit ön eke geri dönülürse kırılır.
 */
describe('formatPercent', () => {
  it('tr → işaret ÖNDE', () => {
    expect(formatPercent(42, localeOpts('tr'))).toBe('%42')
  })

  it('en → işaret ARKADA', () => {
    expect(formatPercent(42, localeOpts('en'))).toBe('42%')
  })

  it('ru → işaret arkada (boşluklu)', () => {
    const out = formatPercent(42, localeOpts('ru'))
    expect(out).toMatch(/^42\s*%$/u)
  })

  it('varsayılan 0 ondalık: yuvarlar', () => {
    expect(formatPercent(42.6, localeOpts('en'))).toBe('43%')
  })

  it('istenen ondalığı verir', () => {
    expect(formatPercent(42.55, localeOpts('en'), 1)).toBe('42.6%')
  })

  it('girdi yüzde birimindedir (0-1 oranı DEĞİL)', () => {
    expect(formatPercent(100, localeOpts('en'))).toBe('100%')
  })

  /**
   * Regresyon: işaretin yeri DİLDEN gelir, sayı-biçimi tercihinden değil.
   * Bu testler yokken formatPercent numberLocale() kullanıyordu; kullanıcının
   * biçim tercihi space_comma (→fr-FR) iken Türkçe arayüzde "57 %" (Fransız
   * stili) yazıyordu. Canlı uygulamada görülüp yakalandı — 'auto' dışındaki
   * biçimler test edilmediği için testler yeşil kalmıştı.
   */
  it('sayı biçimi tercihi işaretin YERİNİ değiştirmez — tr her zaman önde', () => {
    for (const nf of ['auto', 'comma_dot', 'dot_comma', 'space_comma', 'apos_dot'] as const)
      expect(formatPercent(57, { numberFormat: nf, dateFormat: 'auto', hideDecimals: false, locale: 'tr' }), nf).toBe('%57')
  })

  it('sayı biçimi tercihi işaretin YERİNİ değiştirmez — en her zaman arkada', () => {
    for (const nf of ['auto', 'comma_dot', 'dot_comma', 'space_comma', 'apos_dot'] as const)
      expect(formatPercent(57, { numberFormat: nf, dateFormat: 'auto', hideDecimals: false, locale: 'en' }), nf).toBe('57%')
  })
})
