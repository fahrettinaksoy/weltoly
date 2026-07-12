# Finapp → Tauri: Geliştirme Süreci Planı

> **İlgili analiz raporu:** `finapp-analiz-ve-tauri-plani.md` (mimari, veri modeli, kararlar).
> Bu dosya, o rapordaki kararları **uygulanabilir bir yürütme planına** çevirir: ortam kurulumu, faz faz görev listeleri, kabul kriterleri, test stratejisi ve platform kontrol listeleri.
> **Tarih:** 2026-07-12

## Sabitlenen kararlar (temel alınan)

| Konu | Karar |
|---|---|
| Kabuk | Tauri v2 + Vite |
| Yığın | Vue 3 + Vue Router + Pinia + VueUse + **Vuetify 3** |
| Veritabanı | **SQLite** — `tauri-plugin-sql` (`sqlite`/bundled) + `tauri-plugin-store` (UI tercihleri) |
| Senkron | **Yerelle başla**, senkron ertelendi (mimari outbox ile hazır) |
| UI stili | **Vuetify Material** (finapp @nuxt/ui birebir taklit edilmeyecek) |
| Yedekleme | **Yerel dosya export/import** (Google Drive/Workspace YOK) |
| Hedef platformlar | Windows, macOS, Linux, iOS, Android |

---

## 1. Genel Yaklaşım & Çalışma Prensipleri

- **Dikey dilimler halinde ilerle:** her fazın sonunda çalışan, test edilebilir bir ürün olsun.
- **Beş platformu erkenden doğrula:** Faz 0'da beş hedefte de derleme/çalıştırma teyit edilir; sonra her fazda en az masaüstü + bir mobil hedefte smoke test.
- **İş mantığını kopyala, kabuğu yeniden yaz:** finapp'in saf TS'i (store'lar, util'ler, tipler) taşınır; UI Vuetify ile yeniden yazılır (bkz. § 6 Taşıma Haritası).
- **Git akışı:** `main` korumalı; her faz/özellik için `feat/<konu>` dalı → PR → gözden geçir → merge. Konvansiyonel commit (`feat:`, `fix:`, `chore:`, `test:`).
- **Definition of Done (her görev):** kod + tip kontrolü (`vue-tsc`) temiz + ilgili birim testleri yeşil + lint temiz + en az bir platformda elle doğrulanmış.
- **Kalite kapıları (her PR):** `pnpm typecheck`, `pnpm lint`, `pnpm test` geçmeli.

---

## 2. Ön Koşullar & Geliştirme Ortamı Kurulumu (Faz 0'dan önce)

### 2.1 Ortak toolchain
- [ ] **Node.js** LTS (≥ 20) + **pnpm** kur.
- [ ] **Rust** (rustup) + `cargo` güncel.
- [ ] **Tauri CLI v2:** `pnpm add -D @tauri-apps/cli@^2`.
- [ ] Tauri sistem bağımlılıkları (platforma göre — WebView2 / WKWebView / WebKitGTK).

### 2.2 Masaüstü hedefleri
- [ ] **Windows:** WebView2 runtime + MSVC build tools.
- [ ] **macOS:** Xcode Command Line Tools.
- [ ] **Linux:** `webkit2gtk`, `libayatana-appindicator` vb. paketler.

