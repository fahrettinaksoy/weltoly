import { describe, expect, it } from 'vitest'

import {
  categoryToRow,
  rowToCategory,
  rowToTag,
  tagToRow,
  rowToRates,
  rowToTrn,
  rowToWallet,
  trnToRow,
  walletToRow,
  type Row,
} from './transforms'
import { TrnType, type TrnItem } from '@/features/trns/types'
import type { WalletItem } from '@/features/wallets/types'
import type { CategoryItem } from '@/features/categories/types'
import type { TagItem } from '@/features/tags/types'

describe('wallet transforms', () => {
  it('boolean 0/1 ↔ true/false çevrimi', () => {
    const item: WalletItem = {
      color: '#fff', currency: 'USD', desc: 'x', icon: '', isArchived: true, isExcludeInTotal: false,
      isWithdrawal: true, name: 'Cash', order: 2, updatedAt: 5, type: 'cash',
    }
    const row = walletToRow(item, 'local')
    expect(row.isArchived).toBe(1)
    expect(row.isExcludeInTotal).toBe(0)
    expect(row.isWithdrawal).toBe(1)

    const back = rowToWallet({ id: 'w1', ...row } as Row)
    expect(back.isArchived).toBe(true)
    expect(back.isExcludeInTotal).toBe(false)
    expect(back.isWithdrawal).toBe(true)
    expect(back.name).toBe('Cash')
    expect(back.order).toBe(2)
  })

  it('credit cüzdanı creditLimit taşır', () => {
    const item: WalletItem = {
      color: '#fff', currency: 'USD', desc: '', icon: '', isArchived: false, isExcludeInTotal: false,
      isWithdrawal: false, name: 'Card', order: 0, updatedAt: 0, type: 'credit', creditLimit: 500,
    }
    const back = rowToWallet({ id: 'w2', ...walletToRow(item, 'local') } as Row)
    expect(back.type).toBe('credit')
    expect((back as any).creditLimit).toBe(500)
  })
})

describe('category transforms', () => {
  it('parentId 0 ↔ null (kök işareti)', () => {
    const root: CategoryItem = {
      color: '#fff', desc: '', icon: 'mdi:home', name: 'Root', parentId: 0,
      showInLastUsed: true, showInQuickSelector: false, updatedAt: 1,
    }
    const row = categoryToRow(root, 'local')
    expect(row.parentId).toBeNull()
    expect(rowToCategory({ id: 'c1', ...row } as Row).parentId).toBe(0)

    const child: CategoryItem = { ...root, parentId: 'c1' }
    const childRow = categoryToRow(child, 'local')
    expect(childRow.parentId).toBe('c1')
    expect(rowToCategory({ id: 'c2', ...childRow } as Row).parentId).toBe('c1')
  })
})

describe('desc alanı (003 migrasyonu)', () => {
  it('kategori desc round-trip; boş desc null olarak yazılır', () => {
    const withDesc: CategoryItem = {
      color: '#fff', desc: 'Aylık sabit gider', icon: 'mdi:home', name: 'Kira', parentId: 0,
      showInLastUsed: true, showInQuickSelector: false, updatedAt: 1,
    }
    const row = categoryToRow(withDesc, 'local')
    expect(row.desc).toBe('Aylık sabit gider')
    expect(rowToCategory({ id: 'c1', ...row } as Row).desc).toBe('Aylık sabit gider')

    // Boş string DB'ye null gider (kolon "yok" anlamında null tutulur)
    expect(categoryToRow({ ...withDesc, desc: '' }, 'local').desc).toBeNull()
  })

  it('etiket desc round-trip; boş desc null olarak yazılır', () => {
    const tag: TagItem = { name: 'Zorunlu', color: '#ef4444', desc: 'Kısılamaz giderler', updatedAt: 1 }
    const row = tagToRow(tag, 'local')
    expect(row.desc).toBe('Kısılamaz giderler')
    expect(rowToTag({ id: 't1', ...row } as Row).desc).toBe('Kısılamaz giderler')

    expect(tagToRow({ ...tag, desc: '' }, 'local').desc).toBeNull()
  })

  it('003 ÖNCESİ satırlar: desc kolonu null gelir, boş stringe düşer', () => {
    // Migrasyon eski satırlara desc eklemez → null. UI'ın undefined görmemesi şart.
    const legacyCategory = { id: 'c1', color: '#fff', icon: 'mdi:home', name: 'Eski', parentId: null, showInLastUsed: 1, showInQuickSelector: 0, updatedAt: 1 }
    expect(rowToCategory(legacyCategory as unknown as Row).desc).toBe('')

    const legacyTag = { id: 't1', name: 'Eski', color: '#000', updatedAt: 1 }
    expect(rowToTag(legacyTag as unknown as Row).desc).toBe('')
  })
})

describe('trn transforms', () => {
  it('gelir işlemi round-trip', () => {
    const trn: TrnItem = { type: TrnType.Expense, amount: 25, categoryId: 'food', walletId: 'w1', date: 10, updatedAt: 11 }
    const back = rowToTrn({ id: 't1', ...trnToRow(trn, 'local') } as Row)
    expect(back.type).toBe(TrnType.Expense)
    expect((back as any).amount).toBe(25)
    expect((back as any).walletId).toBe('w1')
  })

  it('transfer işlemi expense/income alanlarını taşır', () => {
    const trn: TrnItem = {
      type: TrnType.Transfer, categoryId: 'transfer',
      expenseWalletId: 'w1', expenseAmount: 30, incomeWalletId: 'w2', incomeAmount: 30,
      date: 12, updatedAt: 13,
    }
    const row = trnToRow(trn, 'local')
    expect(row.categoryId).toBe('transfer')
    const back = rowToTrn({ id: 't2', ...row } as Row)
    expect(back.type).toBe(TrnType.Transfer)
    expect((back as any).expenseAmount).toBe(30)
    expect((back as any).incomeWalletId).toBe('w2')
  })
})

describe('rates transforms', () => {
  it('JSON rates parse eder, bozuksa null döner', () => {
    expect(rowToRates({ id: 'r1', rates: JSON.stringify({ USD: 1, EUR: 0.9 }) } as Row)).toEqual({ USD: 1, EUR: 0.9 })
    expect(rowToRates({ id: 'r2', rates: 'bozuk{' } as Row)).toBeNull()
    expect(rowToRates({ id: 'r3' } as Row)).toBeNull()
  })
})
