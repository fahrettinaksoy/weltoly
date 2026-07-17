import { describe, expect, it } from 'vitest'

import { deriveDbKeyHex, sqlcipherKeyPragma } from './dbKey'

const SALT_A = '00112233445566778899aabbccddeeff'
const SALT_B = 'ffeeddccbbaa99887766554433221100'

describe('dbKey — SQLCipher ham-anahtar türetme', () => {
  it('64 hex karakterlik (32 bayt) anahtar üretir', async () => {
    const key = await deriveDbKeyHex('123456', SALT_A)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('aynı PIN + aynı salt → aynı anahtar (deterministik)', async () => {
    const a = await deriveDbKeyHex('123456', SALT_A)
    const b = await deriveDbKeyHex('123456', SALT_A)
    expect(a).toBe(b)
  })

  it('farklı salt → farklı anahtar (kurulum başına yalıtım)', async () => {
    const a = await deriveDbKeyHex('123456', SALT_A)
    const b = await deriveDbKeyHex('123456', SALT_B)
    expect(a).not.toBe(b)
  })

  it('farklı PIN → farklı anahtar', async () => {
    const a = await deriveDbKeyHex('123456', SALT_A)
    const b = await deriveDbKeyHex('654321', SALT_A)
    expect(a).not.toBe(b)
  })

  it('pragma ham-anahtar (x\'...\') biçiminde üretilir', async () => {
    const key = await deriveDbKeyHex('123456', SALT_A)
    expect(sqlcipherKeyPragma(key)).toBe(`PRAGMA key = "x'${key}'"`)
  })

  it('geçersiz anahtar (64 hex değil) reddedilir — passphrase\'e sessizce düşmez', () => {
    expect(() => sqlcipherKeyPragma('deadbeef')).toThrow()
    expect(() => sqlcipherKeyPragma('z'.repeat(64))).toThrow()
  })
})
