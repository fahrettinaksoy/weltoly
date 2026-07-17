import type { TagId, TagItem, Tags } from '@/features/tags/types'

import type { Row, WatchHandle } from '@/services/db'

import { defineStore } from 'pinia'
import { useTrnsStore } from '@/features/trns/store'
import {
  deleteRow,
  isTauriRuntime,
  resolveWriteUid,
  rowToTag,
  tagToRow,
  upsertRow,
  watchTable,
} from '@/services/db'
import { showErrorToast, showSuccessToast } from '@/stores/ui'

export const useTagsStore = defineStore('tags', () => {
  const items = ref<Tags>({})
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
    watchController = watchTable<Row>(['tags'], 'SELECT * FROM tags', [], (rows) => {
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
    // İyimser güncellemeden ÖNCE bak: sonrası hep "var" görünürdü.
    const isNew = !items.value[id]
    const next: TagItem = { ...values, name: values.name.trim(), updatedAt: Date.now() }
    setTags({ ...items.value, [id]: next })

    return upsertRow('tags', id, tagToRow(next, resolveWriteUid(null))).then(() => {
      showSuccessToast(isNew ? 'tags.added' : 'tags.updated')
    }).catch((e) => {
      setTags(prev)
      console.error('[tags] saveTag failed', e)
      showErrorToast('tags.errors.saveFailed')
    })
  }

  /**
   * Etiketi siler ve onu kullanan işlemlerden referansını temizler.
   *
   * SIRA ŞART (O-7): eskiden N adet `saveTrn` ateşlenip BEKLENMEDEN
   * `deleteRow` çağrılıyordu. İki sonucu vardı:
   *  - Yarış: etiket satırı, referanslar temizlenmeden silinebiliyordu.
   *  - Sessiz sapma: bir saveTrn başarısız olsa bile etiket yine siliniyor,
   *    geriye var olmayan bir etikete işaret eden tagId'ler kalıyordu.
   * Artık: önce TÜM referans temizlikleri beklenir, hepsi başarılıysa silinir.
   */
  async function deleteTag(id: TagId) {
    const trnsStore = useTrnsStore()
    const prev = items.value
    const prevTrns = trnsStore.items
    const next = { ...items.value }
    delete next[id]
    setTags(next)

    // 1) Referansları temizle — hepsini BEKLE.
    const trns = trnsStore.items
    const updates: Promise<boolean>[] = []
    if (trns) {
      for (const trnId in trns) {
        const trn = trns[trnId]
        if (trn?.tagIds?.includes(id)) {
          const tagIds = trn.tagIds.filter(t => t !== id)
          // silent: bu kullanıcının "işlem kaydet"i değil, silinen etiketin temizliği
          updates.push(trnsStore.saveTrn({ id: trnId, values: { ...trn, tagIds }, silent: true }))
        }
      }
    }

    const results = await Promise.all(updates)
    if (results.includes(false)) {
      // Temizlik eksik kaldı → etiketi SİLME, dangling referans bırakmaktansa
      // her şeyi geri al.
      setTags(prev)
      trnsStore.setTrns(prevTrns)
      showErrorToast('tags.errors.deleteFailed')
      return
    }

    // 2) Referanslar temiz — şimdi sil.
    try {
      await deleteRow('tags', id)
      showSuccessToast('tags.deleted')
    }
    catch (e) {
      setTags(prev)
      trnsStore.setTrns(prevTrns)
      console.error('[tags] deleteTag failed', e)
      showErrorToast('tags.errors.deleteFailed')
    }
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
