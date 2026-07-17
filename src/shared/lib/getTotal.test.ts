import type { Trns } from '@/features/trns/types'

import type { Wallets } from '@/features/wallets/types'
import { describe, expect, it } from 'vitest'
import { TrnType } from '@/features/trns/types'
import { getAmountInRate, getTotal, getWalletsTotals } from './getTotal'

function wallet(currency: string): any {
  return {
    color: '#000',
    currency,
    desc: '',
    isArchived: false,
    isExcludeInTotal: false,
    isWithdrawal: false,
    name: currency,
    order: 0,
    updatedAt: 0,
    type: 'cash',
  }
}

const wallets: Wallets = {
  w1: wallet('USD'),
  w2: wallet('USD'),
  w3: wallet('EUR'),
}

const trns: Trns = {
  t_inc: { type: TrnType.Income, amount: 100, categoryId: 'salary', walletId: 'w1', date: 1, updatedAt: 1 },
  t_exp: { type: TrnType.Expense, amount: 40, categoryId: 'food', walletId: 'w1', date: 2, updatedAt: 2 },
  t_adj: { type: TrnType.Income, amount: 10, categoryId: 'adjustment', walletId: 'w1', date: 3, updatedAt: 3 },
  t_trf: {
    type: TrnType.Transfer,
    categoryId: 'transfer',
    expenseWalletId: 'w1',
    expenseAmount: 30,
    incomeWalletId: 'w2',
    incomeAmount: 30,
    date: 4,
    updatedAt: 4,
  },
}

describe('getAmountInRate', () => {
  it('aynı para biriminde tutarı değiştirmez', () => {
    expect(getAmountInRate({ amount: 100, baseCurrencyCode: 'USD', currencyCode: 'USD', rates: { USD: 1 } })).toBe(100)
  })

  it('rates/base yoksa tutarı aynen döndürür', () => {
    expect(getAmountInRate({ amount: 100, currencyCode: 'EUR' })).toBe(100)
  })

  it('farklı para birimini base para birimine çevirir', () => {
    const r = getAmountInRate({ amount: 90, baseCurrencyCode: 'USD', currencyCode: 'EUR', rates: { USD: 1, EUR: 0.9 } })
    expect(r).toBeCloseTo(100, 6) // 90 / 0.9 * 1
  })

  it('kur eksikse null döner (sessiz 1:1 YOK) — Y-1', () => {
    // EUR kuru rates içinde yok → uydurma dönüşüm yerine null.
    expect(getAmountInRate({ amount: 10000, baseCurrencyCode: 'USD', currencyCode: 'EUR', rates: { USD: 1 } })).toBeNull()
  })

  it('kur 0/negatif/NaN ise null döner', () => {
    expect(getAmountInRate({ amount: 100, baseCurrencyCode: 'USD', currencyCode: 'EUR', rates: { USD: 1, EUR: 0 } })).toBeNull()
    expect(getAmountInRate({ amount: 100, baseCurrencyCode: 'USD', currencyCode: 'EUR', rates: { USD: 1, EUR: -1 } })).toBeNull()
    expect(getAmountInRate({ amount: 100, baseCurrencyCode: 'USD', currencyCode: 'EUR', rates: { USD: 1, EUR: Number.NaN } })).toBeNull()
  })
})

describe('getTotal', () => {
  const res = getTotal({ trnsItems: trns, trnsIds: Object.keys(trns), walletsItems: wallets })

  it('gelir/gider düzeltmeyi hariç tutar', () => {
    expect(res.income).toBe(100)
    expect(res.expense).toBe(40)
  })

  it('düzeltmeyi ayrı sayar', () => {
    expect(res.adjustment).toBe(10)
  })

  it('transferleri toplar ve sum = gelir - gider', () => {
    expect(res.incomeTransfers).toBe(30)
    expect(res.expenseTransfers).toBe(30)
    expect(res.sum).toBe(60)
  })

  it('kur bağlamı yoksa hasMissingRates false', () => {
    expect(res.hasMissingRates).toBe(false)
  })

  it('kur eksikse ilgili işlemi hariç tutar ve bayrak kaldırır — Y-1', () => {
    // base USD, EUR cüzdanı var ama EUR kuru yok → o gelir hariç, bayrak true.
    const r = getTotal({
      trnsItems: {
        eur_inc: { type: TrnType.Income, amount: 100, categoryId: 'salary', walletId: 'w3', date: 1, updatedAt: 1 },
        usd_inc: { type: TrnType.Income, amount: 50, categoryId: 'salary', walletId: 'w1', date: 2, updatedAt: 2 },
      },
      trnsIds: ['eur_inc', 'usd_inc'],
      walletsItems: wallets,
      baseCurrencyCode: 'USD',
      rates: { USD: 1 },
    })
    expect(r.income).toBe(50) // yalnız USD işlemi
    expect(r.hasMissingRates).toBe(true)
  })
})

describe('getWalletsTotals', () => {
  const totals = getWalletsTotals({ trnsItems: trns, walletsItems: wallets })

  it('w1 bakiyesi: +100 -40 +10(adj) -30(transfer out) = 40', () => {
    expect(totals.get('w1')).toBe(40)
  })

  it('w2 bakiyesi: +30 (transfer in)', () => {
    expect(totals.get('w2')).toBe(30)
  })
})
