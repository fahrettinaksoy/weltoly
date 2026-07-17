import type { CurrencyCode, Rates } from '@/features/currencies/types'
import type { TrnId, TrnItem, Trns } from '@/features/trns/types'
import type { WalletId, WalletItem, Wallets } from '@/features/wallets/types'

import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { TrnType } from '@/features/trns/types'
import { addMoney, subMoney } from '@/shared/lib/money'

function validRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/**
 * Tutarı base para birimine çevirir.
 *
 * DÖNÜŞ: eksik/geçersiz kur olduğunda `null` — çağıran cüzdanı toplamdan AÇIKÇA
 * hariç tutabilsin diye. Eskiden burada `?? 1` sessiz 1:1 fallback vardı (Y-1):
 * 10.000 EUR, EUR kuru yokken 10.000 USD gibi net'e giriyordu. Artık uydurma yok.
 *
 * Pass-through (çevirmeden aynen döndürme) YALNIZ güvenli iki durumda:
 *  - Dönüşüm bağlamı yok (base ya da rates tanımsız) → henüz kur yüklenmemiş.
 *  - base === currency → dönüşüm gerekmez.
 */
export function getAmountInRate({
  amount,
  baseCurrencyCode,
  currencyCode,
  rates,
}: {
  amount: number
  baseCurrencyCode?: CurrencyCode
  currencyCode: CurrencyCode
  rates?: Rates
}): number | null {
  if (!baseCurrencyCode || !rates)
    return amount

  if (baseCurrencyCode === currencyCode)
    return amount

  const from = rates[currencyCode]
  const to = rates[baseCurrencyCode]
  if (!validRate(from) || !validRate(to))
    return null // eksik/geçersiz kur → sessizce 1:1 varsayma

  return amount / from * to
}

interface TotalProps {
  baseCurrencyCode?: CurrencyCode
  rates?: Rates
  trnsIds?: TrnId[]
  trnsItems: Record<TrnId, TrnItem>
  walletsIds?: WalletId[]
  walletsItems: Record<WalletId, WalletItem>
}

export interface TotalReturns {
  adjustment: number
  expense: number
  expenseTransfers: number
  income: number
  incomeTransfers: number
  sum: number
  sumTransfers: number
  // Kuru eksik olduğu için toplamdan hariç tutulan işlem oldu mu? UI "kur eksik" rozeti gösterir.
  hasMissingRates: boolean
}

export function getTotal(props: TotalProps): TotalReturns {
  const { baseCurrencyCode, rates, trnsIds, trnsItems, walletsIds, walletsItems } = props
  const walletsSet = walletsIds?.length ? new Set(walletsIds) : null

  let hasMissingRates = false

  // Kuru çözülemeyen tutar null döner → hariç tut ve bayrağı kaldır.
  function getAmount(amount: number, currencyCode: CurrencyCode): number | null {
    const v = getAmountInRate({ amount, baseCurrencyCode, currencyCode, rates })
    if (v === null)
      hasMissingRates = true
    return v
  }

  let income = 0
  let expense = 0
  let incomeTransfers = 0
  let expenseTransfers = 0
  let adjustment = 0

  for (const trnId of trnsIds || []) {
    const trn = trnsItems[trnId]
    if (!trn)
      continue

    if (trn.type === TrnType.Income || trn.type === TrnType.Expense) {
      if (trn.categoryId === ADJUSTMENT_ID) {
        const wallet = walletsItems[trn.walletId]
        const amount = getAmount(trn.amount, wallet?.currency ?? 'USD')
        if (amount !== null)
          adjustment = trn.type === TrnType.Income ? addMoney(adjustment, amount) : subMoney(adjustment, amount)
        continue
      }
      const wallet = walletsItems[trn.walletId]
      const sum = getAmount(trn.amount, wallet?.currency ?? 'USD')
      if (sum === null)
        continue

      if (trn.type === TrnType.Income)
        income = addMoney(income, sum)
      else
        expense = addMoney(expense, sum)
    }

    else if (trn.type === TrnType.Transfer && 'incomeWalletId' in trn) {
      const incomeWallet = walletsItems[trn.incomeWalletId]
      const expenseWallet = walletsItems[trn.expenseWalletId]
      if (!incomeWallet || !expenseWallet)
        continue

      const incomeAmount = getAmount(trn.incomeAmount, incomeWallet.currency)
      const expenseAmount = getAmount(trn.expenseAmount, expenseWallet.currency)

      if (walletsSet) {
        if (incomeAmount !== null && walletsSet.has(trn.incomeWalletId))
          incomeTransfers = addMoney(incomeTransfers, incomeAmount)

        if (expenseAmount !== null && walletsSet.has(trn.expenseWalletId))
          expenseTransfers = addMoney(expenseTransfers, expenseAmount)
      }
      else {
        if (incomeAmount !== null)
          incomeTransfers = addMoney(incomeTransfers, incomeAmount)
        if (expenseAmount !== null)
          expenseTransfers = addMoney(expenseTransfers, expenseAmount)
      }
    }
  }

  const sum = subMoney(income, expense)
  const sumTransfers = subMoney(incomeTransfers, expenseTransfers)

  return {
    adjustment,
    expense,
    expenseTransfers,
    income,
    incomeTransfers,
    sum,
    sumTransfers,
    hasMissingRates,
  }
}

/**
 * Tek geçişte cüzdan bakiyeleri. O(W×N) yerine O(N).
 * Her cüzdan için: gelir - gider + transferler + düzeltmeler.
 */
export function getWalletsTotals(props: {
  trnsItems: Trns
  walletsItems: Wallets
}): Map<WalletId, number> {
  const { trnsItems, walletsItems } = props
  const totals = new Map<WalletId, number>()

  function addToWallet(walletId: WalletId, amount: number) {
    totals.set(walletId, addMoney(totals.get(walletId) ?? 0, amount))
  }

  for (const trnId of Object.keys(trnsItems)) {
    const trn = trnsItems[trnId]
    if (!trn)
      continue

    if (trn.type === TrnType.Income || trn.type === TrnType.Expense) {
      if (!walletsItems[trn.walletId])
        continue
      addToWallet(trn.walletId, trn.type === TrnType.Income ? trn.amount : -trn.amount)
    }
    else if (trn.type === TrnType.Transfer && 'incomeWalletId' in trn) {
      if (!walletsItems[trn.incomeWalletId] || !walletsItems[trn.expenseWalletId])
        continue
      addToWallet(trn.incomeWalletId, trn.incomeAmount)
      addToWallet(trn.expenseWalletId, -trn.expenseAmount)
    }
  }

  return totals
}
