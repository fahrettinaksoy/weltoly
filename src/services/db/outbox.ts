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
    // Best-effort: outbox hatası ana mutasyonu BLOKLAMAZ ve bilinçli olarak
    // yeniden fırlatılmaz — fırlatsaydık çağıran store iyimser güncellemeyi geri
    // alır, oysa ana yazma BAŞARIYLA diske inmiş olurdu: kullanıcı kendi
    // kaydettiği veriyi ekrandan kaybolurken görürdü (daha kötü bir hata).
    //
    // ⚠️ Ama bu, sapmanın SESSİZ olduğu anlamına gelir (Y-3): mutasyon var,
    // kuyruk kaydı yok. Faz 5'te senkron motoru bu satırı hiç görmeyecek.
    // Kalıcı çözüm mutations.ts'te anlatıldığı gibi tek Rust komutu +
    // sqlx transaction'dır; o gelene kadar hata en azından GÜRÜLTÜLÜ:
    // konsola tam bağlam basılır ki geliştirme sırasında fark edilsin.
    console.error('[db] OUTBOX SAPMASI — mutasyon uygulandı ama kuyruğa yazılamadı.'
      + ' Faz 5 senkronu bu değişikliği kaçıracak.', { table, rowId, op, error: e })
  }
}
