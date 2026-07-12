import { getDb } from './client'
import { onTableChange } from './bus'
import type { Row } from './transforms'

/** Sorgudaki FROM/JOIN tablolarını çıkar (basit tek-tablo select'lerimiz için yeterli). */
function parseTables(query: string): string[] {
  const tables = new Set<string>()
  const re = /(?:from|join)\s+["'`]?(\w+)/gi
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(query)))
    tables.add(m[1]!)
  return [...tables]
}

export type WatchHandle = { abort: () => void }

/**
 * PowerSync `watchTable` taklidi: sorguyu hemen çalıştırır, sonra ilgili tablo(lar)
 * değiştikçe yeniden çalıştırıp `onResult` çağırır. `throttleMs` ile ardışık
 * değişiklikler tek bir sona-yaslanmış çalıştırmada birleştirilir.
 *
 * Store'lar iyimser güncelleme yaptığından yeniden-sorgu ekosunun gecikmesi görünmez.
 * finapp store'larıyla uyumlu imza: dönüşte `.abort()` bulunur.
 */
export function watchTable<T = Row>(
  query: string,
  params: unknown[],
  onResult: (rows: T[]) => void,
  throttleMs = 30,
): WatchHandle {
  const tables = parseTables(query)
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
