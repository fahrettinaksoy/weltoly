import type { CurrencyCode } from '@/features/currencies/types'

import { z } from 'zod'

import { colorsArray } from '@/features/color/colors'
import { random } from '@/shared/lib/random'

export const walletTypes = ['cash', 'credit', 'cashless', 'deposit', 'crypto', 'debt'] as const
export type WalletType = (typeof walletTypes)[number]

export type WalletId = string

export type WalletViewTypes =
  WalletType | 'isAvailable' | 'isWithdrawal' | 'isArchived' | 'isExcludeInTotal'

const walletBaseSchema = z.object({
  color: z.string().default(() => random(colorsArray)),
  currency: z.string().default('USD'),
  desc: z.string().default(''),
  /** '' = seçilmedi → tür varsayılanına düşer (walletMeta.walletIcon). */
  icon: z.string().default(''),
  isArchived: z.boolean().default(false),
  isExcludeInTotal: z.boolean().default(false),
  isWithdrawal: z.boolean().default(false),
  name: z.string().trim().min(1).default(''),
  order: z.number().default(0),
  updatedAt: z.number().default(() => Date.now())
})

export const walletItemSchema = z.discriminatedUnion('type', [
  z.object({
    ...walletBaseSchema.shape,
    creditLimit: z.number().default(0),
    type: z.literal('credit')
  }),
  z.object({
    ...walletBaseSchema.shape,
    type: z.enum(walletTypes.filter((t) => t !== 'credit'))
  })
])

export type WalletItem = z.infer<typeof walletItemSchema>
export type WalletItemComputed = WalletItem & {
  amount: number
  // Cüzdan para biriminin base'e kuru. null = kur eksik (base'e çevrilemiyor) — Y-1.
  rate?: number | null
}

export type Wallets = Record<WalletId, WalletItem>
export type WalletsComputed = Record<WalletId, WalletItemComputed>

export type WalletsGroupedBy = 'type' | 'currency' | 'none'
export type WalletsCurrencyFiltered = 'all' | CurrencyCode

/**
 * Kullanılabilir kredi: limit eksi KULLANILAN tutar.
 *
 * Kredi cüzdanında bakiye borcu NEGATİF tutar olarak taşır: −500 = 500 borç.
 * Kullanılan tutar bu yüzden `max(0, -amount)`.
 *
 * Eskiden `Math.abs(amount)` kullanılıyordu ve FAZLA ÖDEMEDE yanlış sonuç
 * veriyordu: bakiye +500 (kullanıcı borcundan fazlasını yatırmış, kartta 500
 * alacağı var) iken `abs(500)=500` çıkarılıyor, limit 5.000 için kullanılabilir
 * kredi 4.500 görünüyordu — oysa hiç borç yok, tamamı (hatta fazlası)
 * kullanılabilir. Pozitif bakiye borç DEĞİLDİR; `max(0, ...)` onu 0 kullanım
 * sayar ve limit tam görünür.
 */
export function getCreditAvailable(creditLimit: number, amount: number): number {
  return creditLimit - Math.max(0, -amount)
}
