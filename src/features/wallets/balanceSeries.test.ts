import { describe, expect, it } from 'vitest'

import { TrnType, type TrnItem } from '@/features/trns/types'

/**
 * WalletBalanceChart'taki bakiye serisi mantığının aynısı.
 *
 * Neden ayrı test: geçmiş bakiye BUGÜNDEN GERİYE hesaplanıyor çünkü elimizde
 * "açılış bakiyesi" alanı yok, yalnız güncel bakiye + işlemler var. İleriye
 * toplasaydık dönemden ÖNCEKİ işlemleri kaçırır, seri yanlış bir taban etrafında
 * gezerdi. İşaret hatası da (transferin yönü) grafiği sessizce ters çevirirdi —
 * ne build ne typecheck bunu görür.
 */
function signedAmount(trn: TrnItem, walletId: string): number {
  if (trn.type === TrnType.Transfer) {
    let sum = 0
    if (trn.expenseWalletId === walletId)
      sum -= trn.expenseAmount
    if (trn.incomeWalletId === walletId)
      sum += trn.incomeAmount
    return sum
  }
  return trn.type === TrnType.Income ? trn.amount : -trn.amount
}

function buildSeries(trns: TrnItem[], walletId: string, currentBalance: number) {
  const sorted = trns.toSorted((a, b) => a.date - b.date)
  if (!sorted.length)
    return []
  const points: { date: number, balance: number }[] = []
  let running = currentBalance
  for (let i = sorted.length - 1; i >= 0; i--) {
    points.unshift({ date: sorted[i]!.date, balance: running })
    running -= signedAmount(sorted[i]!, walletId)
  }
  points.unshift({ date: sorted[0]!.date - 86_400_000, balance: running })
  return points
}

const W = 'w1'
const other = 'w2'
const base = { updatedAt: 0, categoryId: 'c1' }

describe('cüzdan bakiye serisi', () => {
  it('son nokta GÜNCEL bakiyeye eşit', () => {
    const trns = [
      { ...base, type: TrnType.Income, amount: 100, walletId: W, date: 1 },
      { ...base, type: TrnType.Expense, amount: 30, walletId: W, date: 2 },
    ] as TrnItem[]
    const s = buildSeries(trns, W, 70)
    expect(s.at(-1)!.balance).toBe(70)
  })

  it('geriye hesap: ilk noktadan ileri toplayınca güncel bakiye çıkar', () => {
    const trns = [
      { ...base, type: TrnType.Income, amount: 100, walletId: W, date: 1 },
      { ...base, type: TrnType.Expense, amount: 30, walletId: W, date: 2 },
      { ...base, type: TrnType.Income, amount: 50, walletId: W, date: 3 },
    ] as TrnItem[]
    const s = buildSeries(trns, W, 120)
    // Başlangıç noktası + tüm etkiler = güncel bakiye
    const total = trns.reduce((sum, t) => sum + signedAmount(t, W), 0)
    expect(s[0]!.balance + total).toBe(120)
  })

  it('dönem ÖNCESİ işlemler kaçırılmaz: taban doğru kayar', () => {
    // Yalnız son 1 işlem verilse bile, taban güncel bakiyeden türetilir.
    const trns = [{ ...base, type: TrnType.Expense, amount: 40, walletId: W, date: 9 }] as TrnItem[]
    const s = buildSeries(trns, W, 60)
    expect(s[0]!.balance).toBe(100) // 60 + 40 → işlemden önce 100'dü
    expect(s.at(-1)!.balance).toBe(60)
  })

  it('transfer: GÖNDEREN tarafta bakiye düşer', () => {
    const trns = [{
      ...base, type: TrnType.Transfer, categoryId: 'transfer',
      expenseWalletId: W, expenseAmount: 300, incomeWalletId: other, incomeAmount: 300, date: 1,
    }] as unknown as TrnItem[]
    expect(signedAmount(trns[0]!, W)).toBe(-300)
    expect(buildSeries(trns, W, 700)[0]!.balance).toBe(1000)
  })

  it('transfer: ALAN tarafta bakiye artar', () => {
    const trns = [{
      ...base, type: TrnType.Transfer, categoryId: 'transfer',
      expenseWalletId: other, expenseAmount: 300, incomeWalletId: W, incomeAmount: 300, date: 1,
    }] as unknown as TrnItem[]
    expect(signedAmount(trns[0]!, W)).toBe(300)
    expect(buildSeries(trns, W, 1300)[0]!.balance).toBe(1000)
  })

  it('aynı cüzdana transfer: net etki 0', () => {
    const trn = {
      ...base, type: TrnType.Transfer, categoryId: 'transfer',
      expenseWalletId: W, expenseAmount: 300, incomeWalletId: W, incomeAmount: 300, date: 1,
    } as unknown as TrnItem
    expect(signedAmount(trn, W)).toBe(0)
  })

  it('işlem yoksa seri boş (boş grafik çizilmez)', () => {
    expect(buildSeries([], W, 500)).toEqual([])
  })
})
