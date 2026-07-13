import { defineStore } from 'pinia'

import {
  deleteRow, resolveWriteUid, trnToRow, upsertRow, watchTable, type Row, type WatchHandle,
} from '@/services/db'

import type { Range } from '@/features/date/types'
import type { TrnId, TrnItem, TrnItemFull, Trns, TrnsGetterProps } from '@/features/trns/types'

import { useCategoriesStore } from '@/features/categories/store'
import { getEndOf, getStartOf } from '@/features/date/utils'
import { filterTrnsIds } from '@/features/trns/getTrns'
import { reconcileTrns, rowsToTrns } from '@/features/trns/reconcile'
import { TrnType } from '@/features/trns/types'
import { useWalletsStore } from '@/features/wallets/store'
import { showErrorToast } from '@/stores/ui'

// trns en büyük tablo; watch'ı 30ms varsayılandan daha agresif birleştirir.
const TRNS_WATCH_THROTTLE_MS = 120

export const useTrnsStore = defineStore('trns', () => {
  const categoriesStore = useCategoriesStore()
  const walletsStore = useWalletsStore()

  const items = shallowRef<Trns | null>(null)
  const isLoaded = ref(false)

  let watchController: WatchHandle | null = null

  function getStoreTrnsIds(props: TrnsGetterProps) {
    return filterTrnsIds({
      ...props,
      categoriesIds: props.categoriesIds?.length
        ? categoriesStore.getTransactibleIds(props.categoriesIds)
        : props.categoriesIds,
      trnsItems: items.value ?? undefined,
    })
  }

  function getRange(trnsIds: TrnId[]): Range {
    if (!items.value || !trnsIds.length) {
      return {
        end: getEndOf(new Date(), 'day').getTime(),
        start: getStartOf(new Date(), 'day').getTime(),
      }
    }
    let min = Infinity
    let max = -Infinity
    for (const id of trnsIds) {
      const date = items.value[id]?.date
      if (date != null) {
        if (date < min)
          min = date
        if (date > max)
          max = date
      }
    }
    return {
      end: max !== -Infinity ? max : getEndOf(new Date(), 'day').getTime(),
      start: min !== Infinity ? min : getStartOf(new Date(), 'day').getTime(),
    }
  }

  const hasItems = computed(() => Object.keys(items.value ?? {}).length > 0)

  const lastCreatedTrnId = computed<TrnId | undefined>(() => {
    if (!hasItems.value)
      return undefined
    let latestId: TrnId | undefined
    let latestDate = -1
    for (const trnId of Object.keys(items.value!)) {
      const trn = items.value![trnId]
      if (!trn || trn.type === TrnType.Transfer || trn.categoryId === 'adjustment')
        continue
      if (trn.date > latestDate) {
        latestDate = trn.date
        latestId = trnId
      }
    }
    return latestId
  })

  const lastCreatedTrnItem = computed<TrnItem | undefined>(() =>
    lastCreatedTrnId.value ? items.value?.[lastCreatedTrnId.value] : undefined,
  )

  function setTrns(values: Trns | null) {
    items.value = values
  }

  function initTrns(): void {
    watchController?.abort()
    isLoaded.value = false
    watchController = watchTable<Row>('SELECT * FROM trns', [], (rows) => {
      isLoaded.value = true
      const prev = items.value
      const next = prev ? reconcileTrns(prev, rows) : rowsToTrns(rows)
      if (next !== prev)
        setTrns(next)
    }, TRNS_WATCH_THROTTLE_MS)
  }

  function saveTrn({ id, values }: { id: TrnId, values: TrnItem }) {
    const valuesWithEditDate = { ...values, updatedAt: Date.now() }
    const prev = items.value
    setTrns({ ...(items.value ?? {}), [id]: valuesWithEditDate })

    upsertRow('trns', id, trnToRow(valuesWithEditDate, resolveWriteUid(null))).catch((e) => {
      setTrns(prev)
      console.error('[trns] saveTrn failed', e)
      showErrorToast('trns.errors.saveFailed')
    })
  }

  function deleteTrn(id: TrnId) {
    const prev = items.value
    const trns = { ...(items.value ?? {}) }
    delete trns[id]
    setTrns(trns)

    deleteRow('trns', id).catch((e) => {
      setTrns(prev)
      console.error('[trns] deleteTrn failed', e)
      showErrorToast('trns.errors.deleteFailed')
    })
  }

  /** Yalnız bellekten sil (cüzdan/kategori silindiğinde kullanılır). */
  function removeTrnsFromStore(trnsIds: TrnId[]) {
    if (!items.value)
      return
    const trns = { ...items.value }
    for (const id of trnsIds)
      delete trns[id]
    setTrns(trns)
  }

  function computeTrnItem(id: TrnId): TrnItemFull | null {
    if (!items.value || !walletsStore.items || !categoriesStore.items)
      return null

    const trn = items.value[id]
    if (!trn)
      return null

    let category = categoriesStore.items[trn.categoryId]
    let categoryParent: typeof category | undefined

    if (!category) {
      if (trn.categoryId === 'transfer' || trn.categoryId === 'adjustment') {
        category = trn.categoryId === 'transfer'
          ? { color: '', icon: 'mdi-swap-horizontal', name: 'Transfer', parentId: 0, showInLastUsed: false, showInQuickSelector: false }
          : { color: '', icon: 'mdi-scale-balance', name: 'Adjustment', parentId: 0, showInLastUsed: false, showInQuickSelector: false }
      }
      else {
        return null
      }
    }
    else if (category.parentId) {
      categoryParent = categoriesStore.items[category.parentId]
      if (!categoryParent)
        return null
    }

    if (trn.type === TrnType.Transfer) {
      const expenseWallet = walletsStore.items[trn.expenseWalletId]
      if (!expenseWallet)
        return null
      const incomeWallet = walletsStore.items[trn.incomeWalletId]
      if (!incomeWallet)
        return null
      return { id, ...trn, category, categoryParent, expenseWallet, incomeWallet }
    }

    const wallet = walletsStore.items[trn.walletId]
    if (!wallet)
      return null
    return { id, ...trn, category, categoryParent, wallet }
  }

  return {
    computeTrnItem,
    deleteTrn,
    getRange,
    getStoreTrnsIds,
    hasItems,
    initTrns,
    isLoaded,
    items,
    lastCreatedTrnId,
    lastCreatedTrnItem,
    removeTrnsFromStore,
    saveTrn,
    setTrns,
  }
})
