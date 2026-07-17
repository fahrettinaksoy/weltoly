import type { AddCategoryParams, Categories, CategoryId, CategoryItem } from '@/features/categories/types'
import type { TrnId } from '@/features/trns/types'

import type { Row, WatchHandle } from '@/services/db'

import { defineStore } from 'pinia'
import { ADJUSTMENT_ID, isPseudoCategoryId, TRANSFER_ID } from '@/features/categories/pseudoCategories'

import { compareCategoryIds, computeChildrenDiff, getTransactibleCategoriesIds } from '@/features/categories/utils'
import { useTrnsStore } from '@/features/trns/store'
import { TrnType } from '@/features/trns/types'
import {
  categoryToRow,
  deleteRows,
  isTauriRuntime,
  resolveWriteUid,
  rowToCategory,
  upsertRows,
  watchTable,
} from '@/services/db'
import { logger } from '@/shared/lib/logger'
import { showErrorToast, showSuccessToast } from '@/stores/ui'

const adjustment: CategoryItem = {
  color: '',
  desc: '',
  icon: 'mdi-plus-minus',
  name: 'Adjustment',
  parentId: 0,
  showInLastUsed: false,
  showInQuickSelector: false,
}
const transfer: CategoryItem = {
  color: '',
  desc: '',
  icon: 'mdi-swap-horizontal',
  name: 'Transfer',
  parentId: 0,
  showInLastUsed: false,
  showInQuickSelector: false,
}

