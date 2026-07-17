import type { TableName } from './schema'
import type { Row } from './transforms'
import { onTableChange } from './bus'
import { getDb } from './client'

export interface WatchHandle { abort: () => void }

/**
 * PowerSync `watchTable` taklidi: sorguyu hemen çalıştırır, sonra `tables`
 * değiştikçe yeniden çalıştırıp `onResult` çağırır. `throttleMs` ile ardışık
 * değişiklikler tek bir sona-yaslanmış çalıştırmada birleştirilir.
 *
 * `tables` AÇIKÇA verilir (O-3). Eskiden sorgu metninden regex ile TAHMİN
 * ediliyordu (`/(?:from|join)\s+(\w+)/`); alt sorgu, CTE veya takma adlı bir
 * sorguda yanlış tablo çıkarır ya da bir bağımlılığı tümden kaçırırdı — sonuç
 * SESSİZ: ekran güncellenmez, hata da vermez. Bağımlılığı çağıran bildirir.
 *
 * Store'lar iyimser güncelleme yaptığından yeniden-sorgu ekosunun gecikmesi görünmez.
 * Dönüşte `.abort()` bulunur.
 */
export function watchTable<T = Row>(
  tables: TableName[],
  query: string,
  params: unknown[],
  onResult: (rows: T[]) => void,
  throttleMs = 30,
): WatchHandle {
  let aborted = false
  let pending = false
  let timer: ReturnType<typeof setTimeout> | null = null

  async function run() {
    if (aborted)
      return
    try {
      const db = await getDb()
      const rows = await db.select<T[]>(query, params)
      if (!aborted)
        onResult(rows)
    }
    catch (e) {
      // Tauri dışı ortamda (saf web) plugin yok; sessizce logla.
      console.error('[db] watch query failed:', query, e)
    }
  }

  function schedule() {
    if (aborted)
      return
    if (throttleMs <= 0) {
      run()
      return
    }
    if (pending)
      return
    pending = true
    timer = setTimeout(() => {
      pending = false
      run()
    }, throttleMs)
  }

  run() // ilk yükleme hemen
  const off = onTableChange(tables, schedule)

  return {
    abort() {
      aborted = true
      off()
      if (timer)
        clearTimeout(timer)
    },
  }
}
