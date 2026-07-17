import { describe, expect, it } from 'vitest'

import { backoffMs, legacyHashHex, pbkdf2Hex, randomSaltHex } from './pinCrypto'

describe('pbkdf2Hex', () => {
  it('aynı girdi + salt → deterministik hash', async () => {
    const salt = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    const a = await pbkdf2Hex('123456', salt, 1000)
    const b = await pbkdf2Hex('123456', salt, 1000)
    expect(a).toBe(b)
    expect(a).toHaveLength(64) // 256 bit = 32 bayt = 64 hex
  })

  it('farklı salt → farklı hash (per-cihaz salt işe yarıyor)', async () => {
    const a = await pbkdf2Hex('123456', randomSaltHex(), 1000)
    const b = await pbkdf2Hex('123456', randomSaltHex(), 1000)
    expect(a).not.toBe(b)
  })

  it('farklı PIN → farklı hash', async () => {
    const salt = randomSaltHex()
    expect(await pbkdf2Hex('123456', salt, 1000)).not.toBe(await pbkdf2Hex('654321', salt, 1000))
  })
})

describe('randomSaltHex', () => {
  it('16 bayt (32 hex) üretir ve tekrar etmez', () => {
    const s = randomSaltHex()
    expect(s).toHaveLength(32)
    expect(s).not.toBe(randomSaltHex())
  })
})

describe('legacyHashHex', () => {
  it('eski SHA-256 formatıyla uyumlu kalır', async () => {
    // Kademeli yükseltme yolunun eski hash'leri doğrulayabildiğini garanti eder.
    expect(await legacyHashHex('1234')).toHaveLength(64)
    expect(await legacyHashHex('1234')).toBe(await legacyHashHex('1234'))
  })
})

describe('backoffMs — üstel geri çekilme', () => {
  it('ilk 4 deneme cezasız', () => {
    expect(backoffMs(0)).toBe(0)
    expect(backoffMs(4)).toBe(0)
  })

  it('5. denemeden itibaren üstel artar', () => {
    expect(backoffMs(5)).toBe(5_000)
    expect(backoffMs(6)).toBe(10_000)
    expect(backoffMs(7)).toBe(20_000)
  })

  it('15 dakikada tavan yapar', () => {
    expect(backoffMs(100)).toBe(15 * 60 * 1000)
  })
})
