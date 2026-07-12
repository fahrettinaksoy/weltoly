import { getDb } from './client'
import { emitTableChange } from './bus'
import { recordOutbox } from './outbox'

// Tablolarımız GERÇEK SQLite tablolarıdır (PowerSync view'ları değil), bu yüzden
// tek-ifadelik atomik `INSERT ... ON CONFLICT(id) DO UPDATE` kullanabiliriz.

// Her mutasyon güvenilir sabit tablolardan birini hedefler (çağıran kullanıcı girdisi geçmez).
const WRITABLE_TABLES = new Set(['categories', 'trns', 'user_settings', 'wallets', 'rates'])

function assertTable(table: string): void {
  if (!WRITABLE_TABLES.has(table))
    throw new Error(`Refusing to mutate unknown table: ${table}`)
}

function buildUpsert(table: string, id: string, row: Record<string, unknown>) {
  const cols = Object.keys(row)
  const allCols = ['id', ...cols]
  const quoted = allCols.map(c => `"${c}"`).join(', ')
  const values = [id, ...cols.map(c => row[c])]
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const updates = cols.map(c => `"${c}" = excluded."${c}"`).join(', ')
  const sql = `INSERT INTO ${table} (${quoted}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
  return { sql, values }
}

/** id'ye göre ekle veya güncelle. `row`, transforms.ts'ten SQLite-hazır değerler taşır. */
export async function upsertRow(table: string, id: string, row: Record<string, unknown>): Promise<void> {
  assertTable(table)
  const db = await getDb()
  const { sql, values } = buildUpsert(table, id, row)
  await db.execute(sql, values)
  await recordOutbox(table, id, 'upsert', row)
  emitTableChange(table)
}

/** Birden çok satırı sırayla upsert et (ör. cüzdan yeniden sıralama). Sonda tek bildirim. */
export async function upsertRows(table: string, rows: { id: string, row: Record<string, unknown> }[]): Promise<void> {
  assertTable(table)
  const db = await getDb()
  for (const { id, row } of rows) {
    const { sql, values } = buildUpsert(table, id, row)
    await db.execute(sql, values)
    await recordOutbox(table, id, 'upsert', row)
  }
  emitTableChange(table)
}

export async function deleteRow(table: string, id: string): Promise<void> {
  assertTable(table)
  const db = await getDb()
  await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])
  await recordOutbox(table, id, 'delete', null)
  emitTableChange(table)
}

/**
 * Bir cüzdana/kategoriye referans veren yerel trns'leri sil. Reddedilen bir cüzdan/kategori
 * INSERT'i geri alındığında, iyimser oluşturulmuş trns'ler yetim kalmasın diye kullanılır.
 */
export async function deleteTrnsReferencing(table: 'categories' | 'wallets', id: string): Promise<void> {
  const db = await getDb()
  if (table === 'wallets') {
    await db.execute(
      'DELETE FROM trns WHERE "walletId" = $1 OR "expenseWalletId" = $2 OR "incomeWalletId" = $3',
      [id, id, id],
    )
  }
  else {
    await db.execute('DELETE FROM trns WHERE "categoryId" = $1', [id])
  }
  emitTableChange('trns')
}
