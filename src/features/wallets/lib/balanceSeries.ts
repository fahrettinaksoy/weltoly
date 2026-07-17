import type { TrnItem } from '@/features/trns/types'
import { TrnType } from '@/features/trns/types'
import { addMoney, subMoney } from '@/shared/lib/money'

/**
 * Bakiye serisi — TEK KAYNAK (Y-5).
 *
 * Bu mantık daha önce `WalletBalanceChart.vue` içinde yaşıyordu ve
 * `balanceSeries.test.ts` onun ELLE KOPYALANMIŞ bir eşdeğerini test ediyordu.
 * İki kopya ayrışınca (bir yerde `-` diğerinde `+`) test yeşil kalır, grafik
 * sessizce yanlış çizerdi — yani test YANLIŞ GÜVEN veriyordu. Artık hem bileşen
 * hem test bu modülü import eder.
 */

export interface BalancePoint { date: number, balance: number }

const DAY_MS = 86_400_000

/**
 * İşlemin bir cüzdana etkisi (işaretli).
 * Transferde cüzdan İKİ tarafta da olabilir (kendine transfer) — bu yüzden iki
 * dal da ayrı ayrı kontrol edilir, `else if` DEĞİL.
 */
export function signedAmount(trn: TrnItem, walletId: string): number {
  if (trn.type === TrnType.Transfer) {
    let sum = 0
    if (trn.expenseWalletId === walletId)
      sum = subMoney(sum, trn.expenseAmount)
    if (trn.incomeWalletId === walletId)
      sum = addMoney(sum, trn.incomeAmount)
    return sum
  }
  return trn.type === TrnType.Income ? trn.amount : -trn.amount
}

/**
 * Bakiye seyri.
 *
 * Geçmiş bakiye BUGÜNDEN GERİYE hesaplanır: elimizde yalnız güncel bakiye ve
 * işlemler var, bir "açılış bakiyesi" alanı yok. İleriye doğru toplasaydık
 * dönemden ÖNCEKİ işlemleri kaçırır ve seri yanlış bir taban etrafında gezerdi.
 * Geriye giderken her işlemin etkisi çıkarılır → o işlemden önceki bakiye.
 *
 * Girdi mutasyona uğratılmaz (toSorted kopya döndürür).
 */
export function buildBalanceSeries(
  trns: TrnItem[],
  walletId: string,
  currentBalance: number,
): BalancePoint[] {
  const sorted = trns.toSorted((a, b) => a.date - b.date)
  if (!sorted.length)
    return []

  // Sondan başa: bakiye_i = bakiye_{i+1} - etki_{i+1}
  const points: BalancePoint[] = []
  let running = currentBalance
  for (let i = sorted.length - 1; i >= 0; i--) {
    points.unshift({ date: sorted[i]!.date, balance: running })
    running = subMoney(running, signedAmount(sorted[i]!, walletId))
  }
  // Dönemin başındaki (ilk işlemden önceki) bakiye
  points.unshift({ date: sorted[0]!.date - DAY_MS, balance: running })
  return points
}
