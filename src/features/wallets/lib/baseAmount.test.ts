import { describe, expect, it } from 'vitest'

import { toBaseAmount } from '@/features/wallets/lib/baseAmount'

/**
 * Y-1 politikasının UI tarafındaki kilidi.
 *
 * getAmountInRate eksik kurda null döndürüyor (testli), ama iki ekran o null'ı
 * `?? 1` ile yutup 1:1 çeviriyordu — politika kaynakta doğru, tüketicide
 * delikti. Bu testler deliği kapalı tutar.
 */
describe('toBaseAmount', () => {
  it('kur varsa çevirir', () => {
    expect(toBaseAmount(100, 2)).toBe(200)
    expect(toBaseAmount(3.15, 1822.37)).toBeCloseTo(5740.47, 2)
  })

  it('kur null ise null döner — 1:1 VARSAYMAZ', () => {
    // Regresyon: `?? 1` geri gelirse burası 3.15 döner ve test kırılır.
    expect(toBaseAmount(3.15, null)).toBeNull()
  })

  it('kur undefined ise null döner', () => {
    expect(toBaseAmount(100, undefined)).toBeNull()
  })

  it('kur 0 ise (geçerli değil ama gelirse) 0 döner, null değil', () => {
    // sanitizeRates 0'ı zaten eler; buraya 0 gelirse matematik dürüst kalsın.
    expect(toBaseAmount(100, 0)).toBe(0)
  })

  it('negatif bakiye (borç) işareti korunur', () => {
    expect(toBaseAmount(-500, 2)).toBe(-1000)
  })
})
