import { describe, expect, it, vi } from 'vitest'

import { keyboardRowProps } from './rowA11y'

/**
 * A-4 kilidi: satır klavyeyle etkinleşebilmeli. Regresyon sessiz olurdu —
 * fare hâlâ çalıştığı için kimse fark etmez, yalnız klavye kullanıcısı
 * işlemlerini düzenleyemez hale gelir.
 */

interface Row {
  id: string
}
const row: Row = { id: 't1' }

/** `<tr>`'nin kendisi odaktayken gelen olay. */
function keyEvent(key: string, selfTarget = true) {
  const el = {} as EventTarget
  return {
    key,
    target: selfTarget ? el : ({} as EventTarget),
    currentTarget: el,
    preventDefault: vi.fn()
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> }
}

describe('keyboardRowProps', () => {
  it('satırı odaklanabilir yapar', () => {
    const props = keyboardRowProps<Row>(() => {})({ item: row })
    expect(props.tabindex).toBe(0)
  })

  it('role EZMEZ — <tr> tablo yapısında kalmalı', () => {
    // role="button" verilseydi ekran okuyucu satır/sütun bağlamını kaybederdi.
    const props = keyboardRowProps<Row>(() => {})({ item: row }) as Record<string, unknown>
    expect(props.role).toBeUndefined()
    expect(props['aria-label']).toBeUndefined()
  })

  it('enter satırı etkinleştirir', () => {
    const activate = vi.fn()
    const e = keyEvent('Enter')
    keyboardRowProps(activate)({ item: row }).onKeydown(e)
    expect(activate).toHaveBeenCalledWith(row)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('space satırı etkinleştirir ve sayfa kaydırmasını engeller', () => {
    const activate = vi.fn()
    const e = keyEvent(' ')
    keyboardRowProps(activate)({ item: row }).onKeydown(e)
    expect(activate).toHaveBeenCalledWith(row)
    expect(e.preventDefault).toHaveBeenCalled() // yoksa sayfa zıplar
  })

  it('diğer tuşlara dokunmaz', () => {
    const activate = vi.fn()
    for (const k of ['Tab', 'a', 'ArrowDown', 'Escape']) {
      const e = keyEvent(k)
      keyboardRowProps(activate)({ item: row }).onKeydown(e)
      expect(activate, k).not.toHaveBeenCalled()
      expect(e.preventDefault, k).not.toHaveBeenCalled()
    }
  })

  it('satırın İÇİNDEKİ öğe odaktaysa karışmaz', () => {
    // İleride satıra buton eklenirse Enter onun işi olmalı, satırın değil.
    const activate = vi.fn()
    const e = keyEvent('Enter', false)
    keyboardRowProps(activate)({ item: row }).onKeydown(e)
    expect(activate).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
