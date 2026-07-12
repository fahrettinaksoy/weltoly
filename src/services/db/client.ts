import Database from '@tauri-apps/plugin-sql'

// Migration anahtarıyla (lib.rs) AYNI olmalı.
const DB_URL = 'sqlite:weltoly.db'

let dbPromise: Promise<Database> | null = null

/**
 * Yerel SQLite bağlantısını lazy açar (tek singleton). Yalnız Tauri runtime'ında çalışır;
 * saf tarayıcıda (`npm run dev`) `@tauri-apps/plugin-sql` yoktur ve çağrı hata verir.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise)
    dbPromise = Database.load(DB_URL)
  return dbPromise
}

// Yerel-önce modda gerçek kullanıcı yok; sabit bir yerel sahiplik işareti.
// Faz 5 (senkron) ile gerçek uid buraya bağlanacak.
const LOCAL_UID = 'local'

export function resolveWriteUid(uid?: string | null): string {
  return uid || LOCAL_UID
}
