import { describe, expect, it } from 'vitest'

import { createExpressionString, evaluateExpression, formatInput } from './calculate'

describe('evaluateExpression', () => {
  it('işlem önceliğini uygular', () => {
    expect(evaluateExpression('2+2*3')).toBe(8)
    expect(evaluateExpression('10/2')).toBe(5)
    expect(evaluateExpression('100-40')).toBe(60)
  })

  it('sona takılı operatörü yok sayar', () => {
    expect(evaluateExpression('10+')).toBe(10)
  })

  it('ondalık sonucu döndürür', () => {
    expect(evaluateExpression('1/4')).toBe(0.25)
  })

  it('boş/geçersiz girdide 0 döner', () => {
    expect(evaluateExpression('')).toBe(0)
  })
})

describe('createExpressionString', () => {
  it('rakam ekler', () => {
    expect(createExpressionString('5', '')).toBe('5')
    expect(createExpressionString('3', '12')).toBe('123')
  })

  it('baştaki sıfırı değiştirir', () => {
    expect(createExpressionString('7', '0')).toBe('7')
  })

  it('c geri siler', () => {
    expect(createExpressionString('c', '123')).toBe('12')
    expect(createExpressionString('c', '0')).toBe('0')
  })

  it('operatörü değiştirir', () => {
    expect(createExpressionString('-', '10 + ')).toBe('10-')
  })

  it('= ifadeyi hesaplar', () => {
    expect(createExpressionString('=', '2+2*3')).toBe('8')
  })
})

describe('formatInput', () => {
  it('binlik ayraç ekler', () => {
    expect(formatInput('1234567')).toBe('1 234 567')
  })
})
