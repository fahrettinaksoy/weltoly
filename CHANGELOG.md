# Changelog

Bu projedeki tüm önemli değişiklikler bu dosyada belgelenir.

Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) temellidir ve
proje [Semantic Versioning](https://semver.org/lang/tr/)'i izler.

## [Yayınlanmadı]

### Eklendi

- **Rust CI kalite kapısı** — `cargo fmt --check`, `cargo clippy -D warnings` ve
  `cargo test` artık her push/PR'da çalışıyor (önceden `tx.rs` transaction
  testleri CI dışındaydı).
- **Tedarik zinciri kapıları** — `dependabot.yml` (npm/cargo/actions) ve CI'da
  `npm audit` (prod) + `cargo audit`.
- **Gözlemlenebilirlik** — global Vue `errorHandler` + `window` hata dinleyicileri,
  `tauri-plugin-log` ile kalıcı dönen log dosyası, `@/shared/lib/logger` sarmalayıcısı
  ve Ayarlar'da "Log klasörünü aç" tanılama düğmesi.
- **Otomatik güncelleme** — `tauri-plugin-updater` + `tauri-plugin-process`,
  imzalı GitHub Releases üzerinden; Ayarlar'da "Güncellemeleri denetle".
- **Boot smoke testi** — gerçek `App.vue`, tüm eklenti yığınıyla hatasız açılıyor mu (Vitest).
- Test kapsam ölçümü ve CI eşikleri (`@vitest/coverage-v8`, `test:coverage`).
- Araç zinciri sabitleme: `rust-toolchain.toml`, `.nvmrc`.
- Depo yönetişimi: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `CODEOWNERS`, PR/issue şablonları, `.editorconfig`.
- **DB at-rest şifreleme temeli** — PIN'den SQLCipher ham anahtarı türeten saf,
  test edilmiş mantık (`dbKey.ts`); şifreleme henüz açık değil (plugin engeli),
  plan/risk `docs/DB-ENCRYPTION-PLAN.md`'de.

### Değişti

- Tüm `console.error/warn` çağrıları kalıcı `logger`'a yönlendirildi.

## [0.1.0] — 2026

### Eklendi

- İlk iskelet: Tauri v2 + Vue 3 + Vuetify + Pinia + vue-i18n (tr/en/ru).
- SQLite veri katmanı (`tauri-plugin-sql`, bundled) ve migration'lar.
- Cüzdanlar, işlemler, kategoriler, etiketler, istatistik ve çoklu para birimi
  (seçilebilir kur kaynağı + güncellik paneli).
- PIN kilidi, açık/koyu/sistem tema, yedek dışa/içe aktarma.

[Yayınlanmadı]: https://github.com/fahrettinaksoy/weltoly/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fahrettinaksoy/weltoly/releases/tag/v0.1.0
