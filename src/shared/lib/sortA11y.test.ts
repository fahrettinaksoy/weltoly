import { describe, expect, it } from 'vitest'

import { ariaSort } from './sortA11y'

/**
 * Regresyon sessiz olurdu: sıralama ikonu görsel olarak doğru kalır, yalnız
 * ekran okuyucu sırayı duyuramaz. Gözle fark edilmez.
 */
describe('ariaSort', () => {
  it('sıralanamayan sütunda öznitelik HİÇ olmamalı', () => {
    // 'none' vermek "sıralanabilir ama sırasız" der — yanlış beklenti.
    expect(ariaSort('desc', false, [])).toBeUndefined()
    expect(ariaSort('desc', undefined, [])).toBeUndefined()
  })

  it('sıralanabilir ama aktif değilse none', () => {
    expect(ariaSort('amount', true, [{ key: 'date', order: 'desc' }])).toBe('none')
  })

  it('aktif sütunda yönü bildirir', () => {
    expect(ariaSort('date', true, [{ key: 'date', order: 'desc' }])).toBe('descending')
    expect(ariaSort('date', true, [{ key: 'date', order: 'asc' }])).toBe('ascending')
  })

  it('boolean order desteklenir (Vuetify true=asc, false=desc)', () => {
    expect(ariaSort('date', true, [{ key: 'date', order: true }])).toBe('ascending')
    expect(ariaSort('date', true, [{ key: 'date', order: false }])).toBe('descending')
  })

  it('order verilmemişse artan sayılır', () => {
    expect(ariaSort('date', true, [{ key: 'date' }])).toBe('ascending')
  })

  it('sortBy yoksa/boşsa none', () => {
    expect(ariaSort('date', true, undefined)).toBe('none')
    expect(ariaSort('date', true, [])).toBe('none')
  })

  it('çok kolonlu sıralamada doğru kolonu bulur', () => {
    const sortBy = [{ key: 'kind', order: 'asc' as const }, { key: 'date', order: 'desc' as const }]
    expect(ariaSort('date', true, sortBy)).toBe('descending')
    expect(ariaSort('kind', true, sortBy)).toBe('ascending')
    expect(ariaSort('amount', true, sortBy)).toBe('none')
  })

  it('sayısal/karma kolon anahtarı string\'e çevrilir', () => {
    expect(ariaSort(1, true, [{ key: '1', order: 'asc' }])).toBe('ascending')
  })
})
