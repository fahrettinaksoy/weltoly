import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import { emitTableChange, getDb, isTauriRuntime, type Row } from '@/services/db'

const TABLES = ['wallets', 'categories', 'tags', 'trns', 'user_settings', 'rates'] as const

export type BackupResult = 'ok' | 'cancel' | 'error'

/** Tüm tabloları JSON'a aktarır; kullanıcının seçtiği yere kaydeder. */
export async function exportBackup(): Promise<BackupResult> {
  if (!isTauriRuntime())
    return 'error'

  try {
    const db = await getDb()
    const data: Record<string, unknown> = { app: 'weltoly', version: 1, exportedAt: Date.now() }
    for (const t of TABLES)
      data[t] = await db.select<Row[]>(`SELECT * FROM ${t}`)

    const path = await save({
      defaultPath: `weltoly-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path)
      return 'cancel'

    await writeTextFile(path, JSON.stringify(data, null, 2))
    return 'ok'
  }
  catch (e) {
    console.error('[backup] export failed', e)
    return 'error'
  }
}

/** JSON yedeğini içeri alır: her tablo silinip yeniden yazılır (replace). */
export async function importBackup(): Promise<BackupResult> {
  if (!isTauriRuntime())
    return 'error'

  try {
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!path || typeof path !== 'string')
      return 'cancel'

    const text = await readTextFile(path)
    const data = JSON.parse(text) as Record<string, unknown>

    const db = await getDb()
    for (const t of TABLES) {
      const rows = data[t]
      if (!Array.isArray(rows))
        continue
      await db.execute(`DELETE FROM ${t}`)
      for (const row of rows as Row[]) {
        const cols = Object.keys(row)
        if (!cols.length)
          continue
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
        const quoted = cols.map(c => `"${c}"`).join(', ')
        await db.execute(
          `INSERT INTO ${t} (${quoted}) VALUES (${placeholders})`,
          cols.map(c => (row as Row)[c]),
        )
      }
    }

    emitTableChange(...TABLES) // store'lar yeniden sorgulasın
    return 'ok'
  }
  catch (e) {
    console.error('[backup] import failed', e)
    return 'error'
  }
}
