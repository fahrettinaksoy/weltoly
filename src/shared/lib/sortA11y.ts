/**
 * Sıralanabilir tablo başlıkları için `aria-sort` (A-4).
 *
 * SORUN: özel `#headers` şablonu Vuetify'ın kendi `VDataTableHeaderCell`'inin
 * YERİNE geçiyor — onunla birlikte erişilebilirliği de siliyor. Elle çizilen
 * `<th>`'de `aria-sort` yok: ekran okuyucu tablonun HANGİ sütuna göre, HANGİ
 * yönde sıralı olduğunu duyuramıyor. Sıralama görsel olarak ikonla belli, ama
 * ikon ekran okuyucuya bir şey söylemez.
 *
 * `aria-sort` yalnız o an sıralı olan sütunda 'ascending'/'descending' olmalı;
 * sıralanabilir ama sırasız sütunlarda 'none'. Sıralanamayan sütunda hiç
 * bulunmamalı (undefined) — 'none' vermek "bu sütun sıralanabilir ama şu an
 * sırasız" demektir ve yanlış beklenti kurar.
 */

/** Vuetify'ın `#headers` slot'undan gelen sortBy öğesi. */
export interface SortItem { key: string, order?: boolean | 'asc' | 'desc' }

export type AriaSort = 'ascending' | 'descending' | 'none' | undefined

export function ariaSort(
  columnKey: unknown,
  sortable: boolean | undefined,
  sortBy: readonly SortItem[] | undefined,
): AriaSort {
  if (!sortable)
    return undefined

  const key = String(columnKey)
  const active = sortBy?.find(s => s.key === key)
  if (!active)
    return 'none'

  // Vuetify order'ı 'asc'|'desc' ya da boolean (true=asc) verebiliyor.
  const desc = active.order === 'desc' || active.order === false
  return desc ? 'descending' : 'ascending'
}
