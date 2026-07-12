# Weltoly

Kişisel finans uygulaması — [finapp](https://github.com/ilkome/finapp)'in **Tauri v2** ile tüm platformlara (Windows / macOS / Linux / iOS / Android) taşınmış hâli.

**Yığın:** Tauri v2 · Vite · Vue 3 · Vue Router · Pinia · VueUse · **Vuetify 3** · vue-i18n
**Veritabanı (Faz 1):** SQLite (`tauri-plugin-sql`, bundled)

## Dokümanlar
- `finapp-analiz-ve-tauri-plani.md` — kaynak analizi + mimari kararlar
- `finapp-tauri-gelistirme-plani.md` — faz faz geliştirme planı

## Gereksinimler
- Node.js ≥ 20, npm
- Rust (rustup) + cargo
- Masaüstü: platform WebView bağımlılıkları · Mobil: Android SDK+NDK / Xcode

## Komutlar
```bash
npm install          # bağımlılıklar
npm run dev          # yalnız web (Vite) - http://localhost:1420
npm run tauri:dev    # masaüstü uygulaması (native pencere)
npm run build        # web build (typecheck + vite build)
npm run tauri:build  # masaüstü paket
npm run typecheck    # vue-tsc

# Mobil (SDK kurulumundan sonra):
npm run tauri android init && npm run tauri android dev
npm run tauri ios init && npm run tauri ios dev
```

## Durum
**Faz 0 (iskelet) tamam** — 5 sayfa (Panel/Cüzdanlar/İstatistik/Ayarlar + Kategoriler), responsive navigasyon (mobil alt bar / masaüstü ray), açık-koyu-sistem tema, tr/en/ru dil desteği. Sonraki: **Faz 1 — SQLite veri katmanı**.