### 2.3 Mobil hedefleri
- [ ] **Android:** Android Studio + SDK + **NDK** + `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`. `tauri android init`.
- [ ] **iOS:** Xcode + `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`. `tauri ios init`. (Yalnız macOS'ta.)

### 2.4 Doğrulama (Faz 0 kapısı)
- [ ] Boş Tauri uygulaması **5 hedefte de** derlenip açılıyor (Windows/macOS/Linux/Android/iOS).

---

## 3. Faz Faz Yürütme Planı

Her faz: **Hedef → Görevler (checklist) → Çıktı → Kabul Kriterleri → Tahmini Süre.**

### Faz 0 — Proje İskeleti  ·  ~3–4 gün
**Hedef:** Boş ama tüm platformlarda derlenen, navigasyonu kurulmuş uygulama kabuğu.

**Görevler:**
- [ ] Vite + Vue 3 + TS projesi oluştur; Tauri v2'yi entegre et (`src-tauri/`).
- [ ] Vuetify 3 kur (`vite-plugin-vuetify`), tema iskeleti (light/dark), MDI ikonları.
- [ ] Pinia, Vue Router (route tablosu iskeleti), VueUse, vue-i18n kur.
- [ ] `unplugin-auto-import` + `unplugin-vue-components` (Vuetify resolver) yapılandır.
- [ ] Klasör yapısını kur (analiz raporu § 7: `features/`, `services/`, `shared/lib/`, `pages/`, `layouts/`).
- [ ] Uygulama kabuğu: alt navigasyon (mobil) / yan navigasyon (masaüstü), boş sayfalar (dashboard, wallets, categories, stat, settings).
- [ ] ESLint + Prettier + `typecheck` + `test` script'leri; temel CI (opsiyonel).

**Çıktı:** Gezinebilen boş uygulama.
**Kabul:** § 2.4 kapısı geçildi + tema geçişi çalışıyor + navigasyon tüm sayfaları açıyor.

---

### Faz 1 — Veri Katmanı  ·  ~1 hafta  ·  ⚠️ EN RİSKLİ
**Hedef:** Native SQLite üzerinde reaktif, test edilmiş bir veri katmanı.

**Görevler:**
- [ ] `tauri-plugin-sql` (`sqlite`, **bundled**) kur; `tauri-plugin-store` kur; capability/izinleri tanımla.
- [ ] **Android gömülü derleme** doğrula (sistem `libsqlite3`'e bağımlı olmadığından emin ol — analiz raporu § 14.4).
- [ ] SQLite migration'ları (Rust `Migration`): `wallets`, `categories`, `trns`, `user_settings`, `rates` (finapp şeması, camelCase sütunlar, string id).
- [ ] `services/db/` sarmalayıcı:
  - [ ] `transforms.ts` (satır↔nesne: boolean 0/1, `parentId` null↔0, rates JSON) — finapp'ten uyarlanır.
  - [ ] `mutations.ts`: `upsertRow` / `upsertRows` / `deleteRow` (INSERT/UPDATE).
  - [ ] `watchTable` **taklidi**: mutasyon sonrası ilgili tabloyu yeniden sorgula → abonelere emit et (analiz § 14.5).
- [ ] Tipleri kopyala: tüm `features/*/types.ts` (zod şemaları) — finapp'ten aynen.
- [ ] `shared/lib/getTotal.ts` (kur çevrimi + toplamlar) — finapp'ten aynen + birim testleri taşı.
- [ ] `outbox` iskeleti (senkrona hazırlık): her mutasyonu opsiyonel bir `outbox` tablosuna da yaz (Faz 5'te tüketilecek; şimdilik pasif).

**Çıktı:** Programatik olarak CRUD + reaktif okuma yapılabilen veri katmanı.
**Kabul:** Birim testler yeşil (transforms, getTotal, mutations); bir demo script'i satır yazıp `watchTable`'ın emit ettiğini doğruluyor; Android dahil çalışıyor.

---

### Faz 2 — Çekirdek CRUD (Cüzdan / Kategori / İşlem)  ·  ~2 hafta
**Hedef:** Yerel olarak tam işlevsel MVP.

**Görevler:**
- [ ] **Cüzdanlar:** `useWalletsStore` (finapp mantığı kopya) → Vuetify liste + oluştur/düzenle formu + sürükle-sırala (`@formkit/drag-and-drop`) + arşiv/hariç-tut + tip seçimi (6 tip, kredi limiti).
- [ ] **Kategoriler:** `useCategoriesStore` kopya → hiyerarşik (parent/child) ağaç UI + ikon seçici + renk seçici + favori/son-kullanılan bayrakları.
- [ ] **İşlemler:** `useTrnsStore` + `getTrns` + `reconcile` kopya → işlem listesi (gruplu), silme.
- [ ] **İşlem formu (`trnForm`):** `useTrnsFormStore` + `utils/{calculate,validate,formatData}` kopya → Vuetify ile form UI: gelir/gider/transfer sekmeleri, **hesap makinesi**, cüzdan/kategori hızlı seçici, tarih seçici, açıklama.
- [ ] Sentetik kategori kuralları (`transfer`/`adjustment`) ve düzeltme mantığı (analiz § 3.2 kritik kurallar).
- [ ] İyimser güncelleme + rollback davranışı (finapp deseni).

**Çıktı:** Kullanıcı cüzdan/kategori/işlem ekleyip bakiyeleri görebiliyor.
**Kabul:** Uçtan uca: cüzdan oluştur → işlem ekle (hesap makinesiyle) → transfer yap → bakiye doğru; `trnForm/utils` testleri yeşil; masaüstü + bir mobilde smoke test.

---

### Faz 3 — Analitik / İstatistik  ·  ~1.5 hafta
**Hedef:** Dashboard + grafikler + filtreler.

**Görevler:**
- [ ] Saf util'leri kopyala: `stat/intervals`, `categories/collectAndGroup`, `categories/barUtils`, `date/useGetDateRange`, `chart/useCategorySeriesBuilder` + birim testleri.
- [ ] **ECharts + vue-echarts** kur; bar + çizgi grafik (ortalama çizgisi); tema renklerini Vuetify CSS değişkenlerine bağla.
- [ ] Tarih aralığı seçici (gün/hafta/ay/yıl/özel) — Vuetify.
- [ ] Filtreler: cüzdan + kategori çoklu seçim (`useFilter` mantığı).
- [ ] Kategori kırılım görünümleri (yuvarlak/dikey/satır/detaylı).
- [ ] Dashboard sekmeleri (özet/gider/gelir) + config panelleri.

**Çıktı:** Çalışan analitik ekranları.
**Kabul:** Grafikler gerçek veriyle doğru; tarih aralığı + filtreler toplamları doğru değiştiriyor; stat testleri yeşil.

---

### Faz 4 — Para Birimi, Kişiselleştirme & Yedekleme  ·  ~1 hafta
**Hedef:** Çoklu para, tema/kişiselleştirme, yerel yedekleme, i18n, demo.

**Görevler:**
- [ ] **Para birimi:** `useCurrenciesStore` kopya; çoklu-para toplamlar; para birimi seçici (165+).
- [ ] **Kur servisi:** `services/rates/` — günde bir ücretsiz kur API'sinden `tauri-plugin-http` ile çek → `rates` tablosuna yaz; offline'da son kurlar.
- [ ] **Tema/kişiselleştirme:** Vuetify theme + `useColorMode` (VueUse); açık/koyu/sistem; ana renk (20+), nötr palet, köşe yuvarlaklığı → `tauri-plugin-store`'da sakla.
- [ ] **i18n:** vue-i18n; sözlükleri taşı; **Türkçe (tr)** ekle + en + ru.
- [ ] **Yerel yedekleme:** SQLite/JSON export & import (`tauri-plugin-dialog` + `tauri-plugin-fs`) — analiz § 15.1.
- [ ] **Demo modu:** mock veriler (finapp `mocks/`) + kalıcılıksız/bellek modu.

**Çıktı:** Kişiselleştirilebilir, çok dilli, yedeklenebilir uygulama.
**Kabul:** Kur çevrimi doğru; tema/dil kalıcı; export edilen dosya import ile geri yükleniyor; demo modu senkronsuz çalışıyor.

---

### Faz 5 — (Opsiyonel) Kimlik Doğrulama & Senkron  ·  ~1.5–2 hafta
**Hedef:** Cihazlar arası senkron (istenirse).

**Görevler:**
- [ ] Karar: **Turso embedded replica** vs **PowerSync** vs özel outbox (analiz § 6.2 + § 15.2).
- [ ] Auth: seçilen backend'e göre (deep-link OAuth — `tauri-plugin-deep-link` + `tauri-plugin-opener`).
- [ ] `outbox` tüketimi + `updatedAt` tabanlı çakışma çözümü (last-write-wins) veya seçilen motorun satır-bazlı senkronu.
- [ ] Oturum kaybında senkron duraklatma / yerel veriyi koruma (finapp deseni).
- [ ] (Opsiyonel) Şifreleme: SQLCipher veya libsql AES-256.

**Çıktı:** İki cihaz arasında güvenli senkron.
**Kabul:** İki cihazda eşzamanlı değişiklik veri kaybı olmadan birleşiyor; offline→online geçişte kuyruk boşalıyor.

---

### Faz 6 — Paketleme & Yayın  ·  ~1 hafta
**Hedef:** Tüm platformlar için dağıtılabilir çıktı.

**Görevler:**
- [ ] Uygulama ikonları (`tauri icon`), splash, isim, sürüm.
- [ ] Masaüstü installer'ları: Windows (MSI/NSIS), macOS (DMG, **imzalama + notarization**), Linux (AppImage/deb).
- [ ] Mobil: Android (AAB, imzalama), iOS (IPA, provisioning/imzalama).
- [ ] Otomatik güncelleme (`tauri-plugin-updater`) — masaüstü için opsiyonel.
- [ ] Mağaza hazırlığı (Play Store / App Store metadata, gizlilik).
- [ ] Sürüm CI/CD (opsiyonel): tag → çok-platform build.

**Çıktı:** İmzalı, dağıtılabilir paketler.
**Kabul:** Her platformda temiz cihazda kurulup açılıyor.

---

## 4. Milestone / Zaman Çizelgesi (özet)

| Milestone | Fazlar | Kümülatif süre | Sonuç |
|---|---|---|---|
| **M1 — İskelet hazır** | 0 | ~1. hafta sonu | 5 platformda derlenen kabuk |
| **M2 — Veri katmanı** | 1 | ~2. hafta | Reaktif SQLite CRUD |
| **M3 — Yerel MVP** | 2 | ~4. hafta | Tam işlevsel yerel uygulama |
| **M4 — Analitik** | 3 | ~5.5. hafta | Dashboard + grafikler |
| **M5 — Zengin MVP** | 4 | ~6.5. hafta | Çoklu para + tema + yedek + i18n → **yayına aday** |
| **M6 — Senkron** (ops.) | 5 | ~8.5. hafta | Çok-cihazlı senkron |
| **M7 — Yayın** | 6 | ~9.5. hafta | İmzalı paketler |

> **Yalnız-yerel yayına-aday ürün ≈ 6.5 hafta (M5).** Senkron/auth sonradan, çekirdeği bozmadan eklenir.

---

## 5. Test Stratejisi

- **Birim (Vitest):** taşınan tüm saf util'ler ve store mantığı için finapp testlerini birlikte taşı (getTotal, calculate, validate, formatData, intervals, collectAndGroup, barUtils, useGetDateRange, reconcile, getTrns). Bunlar framework'ten bağımsız → doğrudan çalışır.
- **Bileşen (Vitest + @vue/test-utils):** kritik UI (trnForm hesap makinesi, cüzdan formu).
- **E2E (Tauri):** WebdriverIO + `tauri-driver` (masaüstü); temel akışlar: işlem ekle, transfer, filtre, yedek al/yükle.
- **Manuel platform matrisi:** her milestone'da § 7 kontrol listesi.

---

## 6. Dosya/Modül Taşıma Haritası (finapp → weltoly)

| Kaynak (finapp) | Aksiyon | Hedef |
|---|---|---|
| `components/*/types.ts` (zod) | **Kopyala** | `features/*/types.ts` |
| `components/amount/getTotal.ts` (+test) | **Kopyala** | `shared/lib/getTotal.ts` |
| `components/*/useXStore.ts` | **Kopyala + db bağla** | `features/*/store.ts` |
| `trnForm/utils/{calculate,validate,formatData}` (+test) | **Kopyala** | `features/trnForm/utils/` |
| `trns/{getTrns,reconcile}.ts` (+test) | **Kopyala** | `features/trns/` |
| `stat/**` saf util'ler (+test) | **Kopyala** | `features/stat/` |
| `services/powersync/*` | **Yeniden yaz** (tauri-plugin-sql) | `services/db/` |
| `components/**/*.vue` | **Yeniden yaz** (Vuetify) | `features/*/components/` |
| `pages/**`, `layouts/**` | **Yeniden yaz** (Vue Router) | `pages/`, `layouts/` |
| `i18n/*` | **Uyarla** (vue-i18n) + tr ekle | `i18n/` |
| `mocks/*` | **Kopyala** | demo modu |

**Kural:** "Kopyala" satırları saf TS'tir, mantık değişmez; yalnızca import yolları düzeltilir. "Yeniden yaz" satırları framework kabuğudur.

---

## 7. Platform-Özel Kontrol Listesi (her milestone'da)

- [ ] **Windows:** WebView2'de açılış, pencere davranışı, dosya diyalogları.
- [ ] **macOS:** menü çubuğu, imzalama/notarization (yayında), güvenli alan.
- [ ] **Linux:** WebKitGTK render, AppImage çalışması.
- [ ] **Android:** SQLite gömülü çalışıyor (linkleme hatası yok), klavye/safe-area, geri tuşu, dokunmatik hedefler, deep-link (Faz 5).
- [ ] **iOS:** WKWebView, safe-area, klavye, imzalama/provisioning (yayında), deep-link (Faz 5).

---

## 8. Riskler & Azaltım (yürütme odaklı)

| Risk | Azaltım | Faz |
|---|---|---|
| Android SQLite linkleme hatası | Gömülü/bundled derleme; Faz 0/1'de erken doğrula | 0–1 |
| PowerSync `watch` yok | `watchTable` taklidi + iyimser güncelleme | 1 |
| @nuxt/ui → Vuetify görsel fark | Vuetify Material kabul edildi; tema özelleştir | 2+ |
| trnForm kenar durumları | finapp `utils` testleriyle birlikte taşı | 2 |
| ECharts ↔ Vuetify tema | Grafik renklerini CSS değişkenlerine bağla | 3 |
| Mağaza imzalama/notarization | Faz 6'da ayrı zaman ayır; erken deneme sertifikaları | 6 |

---

## 9. Hemen Başlangıç (ilk oturum)

1. § 2 ortam kurulumunu tamamla.
2. Faz 0 iskeletini oluştur; § 2.4 kapısını (5 platform derleme) geç.
3. Faz 1'e geç — en riskli parça olan veri katmanını erken doğrula.

> Onay verildiğinde Faz 0 iskeletini bu plana göre kurmaya başlayabilirim.
