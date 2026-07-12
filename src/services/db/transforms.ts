import type { CategoryId, CategoryItem } from '@/features/categories/types'
import type { Rates } from '@/features/currencies/types'
import type { TrnItem } from '@/features/trns/types'
import type { WalletItem, WalletType } from '@/features/wallets/types'

import { TrnType } from '@/features/trns/types'

// Ham SQLite satırı: her tabloda `id` metin birincil anahtarı bulunur.
export type Row = Record<string, any> & { id: string }

// null updatedAt -> 0 (epoch), asla Date.now(): okumalar arası kararlı kalsın ki
// reconcile değişiklik-tespiti doğru çalışsın.
const ts = (v: unknown): number => (v == null ? 0 : Number(v))

// --- okuma: SQLite satırı -> Pinia item şekli ---------------------------------

export function rowToTrn(row: Row): TrnItem {
  const type = Number(row.type) as TrnType
  const base = {
    date: Number(row.date),
    updatedAt: ts(row.updatedAt),
    ...(row.desc ? { desc: row.desc as string } : {}),
  }

  if (type === TrnType.Transfer) {
    return {
      ...base,
      categoryId: 'transfer',
      expenseAmount: Number(row.expenseAmount),
      expenseWalletId: row.expenseWalletId,
      incomeAmount: Number(row.incomeAmount),
      incomeWalletId: row.incomeWalletId,
      type,
    } as TrnItem
  }

  return {
    ...base,
    amount: Number(row.amount),
    categoryId: row.categoryId,
    type,
    walletId: row.walletId,
  } as TrnItem
}

export function rowToWallet(row: Row): WalletItem {
  const base = {
    color: row.color,
    currency: row.currency,
    desc: (row.desc ?? '') as string,
    isArchived: !!row.isArchived,
    isExcludeInTotal: !!row.isExcludeInTotal,
    isWithdrawal: !!row.isWithdrawal,
    name: row.name,
    order: Number(row.order ?? 0),
    updatedAt: ts(row.updatedAt),
  }

  if (row.type === 'credit')
    return { ...base, creditLimit: Number(row.creditLimit ?? 0), type: 'credit' }

  return { ...base, type: row.type as Exclude<WalletType, 'credit'> }
}

export function rowToCategory(row: Row): CategoryItem {
  return {
    color: row.color,
    icon: row.icon,
    name: row.name,
    parentId: (row.parentId ?? 0) as CategoryId | 0, // null -> 0 (kök işareti)
    showInLastUsed: !!row.showInLastUsed,
    showInQuickSelector: !!row.showInQuickSelector,
    ...(row.updatedAt != null ? { updatedAt: Number(row.updatedAt) } : {}),
  }
}

export function rowToRates(row: Row): Rates | null {
  if (!row?.rates)
    return null
  try {
    return JSON.parse(row.rates as string) as Rates
  }
  catch {
    return null
  }
}

// --- yazma: Pinia item şekli -> SQLite satırı ---------------------------------
// Boolean -> 0/1, kök parentId işareti (0) -> null, userId (yerel-öncede sabit 'local').

export function trnToRow(item: TrnItem, userId: string): Record<string, unknown> {
  const base = {
    amount: null as number | null,
    categoryId: item.categoryId ?? null,
    date: item.date,
    desc: item.desc ?? null,
    expenseAmount: null as number | null,
    expenseWalletId: null as string | null,
    incomeAmount: null as number | null,
    incomeWalletId: null as string | null,
    type: item.type,
    updatedAt: item.updatedAt ?? Date.now(),
    userId,
    walletId: null as string | null,
  }

  if (item.type === TrnType.Transfer) {
    return {
      ...base,
      categoryId: 'transfer',
      expenseAmount: item.expenseAmount,
      expenseWalletId: item.expenseWalletId,
      incomeAmount: item.incomeAmount,
      incomeWalletId: item.incomeWalletId,
    }
  }

  return { ...base, amount: item.amount, walletId: item.walletId }
}

export function walletToRow(item: WalletItem, userId: string): Record<string, unknown> {
  return {
    color: item.color,
    creditLimit: item.type === 'credit' ? (item.creditLimit ?? 0) : null,
    currency: item.currency,
    desc: item.desc || null,
    isArchived: item.isArchived ? 1 : 0,
    isExcludeInTotal: item.isExcludeInTotal ? 1 : 0,
    isWithdrawal: item.isWithdrawal ? 1 : 0,
    name: item.name,
    order: Math.round(item.order ?? 0), // tamsayı sütun - yuvarla, sessizce kırpma
    type: item.type,
    updatedAt: item.updatedAt ?? Date.now(),
    userId,
  }
}

export function categoryToRow(item: CategoryItem, userId: string): Record<string, unknown> {
  return {
    color: item.color,
    icon: item.icon,
    name: item.name,
    parentId: item.parentId ? String(item.parentId) : null, // 0/'' kök işareti -> null
    showInLastUsed: item.showInLastUsed ? 1 : 0,
    showInQuickSelector: item.showInQuickSelector ? 1 : 0,
    updatedAt: item.updatedAt ?? Date.now(),
    userId,
  }
}
