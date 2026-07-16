import { describe, expect, it } from 'vitest'

import type { FormatOptions } from './format'
import { getNumberSeparators } from './format'

function opts(numberFormat: FormatOptions['numberFormat']): FormatOptions {
  return { numberFormat, dateFormat: 'auto', hideDecimals: false, locale: 'en' }
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
