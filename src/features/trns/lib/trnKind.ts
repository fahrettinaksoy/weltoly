import type { TrnItem } from '@/features/trns/types'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'
import { TrnType } from '@/features/trns/types'

/**
 * İşlem TÜRÜ (tabloda gösterilen ayrım) — TEK KAYNAK (Y-7).
 *
 * WalletDetailPage ve TransactionsPage içinde birebir kopya olarak duruyordu.
 *
 * TrnType'ın AYNISI DEĞİL: düzeltme (açılış bakiyesi vb.) TrnType olarak
 * Income/Expense taşır ama gelir/gider SAYILMAZ — akış hesapları onu hariç
 * tutuyor. Türü doğrudan trn.type'tan okusaydık 68.000'lik bir açılış kaydına
 * "Gelir" yazardı, üstteki gelir toplamı ise onu saymazdı: aynı ekranda iki
 * çelişen rakam. Bu yüzden düzeltme AYRI bir tür.
 */
export type TrnKind = 'income' | 'expense' | 'transfer' | 'adjustment'

/** Sıra önemli: düzeltme trn.type'ında Income/Expense görünür, ÖNCE elenmeli. */
export function trnKind(trn: TrnItem): TrnKind {
  if (trn.categoryId === ADJUSTMENT_ID)
    return 'adjustment'
  if (trn.type === TrnType.Transfer)
    return 'transfer'
  return trn.type === TrnType.Income ? 'income' : 'expense'
}

/** Tür rozetinin görünümü. Ok yönü CÜZDAN BAKIŞ AÇISI: giren ↙, çıkan ↗. */
export const KIND_META: Record<TrnKind, { color: string, icon: string }> = {
  income: { color: 'success', icon: 'mdi-arrow-bottom-left' },
  expense: { color: 'error', icon: 'mdi-arrow-top-right' },
  transfer: { color: 'info', icon: 'mdi-swap-horizontal' },
  adjustment: { color: 'grey', icon: 'mdi-scale-balance' },
}

/** Tür etiketinin i18n anahtarı. 'adjustment' trnForm altında yok, ayrı yerde. */
export function trnKindLabelKey(kind: TrnKind): string {
  return kind === 'adjustment' ? 'walletDetail.adjustment' : `trnForm.${kind}`
}
