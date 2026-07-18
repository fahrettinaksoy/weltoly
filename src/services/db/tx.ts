import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './client'

/**
 * Çok-adımlı yazmayı TEK transaction'da çalıştırır (Y-3).
 *
 * Rust `run_tx` komutuna delege eder — çünkü JS'ten gerçek transaction
 * kurulamıyor: `tauri-plugin-sql` her `execute`'u havuzdan alınan (muhtemelen
 * farklı) bir bağlantıda çalıştırır, `BEGIN` ile `INSERT` ayrı bağlantılara
 * düşebilir ve transaction hiçbir şeyi kapsamaz. Üstelik SESSİZCE: her şey
 * çalışıyor görünür, ta ki araya bir çökme girene kadar.
 *
 * Rust tarafı plugin'in KENDİ havuzunu ödünç alır (`DbInstances`), yani ikinci
 * bir bağlantı açıp WAL kilidi için yarışmaz ve DB yolunu yeniden çözmez.
 *
 * Hepsi ya uygulanır ya hiçbiri: ilk hatada sqlx otomatik ROLLBACK yapar.
 */
export interface TxStatement {
  sql: string
  values?: unknown[]
}

export async function runTx(statements: TxStatement[]): Promise<void> {
  if (!statements.length) return
  if (!isTauriRuntime()) throw new Error("runTx yalnız Tauri runtime'ında çalışır")

  // Rust `values`'ı Vec<serde_json::Value> bekliyor; undefined JSON'da yok
  // sayılır ve dizi kısalır → parametre sayısı SQL'deki $n ile uyuşmaz.
  // Bu yüzden undefined açıkça null'a çevrilir.
  const payload = statements.map((s) => ({
    sql: s.sql,
    values: (s.values ?? []).map((v) => (v === undefined ? null : v))
  }))

  await invoke('run_tx', { statements: payload })
}
