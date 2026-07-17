import { emitTableChange } from './bus'
import { getDb } from './client'
import { recordOutbox } from './outbox'
import { isKnownTable } from './schema'

// Tablolarımız GERÇEK SQLite tablolarıdır (PowerSync view'ları değil), bu yüzden
// tek-ifadelik atomik `INSERT ... ON CONFLICT(id) DO UPDATE` kullanabiliriz.
//
// ⚠️ BİLİNEN SINIR — TRANSACTIONAL OUTBOX EKSİK (Y-3):
// Ana yazma ile outbox kaydı İKİ AYRI `execute` çağrısıdır. Aralarında süreç
// çökerse mutasyon kalıcı olur, outbox kaydı oluşmaz → Faz 5 senkronunda KALICI
// sapma. `upsertRows` döngüsü de aynı sebeple yarı-uygulanabilir (cüzdan yeniden
// sıralamada yarısı yeni yarısı eski `order`).
//
// Neden burada çözülemiyor: tauri-plugin-sql her `execute`'u bir HAVUZ
// bağlantısından geçirir; JS'ten `BEGIN`/`COMMIT` göndermek aynı bağlantıya
// düşeceğini GARANTİ ETMEZ, dolayısıyla gerçek bir transaction kurulamaz.
// Doğru çözüm: çok-adımlı yazmayı tek bir Rust `#[command]` + `sqlx::Transaction`
// arkasına almak (repository / unit-of-work katmanı). Bu, Faz 5 senkronundan
// ÖNCE yapılmalı — outbox'ın tüketicisi olduğunda sapma görünür hale gelir.
//
// Şimdilik risk sınırlı: outbox PASİF (tüketen yok) ve yazmalar tek kullanıcılı
// yerel bir masaüstü uygulamasında sıralı akıyor.

// Her mutasyon güvenilir sabit tablolardan birini hedefler (çağıran kullanıcı girdisi geçmez).
// Beyaz liste tek kaynaktan gelir (schema.ts) — backup/import ile drift olmasın.
function assertTable(table: string): void {
  if (!isKnownTable(table))
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
 *
 * OUTBOX (Y-3): silinen HER satır için ayrı bir outbox kaydı yazılır. Eskiden bu
 * fonksiyon outbox'a HİÇ yazmıyordu — toplu DELETE yerelde uygulanıyor, kuyruğa
 * hiçbir iz düşmüyordu. Faz 5'te senkron motoru bu silmeleri hiç görmeyecek,
 * uzak taraf o işlemleri KALICI olarak canlı tutacaktı (sessiz sapma).
 * Bu yüzden önce id'ler SELECT edilir, sonra silinir, sonra kuyruğa yazılır.
 */
export async function deleteTrnsReferencing(table: 'categories' | 'wallets', id: string): Promise<void> {
  const db = await getDb()

  // Önce hangi satırların silineceğini öğren — DELETE sonrası id'ler kaybolur.
  const where = table === 'wallets'
    ? '"walletId" = $1 OR "expenseWalletId" = $1 OR "incomeWalletId" = $1'
    : '"categoryId" = $1'

  const doomed = await db.select<{ id: string }[]>(`SELECT id FROM trns WHERE ${where}`, [id])

  await db.execute(`DELETE FROM trns WHERE ${where}`, [id])

  for (const row of doomed)
    await recordOutbox('trns', row.id, 'delete', null)

  emitTableChange('trns')
}
