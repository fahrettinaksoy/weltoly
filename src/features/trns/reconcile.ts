import type { Trns } from '@/features/trns/types'

import type { Row } from '@/services/db'
import { rowToTrn, ts } from '@/services/db'

/** Tam satır anlık görüntüsünden yeni bir trns haritası kur (ilk yükleme). */
export function rowsToTrns(rows: Row[]): Trns | null {
  if (!rows.length) return null
  const map: Trns = {}
  for (const row of rows) map[row.id] = rowToTrn(row)
  return map
}

/**
 * Watch'tan gelen tam satır anlık görüntüsünü önceki item haritasıyla uzlaştır.
 * - Hiçbir şey değişmediyse `prev`'i (aynı referans) döndürür → çağıran güncellemeyi atlar
 *   (kendi iyimser yazımızın ekosunu bastırır).
 * - Aksi halde değişmeyen satırlar için eski nesneyi yeniden kullanır (updatedAt eşleşmesi),
 *   böylece O(N) rowToTrn yalnız gerçekten değişen satırlar için çalışır.
 */
export function reconcileTrns(prev: Trns, rows: Row[]): Trns | null {
  let dirty = rows.length !== Object.keys(prev).length
  if (!dirty) {
    for (const row of rows) {
      const existing = prev[row.id]
      if (!existing || existing.updatedAt !== ts(row.updatedAt)) {
        dirty = true
        break
      }
    }
  }
  if (!dirty) return prev

  if (!rows.length) return null

  const next: Trns = {}
  for (const row of rows) {
    const existing = prev[row.id]
    next[row.id] = existing && existing.updatedAt === ts(row.updatedAt) ? existing : rowToTrn(row)
  }
  return next
}
