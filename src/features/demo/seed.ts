import {
  categoryToRow, emitTableChange, getDb, isTauriRuntime,
  resolveWriteUid, trnToRow, upsertRow, walletToRow,
} from '@/services/db'
import { TrnType } from '@/features/trns/types'
import type { WalletItem } from '@/features/wallets/types'
import type { CategoryItem } from '@/features/categories/types'
import type { TrnItem } from '@/features/trns/types'

const uid = resolveWriteUid(null)
const DAY = 86_400_000

// Sabit id'ler → yeniden yükleme çoğaltmaz, üzerine yazar.
const wallets: { id: string, item: WalletItem }[] = [
  { id: 'demo-w-cash', item: base({ name: 'Cash', type: 'cash', currency: 'USD', color: '#22c55e', order: 0 }) },
  { id: 'demo-w-bank', item: base({ name: 'Bank', type: 'cashless', currency: 'USD', color: '#2563eb', order: 1 }) },
  { id: 'demo-w-card', item: { ...base({ name: 'Card', type: 'credit', currency: 'USD', color: '#a855f7', order: 2 }), type: 'credit', creditLimit: 5000 } },
  { id: 'demo-w-savings', item: base({ name: 'Savings', type: 'deposit', currency: 'EUR', color: '#14b8a6', order: 3 }) },
]

function base(p: { name: string, type: WalletItem['type'], currency: string, color: string, order: number }): WalletItem {
  return {
    name: p.name, type: p.type as Exclude<WalletItem['type'], 'credit'>, currency: p.currency, color: p.color,
    desc: '', isArchived: false, isExcludeInTotal: false, isWithdrawal: false, order: p.order, updatedAt: Date.now(),
  } as WalletItem
}

function cat(name: string, icon: string, color: string, parentId: string | 0 = 0, fav = false): CategoryItem {
  return { name, icon, color, parentId, showInLastUsed: true, showInQuickSelector: fav, updatedAt: Date.now() }
}

const categories: { id: string, item: CategoryItem }[] = [
  { id: 'demo-c-food', item: cat('Food', 'mdi:food', '#f97316', 0, true) },
  { id: 'demo-c-groceries', item: cat('Groceries', 'mdi:cart', '#f97316', 'demo-c-food') },
  { id: 'demo-c-restaurant', item: cat('Restaurants', 'mdi:silverware-fork-knife', '#f97316', 'demo-c-food') },
  { id: 'demo-c-transport', item: cat('Transport', 'mdi:car', '#0ea5e9', 0, true) },
  { id: 'demo-c-fuel', item: cat('Fuel', 'mdi:gas-station', '#0ea5e9', 'demo-c-transport') },
  { id: 'demo-c-taxi', item: cat('Taxi', 'mdi:taxi', '#0ea5e9', 'demo-c-transport') },
  { id: 'demo-c-shopping', item: cat('Shopping', 'mdi:shopping', '#ec4899', 0) },
  { id: 'demo-c-bills', item: cat('Bills', 'mdi:file-document', '#64748b', 0) },
  { id: 'demo-c-rent', item: cat('Rent', 'mdi:home', '#64748b', 'demo-c-bills') },
  { id: 'demo-c-utilities', item: cat('Utilities', 'mdi:flash', '#eab308', 'demo-c-bills') },
  { id: 'demo-c-fun', item: cat('Entertainment', 'mdi:movie', '#8b5cf6', 0) },
  { id: 'demo-c-salary', item: cat('Salary', 'mdi:cash-multiple', '#22c55e', 0, true) },
]

