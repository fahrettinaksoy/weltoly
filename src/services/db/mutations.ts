import type { TxStatement } from './tx'
import { emitTableChange } from './bus'
import { isKnownTable } from './schema'
import { runTx } from './tx'

// Tablolarımız GERÇEK SQLite tablolarıdır (PowerSync view'ları değil), bu yüzden
// tek-ifadelik atomik `INSERT ... ON CONFLICT(id) DO UPDATE` kullanabiliriz.
//
// TRANSACTIONAL OUTBOX (Y-3): ana yazma ile outbox kaydı ARTIK TEK BİRİM.
// İkisi ayrı `execute` olduğunda, aralarında çökme olursa mutasyon kalıcı olur
// ama outbox kaydı oluşmazdı → Faz 5 senkronunda KALICI sapma (uzak taraf o
// değişikliği hiç görmez). JS'ten transaction kurulamıyor (tauri-plugin-sql her
// execute'u havuzdan farklı bir bağlantıya verebilir), bu yüzden çok-adımlı
// yazma tek bir Rust komutuna (`run_tx` + sqlx::Transaction) delege edilir;
// o komut plugin'in KENDİ havuzunu ödünç alır.

// Her mutasyon güvenilir sabit tablolardan birini hedefler (çağıran kullanıcı girdisi geçmez).
// Beyaz liste tek kaynaktan gelir (schema.ts) — backup/import ile drift olmasın.
function assertTable(table: string): void {
  if (!isKnownTable(table)) throw new Error(`Refusing to mutate unknown table: ${table}`)
}

function buildUpsert(table: string, id: string, row: Record<string, unknown>) {
  const cols = Object.keys(row)
  const allCols = ['id', ...cols]
  const quoted = allCols.map((c) => `"${c}"`).join(', ')
  const values = [id, ...cols.map((c) => row[c])]
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const updates = cols.map((c) => `"${c}" = excluded."${c}"`).join(', ')
  const sql = `INSERT INTO ${table} (${quoted}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`
  return { sql, values }
}

/** Outbox kaydı — mutasyonla AYNI transaction'da yazılır. */
function outboxStmt(
  table: string,
  rowId: string,
  op: 'upsert' | 'delete',
  payload: unknown
): TxStatement {
  return {
    sql: 'INSERT INTO outbox ("tableName", "rowId", "op", "payload", "createdAt") VALUES ($1, $2, $3, $4, $5)',
    values: [table, rowId, op, payload == null ? null : JSON.stringify(payload), Date.now()]
  }
}

/** id'ye göre ekle veya güncelle. `row`, transforms.ts'ten SQLite-hazır değerler taşır. */
export async function upsertRow(
  table: string,
  id: string,
  row: Record<string, unknown>
): Promise<void> {
  assertTable(table)
  const { sql, values } = buildUpsert(table, id, row)
  await runTx([{ sql, values }, outboxStmt(table, id, 'upsert', row)])
  emitTableChange(table)
}

/**
 * Birden çok satırı upsert et (ör. cüzdan yeniden sıralama). Sonda tek bildirim.
 *
 * TEK transaction: eskiden döngü içinde ayrı ayrı yazılıyordu ve yarıda çökme
 * cüzdanların yarısını yeni, yarısını eski `order` ile bırakabiliyordu.
 */
export async function upsertRows(
  table: string,
  rows: { id: string; row: Record<string, unknown> }[]
): Promise<void> {
  assertTable(table)
  if (!rows.length) return
  const stmts: TxStatement[] = []
  for (const { id, row } of rows) {
    const { sql, values } = buildUpsert(table, id, row)
    stmts.push({ sql, values }, outboxStmt(table, id, 'upsert', row))
  }
  await runTx(stmts)
  emitTableChange(table)
}

export async function deleteRow(table: string, id: string): Promise<void> {
  assertTable(table)
  await runTx([
    { sql: `DELETE FROM ${table} WHERE id = $1`, values: [id] },
    outboxStmt(table, id, 'delete', null)
  ])
  emitTableChange(table)
}

/** Silinecek tek bir satır — tablo + id. */
export interface RowRef {
  table: string
  id: string
}

/**
 * Birden çok satırı (farklı tablolardan olabilir) TEK transaction'da siler.
 *
 * Cüzdan/kategori silme için: "cüzdanı ve ona bağlı işlemleri sil" TEK bir
 * kullanıcı niyetidir, yarısı uygulanmamalı. Eskiden `Promise.all` ile N+1 ayrı
 * `deleteRow` çağrılıyordu; her biri kendi transaction'ıydı ve biri patlarsa
 * diğerleri KALICI oluyordu. Store iyimser UI'ı geri alıyordu, yani ekran
 * cüzdanı geri getiriyor ama işlemleri DB'den gerçekten silinmiş oluyordu —
 * ekranla disk sessizce çelişiyordu.
 *
 * Sıra ÖNEMLİ: çağıran, referans verenleri (trns) referans verilenden (wallet)
 * ÖNCE göndermeli. FK'lar açıldığında bu sıra gerekli olacak; şimdiden doğru
 * olması ileride sessizce kırılmasını önler.
 */
export async function deleteRows(refs: RowRef[]): Promise<void> {
  if (!refs.length) return
  for (const { table } of refs) assertTable(table)

  await runTx(
    refs.flatMap(({ table, id }) => [
      { sql: `DELETE FROM ${table} WHERE id = $1`, values: [id] },
      outboxStmt(table, id, 'delete', null)
    ])
  )

  // Tablo başına tek bildirim: aynı tablodan 50 satır silindiyse 50 kez
  // yeniden okumanın anlamı yok.
  for (const table of new Set(refs.map((r) => r.table))) emitTableChange(table)
}

// Not: burada bir `deleteTrnsReferencing(table, id)` vardı — bir cüzdana/kategoriye
// referans veren trns'leri SQL'de bulup silen. Hiçbir yerden çağrılmıyordu: store'lar
// silinecek id'leri zaten bellekteki listeden hesaplıyor (`referencingTrnIds`) ve
// `deleteRows` ile gönderiyor. İki ayrı "hangi trns'ler etkilenir" tanımı tutmak,
// biri güncellenip diğeri unutulduğunda sessizce ayrışır — silindi.
