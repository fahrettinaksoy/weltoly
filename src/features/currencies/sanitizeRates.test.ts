import { describe, expect, it } from 'vitest'

import { sanitizeRates } from './types'

describe('sanitizeRates — Y-2 kur doğrulama', () => {
  it('geçerli pozitif sonlu kurları geçirir', () => {
    expect(sanitizeRates({ USD: 1, EUR: 0.9, TRY: 32.5 })).toEqual({ USD: 1, EUR: 0.9, TRY: 32.5 })
  })

  it('0/negatif/NaN/Infinity kurları atar', () => {
    expect(
      sanitizeRates({ USD: 1, A: 0, B: -1, C: Number.NaN, D: Number.POSITIVE_INFINITY })
    ).toEqual({ USD: 1 })
  })

  it('sayı olmayan değerleri atar', () => {
    expect(sanitizeRates({ USD: 1, X: '2' as unknown, Y: null, Z: undefined })).toEqual({ USD: 1 })
  })

  it('nesne olmayan girdide boş döner', () => {
    expect(sanitizeRates(null)).toEqual({})
    expect(sanitizeRates('x')).toEqual({})
    expect(sanitizeRates(42)).toEqual({})
  })
})
