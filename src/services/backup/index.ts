import type { Row } from '@/services/db'
import { documentDir, join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

import { emitTableChange, getDb, isTauriRuntime } from '@/services/db'
import { BACKUP_TABLES, isKnownColumn, isKnownTable } from '@/services/db/schema'
import { logger } from '@/shared/lib/logger'

// Yedek dosya biçim sürümü. Şema (migration) sürümünden AYRI: dosya düzeni değişince artar.
const BACKUP_VERSION = 1
const APP_TAG = 'weltoly'

export type BackupResult = 'ok' | 'cancel' | 'error'

interface BackupEnvelope {
  app: string
  version: number
  exportedAt: number
  [table: string]: unknown
}

/** Tüm tabloları JSON'a serileştirir (kaydetme yapmaz). Otomatik güvenlik yedeği için de kullanılır. */
async function serializeAll(): Promise<string> {
  const db = await getDb()
  const data: Record<string, unknown> = {
    app: APP_TAG,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
  }
  for (const t of BACKUP_TABLES)
    data[t] = await db.select<Row[]>(`SELECT * FROM ${t}`)
  return JSON.stringify(data, null, 2)
}

/** Tüm tabloları JSON'a aktarır; kullanıcının seçtiği yere kaydeder. */
export async function exportBackup(): Promise<BackupResult> {
  if (!isTauriRuntime())
    return 'error'

  try {
    const json = await serializeAll()
    const fileName = `weltoly-backup-${new Date().toISOString().slice(0, 10)}.json`
    // Varsayılanı izinli bir dizine (Documents) yönlendir — fs scope buranın altını kapsar.
    let defaultPath = fileName
    try {
      defaultPath = await join(await documentDir(), fileName)
    }
    catch { /* documentDir yoksa düz dosya adına düş */ }

    const path = await save({
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path)
      return 'cancel'

    await writeTextFile(path, json)
    return 'ok'
  }
  catch (e) {
    logger.error('[backup] export failed', e)
    return 'error'
  }
}

/**
 * İçe aktarılan zarfı doğrular. DB'ye HİÇBİR şey yazılmadan önce çağrılır — böylece
 * bozuk/uyumsuz dosya, mevcut veriyi silmeden reddedilir.
 * Bilinmeyen kolonlar burada AYIKLANIR (SQL identifier injection'a karşı beyaz liste).
 */
export function parseBackup(text: string): { rows: Record<string, Row[]> } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  }
  catch {
    throw new Error('Geçersiz JSON: dosya okunamadı')
  }
  if (!raw || typeof raw !== 'object')
    throw new Error('Geçersiz yedek: kök nesne değil')

  const env = raw as BackupEnvelope
  if (env.app !== APP_TAG)
    throw new Error(`Bu dosya bir Weltoly yedeği değil (app='${env.app}')`)
  if (typeof env.version !== 'number' || !Number.isInteger(env.version) || env.version < 1)
    throw new Error('Yedek sürümü geçersiz')
  if (env.version > BACKUP_VERSION)
    throw new Error(`Yedek sürümü (${env.version}) bu uygulamadan yeni; içe aktarılamaz`)

  const rows: Record<string, Row[]> = {}
  for (const t of BACKUP_TABLES) {
    const list = env[t]
    if (list == null)
      continue // bu tablo yedekte yok — mevcut haliyle korunur (silinmez)
    if (!Array.isArray(list))
      throw new Error(`Tablo '${t}' bir dizi değil`)

    const clean: Row[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object')
        throw new Error(`Tablo '${t}': satır bir nesne değil`)
      const src = item as Record<string, unknown>
      const filtered: Record<string, unknown> = {}
      for (const key of Object.keys(src)) {
        // Bilinmeyen/kötü niyetli kolon adları SESSİZCE atılır (injection yüzeyi kapanır).
        if (isKnownColumn(t, key))
          filtered[key] = src[key]
      }
      if (typeof filtered.id !== 'string' || !filtered.id)
        throw new Error(`Tablo '${t}': satırda geçerli 'id' yok`)
      clean.push(filtered as Row)
    }
    rows[t] = clean
  }
  return { rows }
}

/**
 * JSON yedeğini içeri alır: doğrula → otomatik güvenlik yedeği → transaction içinde
 * her tabloyu temizleyip yeniden yaz. Hata olursa ROLLBACK (mevcut veri korunur).
 */
export async function importBackup(): Promise<BackupResult> {
  if (!isTauriRuntime())
    return 'error'

  let picked: string | null = null
  try {
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!path || typeof path !== 'string')
      return 'cancel'
    picked = path

    const text = await readTextFile(path)
    // DB'ye dokunmadan ÖNCE doğrula (bozuk dosya veriyi silmeden reddedilir).
    const { rows } = parseBackup(text)

    const db = await getDb()

    // Geri-alınamaz bir işlem: önce mevcut durumun otomatik güvenlik yedeğini al.
    // Transaction bir yana, bu her koşulda kurtarma yolu bırakır.
    try {
      const safety = await serializeAll()
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      await writeTextFile(`${picked}.pre-import-${stamp}.bak.json`, safety)
    }
    catch (e) {
      logger.warn('[backup] otomatik güvenlik yedeği alınamadı, yine de devam ediliyor', e)
    }

    await db.execute('BEGIN')
    try {
      for (const t of BACKUP_TABLES) {
        const list = rows[t]
        if (!list) // yedekte yoktu → dokunma
          continue
        // Güvenlik: tablo adı da beyaz listeden (parseBackup zaten sağlıyor, katmanlı savunma).
        if (!isKnownTable(t))
          throw new Error(`Bilinmeyen tablo: ${t}`)

        await db.execute(`DELETE FROM ${t}`)
        for (const row of list) {
          const cols = Object.keys(row) // hepsi parseBackup'ta beyaz listeden geçti
          if (!cols.length)
            continue
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
          const quoted = cols.map(c => `"${c}"`).join(', ')
          await db.execute(
            `INSERT INTO ${t} (${quoted}) VALUES (${placeholders})`,
            cols.map(c => row[c]),
          )
        }
      }
      await db.execute('COMMIT')
    }
    catch (e) {
      try {
        await db.execute('ROLLBACK')
      }
      catch (rollbackErr) {
        logger.error('[backup] ROLLBACK başarısız', rollbackErr)
      }
      throw e
    }

    emitTableChange(...BACKUP_TABLES) // store'lar yeniden sorgulasın
    return 'ok'
  }
  catch (e) {
    logger.error('[backup] import failed', e)
    return 'error'
  }
}
