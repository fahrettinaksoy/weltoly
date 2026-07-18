import { describe, expect, it } from 'vitest'

import { parseBackup } from './index'

function envelope(extra: Record<string, unknown>): string {
  return JSON.stringify({ app: 'weltoly', version: 1, exportedAt: 0, ...extra })
}

describe('parseBackup — zarf doğrulama', () => {
  it('geçerli yedeği kabul eder', () => {
    const { rows } = parseBackup(
      envelope({
        wallets: [{ id: 'w1', name: 'Nakit', currency: 'USD' }]
      })
    )
    expect(rows.wallets).toEqual([{ id: 'w1', name: 'Nakit', currency: 'USD' }])
  })

  it('geçersiz JSON reddedilir', () => {
    expect(() => parseBackup('{ not json')).toThrow(/Geçersiz JSON/)
  })

  it('yanlış app etiketi reddedilir', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1 }))).toThrow(
      /Weltoly yedeği değil/
    )
  })

  it('ileri sürüm reddedilir', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'weltoly', version: 99 }))).toThrow(/yeni/)
  })

  it('geçersiz sürüm reddedilir', () => {
    expect(() => parseBackup(JSON.stringify({ app: 'weltoly', version: 0 }))).toThrow(
      /sürümü geçersiz/
    )
  })
})

describe('parseBackup — kolon injection savunması', () => {
  it('bilinmeyen/kötü niyetli kolon adlarını sessizce atar', () => {
    const { rows } = parseBackup(
      envelope({
        wallets: [
          {
            id: 'w1',
            name: 'X',
            'evil"; DROP TABLE wallets;--': 1, // injection denemesi
            notAColumn: 42
          }
        ]
      })
    )
    expect(rows.wallets[0]).toEqual({ id: 'w1', name: 'X' })
    expect(Object.keys(rows.wallets[0])).not.toContain('notAColumn')
  })

  it('id olmayan satır reddedilir', () => {
    expect(() => parseBackup(envelope({ wallets: [{ name: 'X' }] }))).toThrow(/geçerli 'id' yok/)
  })

  it('dizi olmayan tablo reddedilir', () => {
    expect(() => parseBackup(envelope({ wallets: { id: 'w1' } }))).toThrow(/dizi değil/)
  })

  it('bilinmeyen tablolar tümüyle yok sayılır', () => {
    const { rows } = parseBackup(envelope({ secrets: [{ id: 'x' }] }))
    expect(rows.secrets).toBeUndefined()
  })

  it('eksik tablo dokunulmadan bırakılır (undefined)', () => {
    const { rows } = parseBackup(envelope({ wallets: [{ id: 'w1' }] }))
    expect(rows.trns).toBeUndefined()
  })
})
