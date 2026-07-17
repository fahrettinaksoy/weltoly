import type { Range } from '@/features/date/types'
import type { TrnId, TrnItem, TrnItemFull, Trns, TrnsGetterProps } from '@/features/trns/types'

import type { Row, WatchHandle } from '@/services/db'

import { defineStore } from 'pinia'
import { ADJUSTMENT_ID } from '@/features/categories/pseudoCategories'

import { resolvePseudoCategory } from '@/features/categories/pseudoCategoryItem'
import { useCategoriesStore } from '@/features/categories/store'
import { getEndOf, getStartOf } from '@/features/date/utils'
import { filterTrnsIds } from '@/features/trns/getTrns'
import { reconcileTrns, rowsToTrns } from '@/features/trns/reconcile'
import { TrnType } from '@/features/trns/types'
import { useWalletsStore } from '@/features/wallets/store'
import {
  deleteRow,
  isTauriRuntime,
  resolveWriteUid,
  trnToRow,
  upsertRow,
  watchTable,
} from '@/services/db'
import { logger } from '@/shared/lib/logger'
import { showErrorToast, showSuccessToast } from '@/stores/ui'

// trns en büyük tablo; watch'ı 30ms varsayılandan daha agresif birleştirir.
const TRNS_WATCH_THROTTLE_MS = 120

export const useTrnsStore = defineStore('trns', () => {
  const categoriesStore = useCategoriesStore()
  const walletsStore = useWalletsStore()

  const items = shallowRef<Trns | null>(null)
  /**
   * İlk DB okuması döndü mü? UI bunu "veri yok" ile karıştırmamak için okur:
   * yüklenirken skeleton, yüklendikten sonra veri ya da dürüst boş durum.
   *
   * Başlangıç `!isTauriRuntime()`: saf tarayıcıda (npm run dev) SQLite yoktur,
   * store hiç init edilmez → yükleme baştan bitmiştir. `false` bırakılsaydı
   * tarayıcıda skeleton SONSUZA DEK dönerdi.
   */
  const isLoaded = ref(!isTauriRuntime())

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
      if (!trn || trn.type === TrnType.Transfer || trn.categoryId === ADJUSTMENT_ID)
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
    watchController = watchTable<Row>(['trns'], 'SELECT * FROM trns', [], (rows) => {
      isLoaded.value = true
      const prev = items.value
      const next = prev ? reconcileTrns(prev, rows) : rowsToTrns(rows)
      if (next !== prev)
        setTrns(next)
    }, TRNS_WATCH_THROTTLE_MS)
  }

  /**
   * İşlemi kaydeder (iyimser). `silent`: bildirim gösterme — kullanıcı eylemi
   * olmayan iç yazımlar için ŞART: örn. bir etiket silinince onu kullanan her
   * işlem güncellenir; sessiz olmasa tek silme onlarca snackbar patlatırdı.
   *
   * DÖNÜŞ (O-7): başarı bayrağı. Hata burada YUTULUR (rollback + toast) ama
   * çağıranın sonucu görmesi gerekir — örn. tags.deleteTag, referans temizliği
   * başarısızsa etiketi SİLMEMELİ, yoksa dangling tagId kalır.
   */
  function saveTrn({ id, values, silent = false }: { id: TrnId, values: TrnItem, silent?: boolean }): Promise<boolean> {
    const valuesWithEditDate = { ...values, updatedAt: Date.now() }
    const prev = items.value
    const isNew = !items.value?.[id]
    setTrns({ ...(items.value ?? {}), [id]: valuesWithEditDate })

    return upsertRow('trns', id, trnToRow(valuesWithEditDate, resolveWriteUid(null))).then(() => {
      if (!silent)
        showSuccessToast(isNew ? 'trns.added' : 'trns.updated')
      return true
    }).catch((e) => {
      setTrns(prev)
      logger.error('[trns] saveTrn failed', e)
      showErrorToast('trns.errors.saveFailed')
      return false
    })
  }

  function deleteTrn(id: TrnId) {
    const prev = items.value
    const trns = { ...(items.value ?? {}) }
    delete trns[id]
    setTrns(trns)

    deleteRow('trns', id).catch((e) => {
      setTrns(prev)
      logger.error('[trns] deleteTrn failed', e)
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
      // Sentetik kategoriler (transfer/adjustment) categories tablosunda YOK —
      // tek kaynaktan üretilir; adları i18n'den gelir (O-10).
      const pseudo = resolvePseudoCategory(trn.categoryId)
      if (!pseudo)
        return null
      category = pseudo
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
