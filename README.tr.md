# Weltoly

[English](README.md) · **Türkçe**

[![CI](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml/badge.svg)](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/fahrettinaksoy/weltoly?include_prereleases&sort=semver)](https://github.com/fahrettinaksoy/weltoly/releases)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue)

**Weltoly**, gizliliğe önem veren, **yerel-önce** çalışan açık kaynak bir kişisel
finans uygulamasıdır. Cüzdanlarını, işlemlerini, kategorilerini ve çoklu para
birimindeki bakiyelerini tek bir masaüstü/mobil uygulamada takip edersin.

Tüm verin **cihazında** SQLite veritabanında durur. Sunucu, hesap veya **uzak
telemetri yoktur** — hiçbir finansal bilgin cihazdan dışarı çıkmaz. İnternet
yalnızca istediğinde güncel döviz/kripto kurlarını çekmek için kullanılır.

---

## ✨ Öne çıkan özellikler

### Cüzdanlar
- Sınırsız cüzdan; nakit, banka ve **kredi kartı** (limit + kullanılabilir bakiye) türleri
- Cüzdana özel ikon ve renk, sürükle-bırak sıralama
- Cüzdan başına bakiye grafiği, dönemsel özet ve etiket bazlı dağılım

### İşlemler
- **Gelir**, **gider**, **transfer** ve **bakiye düzeltme** türleri
- Yerleşik **hesap makinesi** ile hızlı tutar girişi
- Kategori, etiket, açıklama ve tarih; güçlü filtreleme
- Tüm cüzdanları tek listede gösteren birleşik işlemler sayfası

### Kategoriler ve etiketler
- Gelir/gider kategorileri, ikon ve renk seçici
- Alt kategori toplama (rollup) ile hiyerarşik raporlama
- Serbest etiketlerle çapraz kesit analiz

### Çoklu para birimi
- **Seçilebilir kur kaynağı:** ER-API, Frankfurter, TCMB
- **Kripto** fiyatları CoinGecko üzerinden
- Kur **güncellik paneli** — en son ne zaman güncellendiği şeffaf
- Tüm bakiyeler tek bir temel para biriminde birleştirilir

### İstatistik ve analiz
- Dönem karşılaştırmalı harcama grafikleri (ECharts)
- Kategori kırılımı ve trend görünümleri

### Kişiselleştirme
- Açık / koyu / sistem teması
- Özelleştirilebilir ana renk, nötr palet ve köşe yuvarlaklığı
- **tr / en / ru** dil desteği (RTL-hazır altyapı)

### Güvenlik ve veri
- **PIN kilidi** — üstel gecikmeli (backoff) deneme koruması; arka plana alınınca otomatik kilit
- Yedeği **dışa/içe aktarma** (JSON)
- Örnek veri ile hızlı deneme
- Tanılama logları ve uygulama içi **otomatik güncelleme** (imzalı)

---

## 🧱 Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Uygulama kabuğu | **Tauri v2** (Rust) — Windows / macOS / Linux / iOS / Android |
| Arayüz | **Vue 3** + **Vuetify 4** (Material) |
| Durum yönetimi | **Pinia** |
| Yönlendirme | **Vue Router** |
| Yerelleştirme | **vue-i18n** (tr/en/ru) |
| Grafikler | **ECharts** (`vue-echarts`) |
| Doğrulama | **Zod** |
| Tarih | **date-fns** |
| Veritabanı | **SQLite** — `tauri-plugin-sql` (derlemeye gömülü / bundled) |
| Derleme | **Vite** + TypeScript (strict) |

---

## 🏗️ Mimari

- **Yerel-önce, offline:** veri cihazında SQLite'ta durur; sunucu/hesap yoktur.
- **Bütünlüklü yazımlar:** para etkileyen çok-adımlı işlemler, Rust tarafında tek bir
  SQLite transaction'ında (`src-tauri/src/tx.rs → run_tx`) atomik olarak uygulanır —
  yarım kalmış/tutarsız kayıt oluşmaz.
- **Reaktif okuma:** tablo değişiklikleri izlenir ve yalnızca gerçekten değişen
  satırlar yeniden hesaplanır (`services/db/watch` + `reconcile`).
- **Dikey özellik dilimleri:** her özellik kendi store'u, tipleri, saf mantığı ve
  testleriyle `src/features/*` altında yaşar.
- **Gömülü SQLite:** sistem `libsqlite3` bağımlılığı yoktur (Android dahil her platformda çalışır).
- **Sıkılaştırılmış güvenlik:** dar CSP, kapsamı sınırlı Tauri capability'leri
  (yalnız kur API'leri ve kullanıcı belge klasörleri), uzak telemetri yok.

---

## 📁 Proje yapısı

```text
weltoly/
├─ src/                      # Vue 3 arayüz
│  ├─ features/              # dikey özellik dilimleri (wallets, trns, categories, …)
│  ├─ pages/                 # rota sayfaları (Panel, Cüzdanlar, İstatistik, Ayarlar…)
│  ├─ components/            # paylaşılan bileşenler
│  ├─ services/              # db, rates, backup, updater
│  ├─ shared/lib/            # saf yardımcılar (money, format, getTotal…)
│  ├─ stores/                # global store'lar (ui, settings)
│  ├─ plugins/               # vuetify, i18n, echarts
│  └─ i18n/                  # tr/en/ru sözlükleri
├─ src-tauri/                # Rust arka uç (Tauri v2)
│  ├─ src/                   # lib.rs, tx.rs (transaction komutu)
│  ├─ migrations/            # SQLite şema migrasyonları
│  └─ capabilities/          # izin kapsamları
└─ docs/                     # yayın ve teknik belgeler
```

---

## 🚀 Kurulum ve çalıştırma

### Gereksinimler
- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** — araç zinciri `src-tauri/rust-toolchain.toml` ile sabittir, `rustup` otomatik kurar
- Masaüstü: platform WebView bağımlılıkları · Mobil: Android SDK+NDK / Xcode

### Komutlar
```bash
npm install          # bağımlılıklar + git hook'ları
npm run dev          # yalnız web önizleme (Vite) — http://localhost:1420
npm run tauri:dev    # masaüstü uygulaması (native pencere)
npm run build        # web build (typecheck + vite build)
npm run tauri:build  # masaüstü paket üret
npm run typecheck    # vue-tsc tip kontrolü
npm test             # birim testleri (Vitest)

# Mobil (SDK kurulumundan sonra):
npm run tauri android init && npm run tauri android dev
npm run tauri ios init && npm run tauri ios dev
```

---

## ✅ Kalite kapıları

Her push/PR'da CI şunları zorunlu kılar (bkz. [.github/workflows/ci.yml](.github/workflows/ci.yml)):

| Kapı | Komut |
| ---- | ----- |
| Tip | `npm run typecheck` |
| Lint | `npm run lint` (@antfu) |
| Frontend test + kapsam | `npm run test:coverage` (Vitest) |
| Rust biçim/lint/test | `cargo fmt --check` · `cargo clippy -D warnings` · `cargo test` |
| Tedarik zinciri | `npm audit` (prod) · `cargo audit` |

Bağımlılıklar **Dependabot** ile haftalık güncellenir; kod taraması **CodeQL** ile
yapılır. Tanılama logları çalışma anında app log dizinindeki dönen dosyaya yazılır
(Ayarlar → Veri → **Log klasörünü aç**).

---

## 🔒 Güvenlik ve gizlilik

- Veri cihazda kalır; **hiçbir uzak sunucuya gönderilmez.**
- Güvenlik açığı bildirimi ve tehdit modeli: [SECURITY.md](SECURITY.md)
- At-rest şifreleme yol haritası ve mevcut azaltmalar: [docs/DB-ENCRYPTION-PLAN.md](docs/DB-ENCRYPTION-PLAN.md)

---

## 📚 Belgeler

- [CONTRIBUTING.md](CONTRIBUTING.md) — katkı akışı ve mimari notlar
- [SECURITY.md](SECURITY.md) — güvenlik politikası
- [CHANGELOG.md](CHANGELOG.md) — sürüm geçmişi
- [docs/RELEASE.md](docs/RELEASE.md) — imzalama, notarization ve yayınlama
- [docs/](docs/) — teknik belgeler ve kod inceleme raporları

---

## 🤝 Katkı

Katkılar memnuniyetle karşılanır. Başlamadan önce [CONTRIBUTING.md](CONTRIBUTING.md)
ve [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) belgelerine göz at. Kullanıcıya görünen
metin eklerken **tr/en/ru** üçünü de güncellemeyi unutma.

## 📄 Lisans

[MIT](LICENSE) © stackvo
