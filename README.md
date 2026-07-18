# Weltoly

[![CI](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml/badge.svg)](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/fahrettinaksoy/weltoly?include_prereleases&sort=semver)](https://github.com/fahrettinaksoy/weltoly/releases)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue)

Kişisel finans uygulaması — [finapp](https://github.com/ilkome/finapp)'in **Tauri v2**
ile tüm platformlara (Windows / macOS / Linux / iOS / Android) taşınmış hâli.
**Yerel-önce, offline, uzak telemetri yok** — tüm veri cihazında SQLite'ta durur.

**Yığın:** Tauri v2 · Vite · Vue 3 · Vue Router · Pinia · VueUse · **Vuetify 4** · vue-i18n · ECharts · Zod
**Veritabanı:** SQLite (`tauri-plugin-sql`, bundled)

## Özellikler

- Cüzdanlar, işlemler, kategoriler, etiketler ve harcama istatistikleri
- Çoklu para birimi — seçilebilir kur kaynağı (er-api / Frankfurter / TCMB / CoinGecko) + güncellik paneli
- PIN kilidi, açık/koyu/sistem tema, özelleştirilebilir renk/palet
- Yedek dışa/içe aktarma
- tr / en / ru dil desteği (RTL-hazır)

## Gereksinimler

- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** — araç zinciri `src-tauri/rust-toolchain.toml` ile sabittir, `rustup` otomatik kurar
- Masaüstü: platform WebView bağımlılıkları · Mobil: Android SDK+NDK / Xcode

## Komutlar

```bash
npm install          # bağımlılıklar + git hook'ları
npm run dev          # yalnız web (Vite) - http://localhost:1420
npm run tauri:dev    # masaüstü uygulaması (native pencere)
npm run build        # web build (typecheck + vite build)
npm run tauri:build  # masaüstü paket
npm run typecheck    # vue-tsc

# Mobil (SDK kurulumundan sonra):
npm run tauri android init && npm run tauri android dev
npm run tauri ios init && npm run tauri ios dev
```

## Kalite kapıları

Her push/PR'da CI şunları zorunlu kılar (bkz. [.github/workflows/ci.yml](.github/workflows/ci.yml)):

| Kapı | Komut |
| ---- | ----- |
| Tip | `npm run typecheck` |
| Lint | `npm run lint` (@antfu) |
| Frontend test | `npm test` (Vitest) |
| Rust biçim/lint/test | `cargo fmt --check` · `cargo clippy -D warnings` · `cargo test` |
| Tedarik zinciri | `npm audit` (prod) · `cargo audit` |

Bağımlılıklar Dependabot ile haftalık güncellenir. Tanılama logları çalışma anında
app log dizinindeki dönen dosyaya yazılır (Ayarlar → Veri → **Log klasörünü aç**).

## Belgeler

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — katkı akışı ve mimari notlar
- [`SECURITY.md`](SECURITY.md) — güvenlik politikası ve açık bildirimi
- [`CHANGELOG.md`](CHANGELOG.md) — sürüm geçmişi
- [`docs/RELEASE.md`](docs/RELEASE.md) — imzalama/notarization ve yayınlama
- [`docs/`](docs/) — kod inceleme raporları
- `finapp-analiz-ve-tauri-plani.md` · `finapp-tauri-gelistirme-plani.md` — kaynak analizi + faz planı

## Lisans

[MIT](LICENSE)