export const useCategoriesStore = defineStore('categories', () => {
  const trnsStore = useTrnsStore()

  const items = shallowRef<Categories>({ adjustment, transfer })
  const hasItems = computed(() =>
    Object.keys(items.value).some(id => id !== 'transfer' && id !== 'adjustment'),
  )
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

  const categoriesIds = computed(() => Object.keys(items.value))

  const childrenMap = computed(() => {
    const all = items.value
    const map = new Map<CategoryId, CategoryId[]>()
    for (const id in all) {
      const parentId = all[id]?.parentId
      if (!parentId)
        continue
      const group = map.get(parentId)
      if (group)
        group.push(id)
      else
        map.set(parentId, [id])
    }
    for (const group of map.values())
      group.sort((a, b) => compareCategoryIds(a, b, all))
    return map
  })

  const categoriesRootIds = computed(() => {
    if (!hasItems.value)
      return []
    return categoriesIds.value
      .filter(id => items.value[id]?.parentId === 0 && id !== 'transfer' && id !== 'adjustment')
      .sort((a, b) => compareCategoryIds(a, b, items.value))
  })

  const usedCategoryIds = computed(() => {
    const ids = new Set<string>()
    const trns = trnsStore.items
    if (trns) {
      for (const id in trns) {
        const trn = trns[id]
        if (trn)
          ids.add(trn.categoryId)
      }
    }
    return ids
  })

  const categoriesForBeParent = computed(() => {
    if (!hasItems.value)
      return []
    return categoriesRootIds.value.filter(id => !usedCategoryIds.value.has(id) && id !== 'transfer')
  })

  const transactibleIds = computed(() => getTransactibleCategoriesIds(items.value))
  const transactibleIdsSet = computed(() => new Set(transactibleIds.value))

  const favoriteCategoriesIds = computed(() => {
    if (!hasItems.value)
      return []
    return categoriesIds.value
      .filter(id => items.value[id]?.showInQuickSelector)
      .sort((a, b) => compareCategoryIds(a, b, items.value))
  })

  const recentCategoriesIds = computed(() => {
    if (!hasItems.value || !trnsStore.hasItems)
      return []
    const trnsItems = trnsStore.items
    const maxCategories = Math.min(categoriesIds.value.length, 16)
    const favoriteIds = new Set(favoriteCategoriesIds.value)

    const latestDateByCategory = new Map<CategoryId, number>()
    for (const trnId in trnsItems) {
      const trn = trnsItems[trnId]
      if (!trn || trn.type === TrnType.Transfer || trn.categoryId === ADJUSTMENT_ID)
        continue
      const categoryId = trn.categoryId
      const existing = latestDateByCategory.get(categoryId)
      if (!existing || trn.date > existing)
        latestDateByCategory.set(categoryId, trn.date)
    }

    const sortedEntries = [...latestDateByCategory.entries()].toSorted(([, a], [, b]) => b - a)
    const recentIds: CategoryId[] = []
    for (const [categoryId] of sortedEntries) {
      if (recentIds.length >= maxCategories)
        break
      const category = items.value[categoryId]
      if (!category || !category.showInLastUsed || categoryId === TRANSFER_ID || favoriteIds.has(categoryId))
        continue
      recentIds.push(categoryId)
    }
    return recentIds.sort((a, b) => compareCategoryIds(a, b, items.value))
  })

  const categoriesIdsForTrnValues = computed<CategoryId[]>(() =>
    transactibleIds.value.filter(id => id !== 'transfer'),
  )

  function initCategories(): void {
    watchController?.abort()
    isLoaded.value = false
    watchController = watchTable<Row>(['categories'], 'SELECT * FROM categories', [], (rows) => {
      isLoaded.value = true
      if (!rows.length) {
        setCategories(null)
        return
      }
      const map: Categories = {} as Categories
      for (const row of rows)
        map[row.id] = rowToCategory(row)
      setCategories(map)
    })
  }

  function setCategories(values: Categories | null) {
    items.value = values ? { ...values, adjustment, transfer } : { adjustment, transfer }
  }

  function hasChildren(categoryId: CategoryId) {
    if (!hasItems.value)
      return false
    const category = items.value[categoryId]
    if (!category || category.parentId !== 0)
      return false
    return (childrenMap.value.get(categoryId)?.length ?? 0) > 0
  }

  function getChildrenIds(categoryId: CategoryId) {
    if (!hasItems.value)
      return []
    return childrenMap.value.get(categoryId)?.slice() ?? []
  }

  function getChildrenIdsOrParent(categoryId: CategoryId) {
    const children = getChildrenIds(categoryId)
    return children.length ? children : [categoryId]
  }

  function getTransactibleIds(ids?: CategoryId[]) {
    return getTransactibleCategoriesIds(items.value, ids)
  }

  function isTransactible(categoryId: CategoryId) {
    return transactibleIdsSet.value.has(categoryId)
  }

  function applyOptimisticUpdate(
    id: CategoryId,
    categoryValues: CategoryItem,
    isUpdateChildCategoriesColor: boolean,
    colorPropagationIds: CategoryId[],
    reparent?: { added: CategoryId[], removed: CategoryId[] },
  ) {
    const now = Date.now()
    const updatedItems: Categories = { ...items.value, [id]: { ...categoryValues, updatedAt: now } }

    if (isUpdateChildCategoriesColor && colorPropagationIds.length > 0) {
      for (const childId of colorPropagationIds) {
        if (updatedItems[childId])
          updatedItems[childId] = { ...updatedItems[childId], color: categoryValues.color, updatedAt: now }
      }
    }

    if (reparent) {
      for (const addId of reparent.added) {
        const existing = updatedItems[addId]
        if (!existing)
          continue
        updatedItems[addId] = {
          ...existing,
          color: isUpdateChildCategoriesColor ? categoryValues.color : existing.color,
          parentId: id,
          updatedAt: now,
        }
      }
      for (const removeId of reparent.removed) {
        if (updatedItems[removeId])
          updatedItems[removeId] = { ...updatedItems[removeId], parentId: 0, updatedAt: now }
      }
    }

    setCategories(updatedItems)
  }

  function saveCategory({ id, isUpdateChildCategoriesColor, nextChildIds, values }: AddCategoryParams) {
    // Sentetik kategoriler kullanıcı verisi değil; kaydedilemez/silinemez.
    if (isPseudoCategoryId(id))
      return

    const prev = items.value
    // İyimser güncellemeden ÖNCE bak: sonrası hep "var" görünürdü.
    const isNew = !items.value[id]
    const prevChildIds = getChildrenIds(id)
    const useChildrenDiff = Array.isArray(nextChildIds)
    const diff = useChildrenDiff
      ? computeChildrenDiff(prevChildIds, nextChildIds!)
      : { added: [] as CategoryId[], removed: [] as CategoryId[] }
    const hasChildrenDiff = diff.added.length > 0 || diff.removed.length > 0
    const keptChildIds = useChildrenDiff
      ? prevChildIds.filter(cid => nextChildIds!.includes(cid))
      : prevChildIds

    applyOptimisticUpdate(id, values, isUpdateChildCategoriesColor, keptChildIds, hasChildrenDiff ? diff : undefined)

    const touched = new Set<CategoryId>([id])
    if (isUpdateChildCategoriesColor) {
      for (const cid of keptChildIds) touched.add(cid)
    }
    for (const cid of diff.added) touched.add(cid)
    for (const cid of diff.removed) touched.add(cid)

    const userId = resolveWriteUid(null)
    const rows: { id: CategoryId, row: Record<string, unknown> }[] = []
    for (const cid of touched) {
      const item = items.value[cid]
      if (item)
        rows.push({ id: cid, row: categoryToRow(item, userId) })
    }

    return upsertRows('categories', rows).then(() => {
      showSuccessToast(isNew ? 'categories.added' : 'categories.updated')
    }).catch((e) => {
      setCategories(prev)
      logger.error('[categories] saveCategory failed', e)
      showErrorToast('categories.errors.saveFailed')
    })
  }

  /**
   * Bu kategoriye referans veren işlem id'leri. Store'da durur çünkü hem form
   * hem tablo silme yolunda gerekiyor — kopyalanırsa biri güncellenip diğeri
   * unutulur.
   */
  function referencingTrnIds(categoryId: CategoryId): TrnId[] {
    const trns = trnsStore.items
    if (!trns)
      return []
    const ids: TrnId[] = []
    for (const trnId in trns) {
      if (trns[trnId]?.categoryId === categoryId)
        ids.push(trnId)
    }
    return ids
  }

  /** Kategoriyi ve ona bağlı işlemleri siler; sonucu merkezî kuyrukta bildirir. */
  function deleteCategory(id: CategoryId, trnsIds: TrnId[] = referencingTrnIds(id)) {
    if (isPseudoCategoryId(id))
      return

    const prevCategories = items.value
    const prevTrns = trnsStore.items
    const categories = { ...items.value }
    delete categories[id]
    setCategories(categories)

    if (trnsIds.length)
      trnsStore.removeTrnsFromStore(trnsIds)

    // TEK transaction: kategori + işlemleri ya hep ya hiç (bkz. deleteRows).
    // İşlemler kategoriden ÖNCE — FK açıldığında bu sıra şart olacak.
    return deleteRows([
      ...trnsIds.map(trnId => ({ table: 'trns', id: trnId })),
      { table: 'categories', id },
    ]).then(() => {
      showSuccessToast('categories.deleted')
    }).catch((e) => {
      setCategories(prevCategories)
      trnsStore.setTrns(prevTrns)
      logger.error('[categories] deleteCategory failed', e)
      showErrorToast('categories.errors.deleteFailed')
    })
  }

  return {
    categoriesForBeParent,
    categoriesIdsForTrnValues,
    categoriesRootIds,
    deleteCategory,
    referencingTrnIds,
    favoriteCategoriesIds,
    getChildrenIds,
    getChildrenIdsOrParent,
    getTransactibleIds,
    hasChildren,
    hasItems,
    initCategories,
    isLoaded,
    isTransactible,
    items,
    recentCategoriesIds,
    saveCategory,
    setCategories,
  }
})
