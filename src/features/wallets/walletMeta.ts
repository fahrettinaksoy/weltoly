import type { WalletType } from '@/features/wallets/types'
import { walletTypes } from '@/features/wallets/types'

/** Cüzdan tipi → MDI ikon. Etiketler i18n'den (wallets.types.*). */
export const walletTypeIcon: Record<WalletType, string> = {
  cash: 'mdi-cash',
  credit: 'mdi-credit-card-outline',
  cashless: 'mdi-bank-outline',
  deposit: 'mdi-piggy-bank-outline',
  crypto: 'mdi-bitcoin',
  debt: 'mdi-hand-coin-outline',
}

export const walletTypeList = walletTypes

/**
 * Cüzdanın gösterilecek ikonu: kullanıcı seçtiyse o, seçmediyse türün varsayılanı.
 * Tek kaynak — çağıranlar '|| walletTypeIcon[type]' fallback'ini tekrarlamasın,
 * yoksa biri güncellenip diğeri unutulur.
 */
export function walletIcon(wallet: { icon?: string, type: WalletType }): string {
  return wallet.icon || walletTypeIcon[wallet.type]
}
