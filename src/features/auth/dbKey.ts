// At-rest DB şifrelemesi için SQLCipher ham-anahtar türetme (saf → test edilebilir).
//
// DURUM: Bu modül GÜVENLİ TEMELDİR; henüz veritabanına BAĞLI DEĞİL. `tauri-plugin-sql`
// 2.4.0 bağlantıda `PRAGMA key` enjekte etmeye izin vermiyor (bağlantıyı düz
// `Pool::connect(url)` ile açıyor; sqlx URL'i `key`/`pragma` parametresi kabul
// etmiyor). Şifreleme fiilen açılmadan önce plan + cihaz doğrulaması gerekir —
// bkz. docs/DB-ENCRYPTION-PLAN.md. Buradaki türetme mantığı o gün olduğu gibi
// kullanılabilsin diye şimdiden yazılıp test edilir.

import { pbkdf2Hex } from './pinCrypto'

// PIN DOĞRULAMASINDAN (pinCrypto.PBKDF2_ITER) bilinçli olarak AYRI iterasyon:
// ikisi aynı türetmeyi paylaşmamalı ki birinin parametresi değişince diğerinin
// güvenliği/uyumu etkilenmesin. Anahtar türetme daha maliyetli tutulur.
export const DB_KEY_PBKDF2_ITER = 256_000

const KEY_HEX_RE = /^[0-9a-f]{64}$/

/**
 * PIN + kuruluma-özgü salt'tan SQLCipher ham anahtarını türetir: 64 hex = 32 bayt.
 *
 * Ham anahtar (parola değil) kullanılır: SQLCipher parolayı ayrıca kendi KDF'inden
 * geçirir; biz KDF'i (PBKDF2-SHA256) burada kontrol edip doğrudan anahtar veririz.
 * Salt kurulum başına rastgele üretilip yerel store'da saklanmalıdır (PIN gibi).
 */
export async function deriveDbKeyHex(pin: string, saltHex: string): Promise<string> {
  return pbkdf2Hex(pin, saltHex, DB_KEY_PBKDF2_ITER)
}

/**
 * SQLCipher `PRAGMA key` için ham-anahtar ifadesini biçimler: `PRAGMA key = "x'...'"`.
 * Ham (x'...') biçim ŞART — düz metin verilirse SQLCipher onu passphrase sanıp
 * kendi KDF'ini uygular ve bizim türettiğimiz anahtarla eşleşmez.
 */
export function sqlcipherKeyPragma(keyHex: string): string {
  if (!KEY_HEX_RE.test(keyHex))
    throw new Error('geçersiz DB anahtarı: 64 hex karakter bekleniyor')
  return `PRAGMA key = "x'${keyHex}'"`
}
