import { getDb } from './client'

// Senkron (Faz 5) hazırlığı: her yerel mutasyon buraya da yazılır. Şimdilik PASİF
// (tüketen yok). Faz 5'te bir senkron motoru bu kuyruğu okuyup uzağa gönderecek.

export type OutboxOp = 'upsert' | 'delete'

export async function recordOutbox(
  table: string,
  rowId: string,
  op: OutboxOp,
  payload: unknown,
): Promise<void> {
  try {
    const db = await getDb()
    await db.execute(
      'INSERT INTO outbox ("tableName", "rowId", "op", "payload", "createdAt") VALUES ($1, $2, $3, $4, $5)',
      [table, rowId, op, payload == null ? null : JSON.stringify(payload), Date.now()],
    )
  }
  catch (e) {
    // Best-effort: outbox hatası ana mutasyonu bloklamaz.
    console.error('[db] outbox write failed:', e)
  }
}
