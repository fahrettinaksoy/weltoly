import { TrnType, type TrnItem } from '@/features/trns/types'

import type { WalletId } from '@/features/wallets/types'

/**
 * Bir işlemin dokunduğu cüzdan(lar).
 *
 * Transfer İKİ cüzdana birden dokunur (gönderen + alan); diğer işlemler tek.
 * Aynı cüzdana transfer (uçta olabilir) tek kez döner — yoksa sayımlarda
 * çift görünürdü.
 *
 * Tek kaynak: hem "cüzdanı silerken hangi işlemler birlikte silinir"
 * (wallets/store → referencingTrnIds) hem de "bu cüzdanda kaç işlem var"
 * (WalletsPage → işlem adedi) bunu kullanır. Kural iki yerde tanımlansaydı
 * biri güncellenip diğeri unutulurdu.
 */
export function walletIdsOfTrn(trn: TrnItem): WalletId[] {
  if (trn.type === TrnType.Transfer) {
    return trn.expenseWalletId === trn.incomeWalletId
      ? [trn.expenseWalletId]
      : [trn.expenseWalletId, trn.incomeWalletId]
  }
  return [trn.walletId]
}
