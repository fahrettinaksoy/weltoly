import type { CurrencyCode } from '@/features/currencies/types'

import type { TrnId } from '@/features/trns/types'
import type { WalletId, WalletItem, WalletItemComputed, Wallets, WalletsComputed } from '@/features/wallets/types'
import type { Row, WatchHandle } from '@/services/db'
import { defineStore } from 'pinia'
import { useCurrenciesStore } from '@/features/currencies/store'

import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import { useUserStore } from '@/features/user/store'

import { walletIdsOfTrn } from '@/features/wallets/trnLink'
import {
  deleteRow,
  resolveWriteUid,
  rowToWallet,
  upsertRow,
  upsertRows,
  walletToRow,
  watchTable,
} from '@/services/db'
import { getAmountInRate, getWalletsTotals } from '@/shared/lib/getTotal'
import { addMoney, subMoney } from '@/shared/lib/money'
import { uniqueElementsBy } from '@/shared/lib/simple'
import { showErrorToast, showSuccessToast } from '@/stores/ui'

function rowsToWallets(rows: Row[]): Wallets | null {
  if (!rows.length)
    return null
  const map: Wallets = {}
  for (const row of rows)
    map[row.id] = rowToWallet(row)
  return map
}

export const useWalletsStore = defineStore('wallets', () => {
  const trnsStore = useTrnsStore()
  const currenciesStore = useCurrenciesStore()

  const items = shallowRef<Wallets | null>(null)
  const hasItems = computed(() => Object.keys(items.value ?? {}).length > 0)
  const isLoaded = ref(false)

  let watchController: WatchHandle | null = null

  function setWallets(values: Wallets | null) {
    items.value = values
  }

  /** Yerel SQLite'a abone ol. İlk yüklemede ve her yazımda tetiklenir. */
  function initWallets(): void {
    watchController?.abort()
    isLoaded.value = false
    watchController = watchTable<Row>(['wallets'], 'SELECT * FROM wallets', [], (rows) => {
      isLoaded.value = true
      setWallets(rowsToWallets(rows))
    })
  }

  function saveWallet({ id, values }: { id: WalletId, values: WalletItem }) {
    // İlk cüzdanın para birimi varsayılan temel para birimi olur.
    if (!hasItems.value)
      useUserStore().saveUserBaseCurrency(values.currency)

    const isNew = !(items.value && id in items.value)
    if (isNew) {
      const maxOrder = Object.values(items.value ?? {}).reduce((max, w) => Math.max(max, w.order ?? 0), -1)
      values = { ...values, order: maxOrder + 1 }
    }

    const prev = items.value
    // İyimser güncelleme (anında UI). Watch aynı şekli yeniden yayar.
    setWallets({ ...(items.value ?? {}), [id]: values })

    return upsertRow('wallets', id, walletToRow(values, resolveWriteUid(null))).then(() => {
      showSuccessToast(isNew ? 'wallets.added' : 'wallets.updated')
    }).catch((e) => {
      setWallets(prev)
      console.error('[wallets] saveWallet failed', e)
      showErrorToast('wallets.errors.saveFailed')
    })
  }

  function saveWalletsOrder(ids: WalletId[]) {
    const prev = items.value
    const updated = { ...(items.value ?? {}) } as Wallets
    for (let i = 0; i < ids.length; i++) {
      const walletId = ids[i]!
      if (updated[walletId])
        updated[walletId] = { ...updated[walletId]!, order: i }
    }
    setWallets(updated)

    upsertRows(
      'wallets',
      ids
        .filter(walletId => items.value?.[walletId])
        .map((walletId, index) => ({
          id: walletId,
          row: walletToRow({ ...items.value![walletId]!, order: index }, resolveWriteUid(null)),
        })),
    ).catch((e) => {
      setWallets(prev)
      console.error('[wallets] saveWalletsOrder failed', e)
      showErrorToast('wallets.errors.orderFailed')
    })
  }

  const sortedIds = computed(() => {
    if (!hasItems.value)
      return []
    return Object.keys(items.value ?? {}).sort(
      (a, b) => (items.value![a]?.order ?? 0) - (items.value![b]?.order ?? 0),
    )
  })

  const recentWalletIds = computed<WalletId[]>(() => {
    if (!hasItems.value || !trnsStore.hasItems)
      return []

    const trnsItems = trnsStore.items
    const latestDateByWallet = new Map<WalletId, number>()

    for (const trnId in trnsItems) {
      const trn = trnsItems[trnId]
      if (!trn)
        continue

      if (trn.type === TrnType.Transfer) {
        const e1 = latestDateByWallet.get(trn.expenseWalletId)
        if (!e1 || trn.date > e1)
          latestDateByWallet.set(trn.expenseWalletId, trn.date)
        const e2 = latestDateByWallet.get(trn.incomeWalletId)
        if (!e2 || trn.date > e2)
          latestDateByWallet.set(trn.incomeWalletId, trn.date)
      }
      else {
        const e = latestDateByWallet.get(trn.walletId)
        if (!e || trn.date > e)
          latestDateByWallet.set(trn.walletId, trn.date)
      }
    }

    return [...latestDateByWallet.entries()]
      .toSorted(([, a], [, b]) => b - a)
      .map(([id]) => id)
      .filter(id => items.value?.[id])
  })

  const walletTotals = computed(() =>
    getWalletsTotals({
      trnsItems: trnsStore.items ?? {},
      walletsItems: items.value ?? {},
    }),
  )

  const itemsComputed = computed<WalletsComputed>(() =>
    sortedIds.value.reduce((acc, id) => {
      const wallet = items.value?.[id]
      if (!wallet)
        return acc
      acc[id] = {
        ...wallet,
        amount: walletTotals.value.get(id) ?? 0,
        rate: getAmountInRate({
          amount: 1,
          baseCurrencyCode: currenciesStore.base,
          currencyCode: wallet.currency,
          rates: currenciesStore.rates,
        }),
      }
      return acc
    }, {} as Record<WalletId, WalletItemComputed>),
  )

  const currenciesUsed = computed<CurrencyCode[]>(() => uniqueElementsBy(itemsComputed.value, 'currency'))

  /**
   * Varlık / borç / net — temel para biriminde.
   *
   * Varlık ve borç AYRI tutulur: kredi kartı ve kredi cüzdanlarının bakiyesi
   * negatiftir; hepsini tek toplamda eritmek "net"i verir ama dengeyi gizler.
   * Örnek veride net −223.138 çıkıyor, oysa 320.174 varlık var — tek rakam
   * gösteren bir başlık (eski panelin "Toplam bakiye"si) bunu saklıyordu.
   *
   * "Toplamdan hariç tut" işaretli cüzdanlar hiçbir toplama girmez.
   *
   * Store'da durur çünkü hem Cüzdanlar sayfası hem Panel aynı rakamı gösteriyor;
   * iki yerde ayrı hesaplanırsa zamanla sessizce ayrışırlar.
   */
  const totals = computed(() => {
    let assets = 0
    let debts = 0
    let hasMissingRates = false
    for (const wallet of Object.values(itemsComputed.value)) {
      if (wallet.isExcludeInTotal)
        continue
      // Kur eksikse (rate null) cüzdanı NET'e sokma — sessiz 1:1 varsayma (Y-1).
      if (wallet.rate == null) {
        hasMissingRates = true
        continue
      }
      const base = wallet.amount * wallet.rate
      if (base >= 0)
        assets = addMoney(assets, base)
      else debts = subMoney(debts, base) // base<0 → -base ekle
    }
    return { assets, debts, net: subMoney(assets, debts), hasMissingRates }
  })

  /** Borcun varlığa oranı. Varlık 0 iken tanımsız → 0 (sıfıra bölme). */
  const debtRatio = computed(() =>
    totals.value.assets ? (totals.value.debts / totals.value.assets) * 100 : 0,
  )

  /**
   * Bu cüzdana referans veren işlem id'leri. Transferler iki cüzdana birden
   * bakar. Store'da durur çünkü hem form hem tablo silme yolunda gerekiyor —
   * bileşen başına kopyalanırsa biri güncellenip diğeri unutulur.
   */
  function referencingTrnIds(walletId: WalletId): TrnId[] {
    const trns = trnsStore.items
    if (!trns)
      return []
    const ids: TrnId[] = []
    for (const trnId in trns) {
      if (walletIdsOfTrn(trns[trnId]!).includes(walletId))
        ids.push(trnId)
    }
    return ids
  }

  /** Cüzdanı ve ona bağlı işlemleri siler; sonucu merkezî kuyrukta bildirir. */
  async function deleteWallet(id: WalletId, trnsIds: TrnId[] = referencingTrnIds(id)) {
    const prevWallets = items.value
    const prevTrns = trnsStore.items
    const wallets = { ...(items.value ?? {}) }
    delete wallets[id]
    setWallets(wallets)

    if (trnsIds.length)
      trnsStore.removeTrnsFromStore(trnsIds)

    try {
      await Promise.all([
        deleteRow('wallets', id),
        ...trnsIds.map(trnId => deleteRow('trns', trnId)),
      ])

      // Silinen cüzdan varsayılansa işaretçiyi temizle: FK yok, dangling
      // referansı uygulama temizlemezse form var olmayan cüzdanla açılır.
      const userStore = useUserStore()
      if (userStore.defaultWalletId === id)
        userStore.saveDefaultWalletId(null)

      showSuccessToast('wallets.deleted')
    }
    catch (e) {
      setWallets(prevWallets)
      trnsStore.setTrns(prevTrns)
      console.error('[wallets] deleteWallet failed', e)
      showErrorToast('wallets.errors.deleteFailed')
    }
  }

  return {
    currenciesUsed,
    debtRatio,
    deleteWallet,
    referencingTrnIds,
    hasItems,
    initWallets,
    isLoaded,
    items,
    itemsComputed,
    recentWalletIds,
    saveWallet,
    saveWalletsOrder,
    setWallets,
    sortedIds,
    totals,
  }
})
