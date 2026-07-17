import type { Trns } from '@/features/trns/types'

import { describe, expect, it } from 'vitest'
import { filterTrnsIds } from '@/features/trns/getTrns'
import { TrnType } from '@/features/trns/types'

/**
 * ÜRETİM `filterTrnsIds`'i test eder — elle kopyalanmış bir eşdeğerini değil (Y-5).
 * Süzgeç mantığı sessizce bozulursa (bir yerde `<` diğerinde `<=`) kullanıcı
 * yalnızca "eksik işlem" görür; hata gürültü çıkarmaz. Bu yüzden sözleşme
 * burada kilitlenir.
 */

const D = (iso: string) => new Date(iso).getTime()

const trns: Trns = {
  a: { type: TrnType.Expense, amount: 10, categoryId: 'food', walletId: 'w1', date: D('2026-03-10T09:00:00Z'), updatedAt: 1 },
  b: { type: TrnType.Income, amount: 20, categoryId: 'salary', walletId: 'w1', date: D('2026-03-12T18:30:00Z'), updatedAt: 2 },
  c: { type: TrnType.Expense, amount: 30, categoryId: 'food', walletId: 'w2', date: D('2026-03-15T12:00:00Z'), updatedAt: 3 },
}

describe('filterTrnsIds — girdi mutasyonu (O-1)', () => {
  it('sort=true iken çağıranın dizisini YERİNDE sıralamaz', () => {
    const caller = ['a', 'b', 'c']
    const snapshot = [...caller]

    const out = filterTrnsIds({ trnsItems: trns, trnsIds: caller, sort: true })

    expect(caller).toEqual(snapshot) // çağıranın dizisi dokunulmamış
    expect(out).not.toBe(caller) // yeni dizi döndü
    expect(out).toEqual(['c', 'b', 'a']) // tarihe göre azalan
  })

  it('süzgeçli yolda da çağıranın dizisi korunur', () => {
    const caller = ['a', 'b', 'c']
    const snapshot = [...caller]
    filterTrnsIds({ trnsItems: trns, trnsIds: caller, sort: true, trnsTypes: [TrnType.Expense] })
    expect(caller).toEqual(snapshot)
  })
})

describe('filterTrnsIds — tarih sınırı sözleşmesi (O-2)', () => {
  it('sınırlar KAPALI aralıktır: [start, end] ikisi de dahil', () => {
    const out = filterTrnsIds({
      trnsItems: trns,
      trnsIds: ['a', 'b', 'c'],
      dates: { start: D('2026-03-10T09:00:00Z'), end: D('2026-03-15T12:00:00Z') },
    })
    expect(out).toEqual(['a', 'b', 'c']) // tam sınırdaki a ve c dahil
  })

  it('end 00:00 verilirse o günün işlemleri elenir — normalize etmek ÇAĞIRANIN işi', () => {
    // Bu, belgelenmiş davranıştır (off-by-one tuzağı). Sessizce değişmesin diye kilitli.
    const out = filterTrnsIds({
      trnsItems: trns,
      trnsIds: ['a', 'b', 'c'],
      dates: { start: D('2026-03-10T00:00:00Z'), end: D('2026-03-15T00:00:00Z') },
    })
    expect(out).not.toContain('c') // 15'i 12:00 > 15'i 00:00 → elendi
    expect(out).toEqual(['a', 'b'])
  })

  it('çağıran endOfDay ile normalize edince o gün dahil olur', () => {
    const out = filterTrnsIds({
      trnsItems: trns,
      trnsIds: ['a', 'b', 'c'],
      dates: { start: D('2026-03-10T00:00:00Z'), end: D('2026-03-15T23:59:59.999Z') },
    })
    expect(out).toContain('c')
  })
})

describe('filterTrnsIds — süzgeçler', () => {
  it('türe göre süzer', () => {
    expect(filterTrnsIds({ trnsItems: trns, trnsIds: ['a', 'b', 'c'], trnsTypes: [TrnType.Income] })).toEqual(['b'])
  })

  it('cüzdana göre süzer', () => {
    expect(filterTrnsIds({ trnsItems: trns, trnsIds: ['a', 'b', 'c'], walletsIds: ['w2'] })).toEqual(['c'])
  })

  it('kategoriye göre süzer', () => {
    expect(filterTrnsIds({ trnsItems: trns, trnsIds: ['a', 'b', 'c'], categoriesIds: ['food'] })).toEqual(['a', 'c'])
  })

  it('süzgeç yoksa tüm id\'leri döndürür', () => {
    expect(filterTrnsIds({ trnsItems: trns, trnsIds: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c'])
  })
})
