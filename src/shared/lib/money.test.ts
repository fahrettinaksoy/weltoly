import { describe, expect, it } from 'vitest'

import { addMoney, MONEY_SCALE, roundMoney, subMoney, sumMoney } from './money'

describe('addMoney / subMoney — float birikmesini önler', () => {
  it('0.1 + 0.2 = 0.3 (ham float 0.30000000000000004)', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3)
  })

  it('0.3 - 0.1 = 0.2', () => {
    expect(subMoney(0.3, 0.1)).toBe(0.2)
  })

  it('üst üste toplama tail biriktirmez', () => {
    let acc = 0
    for (let i = 0; i < 1000; i++) acc = addMoney(acc, 0.1)
    expect(acc).toBe(100)
  })
})

describe('sumMoney — tamsayı minor-unit toplama', () => {
  it('0.1 üç kez = 0.3', () => {
    expect(sumMoney([0.1, 0.1, 0.1])).toBe(0.3)
  })

  it('geçersiz (NaN/Infinity) değerleri yok sayar', () => {
    expect(sumMoney([1, Number.NaN, 2, Number.POSITIVE_INFINITY])).toBe(3)
  })

  it('kripto ondalığını (8 hane) korur', () => {
    expect(sumMoney([0.00000001, 0.00000002])).toBe(0.00000003)
  })
})

describe('roundMoney', () => {
  it('varsayılan 8 ondalığa yuvarlar', () => {
    expect(MONEY_SCALE).toBe(8)
    expect(roundMoney(1.123456789)).toBe(1.12345679)
  })

  it('istenen ondalığa yuvarlar', () => {
    expect(roundMoney(1.005, 2)).toBe(1.01)
    expect(roundMoney(2.675, 2)).toBe(2.68) // ham float 2.67'ye düşerdi
  })

  it('sonsuz/NaN için 0', () => {
    expect(roundMoney(Number.NaN)).toBe(0)
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
