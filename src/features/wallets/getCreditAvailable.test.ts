import { describe, expect, it } from 'vitest'

import { getCreditAvailable } from '@/features/wallets/types'

/**
 * Kredi cüzdanında bakiye borcu NEGATİF taşır (−500 = 500 borç).
 * Hata sessizdir: ekranda yine makul bir rakam çıkar, sadece yanlış.
 */
describe('getCreditAvailable', () => {
  it('borç varken: limit − borç', () => {
    expect(getCreditAvailable(5000, -500)).toBe(4500)
    expect(getCreditAvailable(5000, -5000)).toBe(0)
  })

  it('borç yokken tüm limit kullanılabilir', () => {
    expect(getCreditAvailable(5000, 0)).toBe(5000)
  })

  /**
   * Regresyon: eskiden Math.abs(amount) idi → fazla ödemede (+500) 4500
   * döndürüyordu. Pozitif bakiye borç DEĞİL, alacaktır.
   */
  it('fazla ödemede (pozitif bakiye) limit AZALMAZ', () => {
    expect(getCreditAvailable(5000, 500)).toBe(5000)
  })

  it('limit aşıldıysa negatif döner (aşım görünür kalmalı)', () => {
    expect(getCreditAvailable(5000, -6000)).toBe(-1000)
  })
})
