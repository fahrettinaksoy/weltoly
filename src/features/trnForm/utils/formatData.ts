import type { Transaction, Transfer, TrnFormValues } from '@/features/trns/types'

import { TRANSFER_ID } from '@/features/categories/pseudoCategories'
import { TrnType } from '@/features/trns/types'

function formatTransaction(props: TrnFormValues): Transaction | false {
  if (props.trnType === TrnType.Transfer || !props.categoryId || !props.walletId)
    return false

  const data: Transaction = {
    amount: props.amount[0],
    categoryId: props.categoryId,
    date: props.date || Date.now(),
    type: props.trnType,
    updatedAt: Date.now(),
    walletId: props.walletId,
  }

  if (props.desc)
    data.desc = props.desc

  if (props.tagIds?.length)
    data.tagIds = [...props.tagIds]

  return data
}

function formatTransfer(props: TrnFormValues): Transfer | false {
  if (props.trnType !== TrnType.Transfer || !props.expenseWalletId || !props.incomeWalletId)
    return false

  const data: Transfer = {
    categoryId: TRANSFER_ID,
    // `|| Date.now()` ŞART (O-9): formatTransaction ile AYNI davranış. Yoksa
    // date 0/undefined geldiğinde transfer sessizce 1970'e düşerdi — aynı formun
    // iki dalı iki farklı kurala uyuyordu.
    date: props.date || Date.now(),
    expenseAmount: props.amount[1],
    expenseWalletId: props.expenseWalletId,
    incomeAmount: props.amount[2],
    incomeWalletId: props.incomeWalletId,
    type: props.trnType,
    updatedAt: Date.now(),
  }

  if (props.desc)
    data.desc = props.desc

  if (props.tagIds?.length)
    data.tagIds = [...props.tagIds]

  return data
}

export { formatTransaction, formatTransfer }