// [gün önce, kategori, cüzdan, tutar]
const expenseRows: [number, string, string, number][] = [
  [1, 'demo-c-groceries', 'demo-w-cash', 45.5], [2, 'demo-c-restaurant', 'demo-w-card', 80],
  [3, 'demo-c-fuel', 'demo-w-card', 60], [5, 'demo-c-utilities', 'demo-w-bank', 120],
  [7, 'demo-c-groceries', 'demo-w-cash', 30], [8, 'demo-c-taxi', 'demo-w-cash', 18],
  [10, 'demo-c-shopping', 'demo-w-card', 150], [12, 'demo-c-fun', 'demo-w-card', 40],
  [14, 'demo-c-rent', 'demo-w-bank', 1200], [15, 'demo-c-groceries', 'demo-w-cash', 55],
  [18, 'demo-c-restaurant', 'demo-w-card', 65], [20, 'demo-c-fuel', 'demo-w-card', 58],
  [22, 'demo-c-utilities', 'demo-w-bank', 95], [25, 'demo-c-groceries', 'demo-w-cash', 48],
  [28, 'demo-c-shopping', 'demo-w-card', 75], [30, 'demo-c-fun', 'demo-w-cash', 25],
  [33, 'demo-c-taxi', 'demo-w-cash', 22], [35, 'demo-c-groceries', 'demo-w-cash', 52],
  [38, 'demo-c-restaurant', 'demo-w-card', 90], [40, 'demo-c-fuel', 'demo-w-card', 62],
  [44, 'demo-c-rent', 'demo-w-bank', 1200], [47, 'demo-c-utilities', 'demo-w-bank', 110],
  [50, 'demo-c-groceries', 'demo-w-cash', 60], [53, 'demo-c-shopping', 'demo-w-card', 200],
  [56, 'demo-c-fun', 'demo-w-card', 35], [60, 'demo-c-restaurant', 'demo-w-card', 70],
  [64, 'demo-c-fuel', 'demo-w-card', 55], [68, 'demo-c-groceries', 'demo-w-cash', 42],
  [72, 'demo-c-taxi', 'demo-w-cash', 20],
]

function buildTrns(now: number): { id: string, item: TrnItem }[] {
  const list: { id: string, item: TrnItem }[] = []

  // Maaş (gelir)
  ;[2, 32, 62].forEach((d, i) => {
    list.push({
      id: `demo-t-inc-${i}`,
      item: { type: TrnType.Income, amount: 4000, categoryId: 'demo-c-salary', walletId: 'demo-w-bank', date: now - d * DAY, updatedAt: now },
    })
  })

  // Giderler
  expenseRows.forEach(([d, categoryId, walletId, amount], i) => {
    list.push({
      id: `demo-t-exp-${i}`,
      item: { type: TrnType.Expense, amount, categoryId, walletId, date: now - d * DAY, updatedAt: now },
    })
  })

  // Transfer (aynı para birimi)
  list.push({
    id: 'demo-t-trf-0',
    item: {
      type: TrnType.Transfer, categoryId: 'transfer',
      expenseWalletId: 'demo-w-bank', expenseAmount: 300, incomeWalletId: 'demo-w-cash', incomeAmount: 300,
      date: now - 6 * DAY, updatedAt: now,
    },
  })

  // Tasarrufa düzeltme (başlangıç bakiyesi)
  list.push({
    id: 'demo-t-adj-0',
    item: { type: TrnType.Income, amount: 1000, categoryId: 'adjustment', walletId: 'demo-w-savings', date: now - 70 * DAY, updatedAt: now },
  })

  return list
}

/** Örnek veriyi yükler. Hata olursa fırlatır (çağıran mesajı gösterir). */
export async function seedDemoData(): Promise<void> {
  if (!isTauriRuntime())
    throw new Error('Tauri runtime gerekli (npm run tauri:dev)')

  for (const w of wallets)
    await upsertRow('wallets', w.id, walletToRow(w.item, uid))
  for (const c of categories)
    await upsertRow('categories', c.id, categoryToRow(c.item, uid))
  for (const t of buildTrns(Date.now()))
    await upsertRow('trns', t.id, trnToRow(t.item, uid))
  emitTableChange('wallets', 'categories', 'trns')
}

export async function clearAllData(): Promise<void> {
  if (!isTauriRuntime())
    throw new Error('Tauri runtime gerekli (npm run tauri:dev)')

  const db = await getDb()
  for (const t of ['trns', 'wallets', 'categories'])
    await db.execute(`DELETE FROM ${t}`)
  emitTableChange('trns', 'wallets', 'categories')
}
