import { defineStore } from 'pinia'

import {
  deleteRow, resolveWriteUid, rowToTag, tagToRow, upsertRow,
  watchTable, type Row, type WatchHandle,
} from '@/services/db'

import type { Tags, TagId, TagItem } from '@/features/tags/types'
import { useTrnsStore } from '@/features/trns/store'
import { showErrorToast } from '@/stores/ui'

export const useTagsStore = defineStore('tags', () => {
  const items = ref<Tags>({})
  const isLoaded = ref(false)

  let watchController: WatchHandle | null = null

  const hasItems = computed(() => Object.keys(items.value).length > 0)

  // Ada göre alfabetik sıralı id listesi.
  const sortedIds = computed<TagId[]>(() =>
    Object.keys(items.value).sort((a, b) =>
      (items.value[a]?.name ?? '').localeCompare(items.value[b]?.name ?? ''),
    ),
  )

  function initTags(): void {
    watchController?.abort()
    isLoaded.value = false
    watchController = watchTable<Row>('SELECT * FROM tags', [], (rows) => {
      isLoaded.value = true
      const map: Tags = {}
      for (const row of rows)
        map[row.id] = rowToTag(row)
      items.value = map
    })
  }

  function setTags(values: Tags) {
    items.value = values
  }

  /** Var olan etiket id'lerini süz (bilinmeyenleri at) — çip gösteriminde kullanılır. */
  function resolveIds(ids: TagId[] | undefined): TagId[] {
    if (!ids?.length)
      return []
    return ids.filter(id => items.value[id])
  }

  function saveTag({ id, values }: { id: TagId, values: TagItem }) {
    const prev = items.value
    const next: TagItem = { ...values, name: values.name.trim(), updatedAt: Date.now() }
    setTags({ ...items.value, [id]: next })

    return upsertRow('tags', id, tagToRow(next, resolveWriteUid(null))).catch((e) => {
      setTags(prev)
      console.error('[tags] saveTag failed', e)
      showErrorToast('tags.errors.saveFailed')
    })
  }

  function deleteTag(id: TagId) {
    const trnsStore = useTrnsStore()
    const prev = items.value
    const next = { ...items.value }
    delete next[id]
    setTags(next)

    // Bu etiketi kullanan işlemlerden temizle (dangling ref bırakma).
    const trns = trnsStore.items
    if (trns) {
      for (const trnId in trns) {
        const trn = trns[trnId]
        if (trn?.tagIds?.includes(id)) {
          const tagIds = trn.tagIds.filter(t => t !== id)
          trnsStore.saveTrn({ id: trnId, values: { ...trn, tagIds } })
        }
      }
    }

    return deleteRow('tags', id).catch((e) => {
      setTags(prev)
      console.error('[tags] deleteTag failed', e)
      showErrorToast('tags.errors.deleteFailed')
    })
  }

  return {
    items,
    isLoaded,
    hasItems,
    sortedIds,
    initTags,
    setTags,
    resolveIds,
    saveTag,
    deleteTag,
  }
})
