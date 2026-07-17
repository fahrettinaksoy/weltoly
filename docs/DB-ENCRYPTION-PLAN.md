# DB At-Rest Şifreleme — Plan ve Engel Kaydı

**Durum:** Temel atıldı, şifreleme HENÜZ AÇIK DEĞİL. Bu belge nedenini, planı ve
riski kaydeder.

## Neden henüz açık değil (teknik engel)

Weltoly verisi `weltoly.db` içinde **düz metin** SQLite olarak durur. At-rest
şifreleme için standart yol **SQLCipher**'dır (`PRAGMA key` ile şeffaf şifreleme).
Ancak:

- `tauri-plugin-sql` 2.4.0 sqlite bağlantısını düz `Pool::connect(url)` ile açar
  (`wrapper.rs`). Bağlantı kurulmadan `PRAGMA key` çalıştıracak bir kanca yoktur.
- SQLCipher'da `PRAGMA key` bağlantının **ilk** ifadesi olmak zorundadır ve
  havuzdaki **her** bağlantıya uygulanmalıdır.
- sqlx'in sqlite URL ayrıştırıcısı yalnız `mode/cache/immutable/vfs` parametrelerini
  tanır; `key`/`pragma` "unknown query parameter" ile reddedilir. Yani anahtarı
  URL üzerinden geçirmek de mümkün değildir.

Sonuç: şifreleme, plugin'e desteklenen bir yoldan **eklenemez**.

## Zaten hazır olan (güvenli temel)

- `src/features/auth/dbKey.ts` — PIN + kuruluma-özgü salt'tan SQLCipher ham
  anahtarı (64 hex) türeten saf, test edilmiş mantık (`dbKey.test.ts`).
- Salt üretimi/saklama deseni PIN akışıyla aynıdır (`pinCrypto.ts`,
  `tauri-plugin-store`).

## Uygulama yolları (ileride, cihazda doğrulanarak)

### Yol A — Kendi şifreli bağlantı katmanımız (önerilen)
1. `Cargo.toml`: `libsqlite3-sys` `bundled-sqlcipher` feature'ıyla eklenir
   (workspace'te sqlx'in libsqlite3-sys'ini SQLCipher'a çevirir).
2. `tauri-plugin-sql` bypass edilir: bağlantı havuzunu Rust tarafında
   `SqliteConnectOptions::new().pragma("key", "x'<hex>'")` ile biz kurarız ve
   `DbInstances`'a koyarız (JS `Database.load` yerine bir `#[command]` ile).
3. `tx.rs` zaten `DbInstances`'tan havuzu ödünç alıyor — aynı kalır.
4. Anahtar JS'ten (PIN türetmesinden) IPC ile Rust'a bir kez verilir; Rust asla
   diske yazmaz.

### Yol B — Plugin'i vendor/patch et
`tauri-plugin-sql`'i fork'layıp `connect` yolunda `pragma("key", …)` ekle. Daha az
kod ama upstream'den ayrışma bakım borcu.

## Anahtar/PIN ilişkisi ve rekey
- Anahtar PIN'den türerse, **PIN değişince DB `PRAGMA rekey` gerekir** (yeni
  anahtara). Bu adım migration'a dahil edilmeli.
- PIN YOKSA: kuruluma-özgü rastgele anahtar `tauri-plugin-store`'da saklanır
  (cihazda kalır). Bu, "hiç PIN'i olmayan kullanıcı" için de şifreleme sağlar ama
  koruma cihaz erişimine karşı zayıftır (anahtar cihazda). Karar noktası.

## Plaintext → şifreli migration (RİSKLİ — cihazda doğrulama ŞART)
1. Açılışta mevcut `weltoly.db` düz metin mi tespit et.
2. `sqlcipher_export()` ile yeni şifreli dosyaya aktar; doğrula; atomik olarak
   yerine koy; yalnız başarıda eskiyi sil.
3. Her platformda (macOS/Windows/Linux) temiz + dolu DB ile denenmeden
   YAYINLANMAZ — yanlış giderse kullanıcı tüm finansal verisine erişemez.

## Interim (şimdi geçerli) azaltma
- İşletim sistemi tam-disk şifrelemesi (macOS **FileVault**, Windows **BitLocker**,
  Linux **LUKS**) — kullanıcıya önerilir; at-rest korumasının bugünkü kaynağı budur.
- Uygulama PIN kilidi (`LockScreen`) yetkisiz UI erişimini engeller (ama DB
  dosyasını değil).
