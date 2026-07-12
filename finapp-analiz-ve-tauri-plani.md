# Finapp Analizi & Tauri'ye Taşıma Planı

> **Kaynak proje:** [ilkome/finapp](https://github.com/ilkome/finapp) — v8.2.0 (analiz edilen commit: `0f42eaa`)
> **Hedef:** Aynı ürünü **Tauri v2** ile tüm platformlarda (Windows / macOS / Linux / iOS / Android) çalışacak şekilde; **Vue 3 + Vite + Vue Router + Pinia + VueUse + Vuetify** yığınıyla yeniden yazmak.
> **Tarih:** 2026-07-12

---

## 1. Yönetici Özeti

Finapp, **offline-first** çalışan bir kişisel finans yönetim uygulamasıdır. Kullanıcı cüzdanlarını (nakit, banka, kredi kartı, mevduat, kripto, borç), gelir/gider/transfer işlemlerini, hiyerarşik kategorileri ve 165+ para birimini yönetir; harcamalarını grafiklerle analiz eder.

Orijinal proje şu yığını kullanıyor: **Nuxt 4 (SPA modu, `ssr: false`) + @nuxt/ui v4 (Tailwind v4) + Pinia + Supabase (Postgres) + PowerSync (senkron) + PWA**. Yani teknik olarak "Tauri değil, PWA" bir uygulama.

Bizim görevimiz **davranışı taklit etmek**, teknoloji yığınını değil. Aslında bu bizim için avantaj: uygulamanın **iş mantığının %90'ı çerçeveden bağımsız saf TypeScript** (Pinia store'ları, hesaplama fonksiyonları, tip şemaları). Değiştirmemiz gereken temel olarak üç katman var:

| Katman | Orijinal | Bizim hedefimiz |
|---|---|---|
| **Kabuk (shell)** | Nuxt (SPA) + PWA | **Tauri v2** + Vite |
| **UI kütüphanesi** | @nuxt/ui + Tailwind | **Vuetify 3** |
| **Veri/senkron** | Supabase + PowerSync (WASM SQLite) | **Tauri SQL plugin (native SQLite)** + opsiyonel bulut senkron |

Pinia, VueUse, ECharts, zod, date-fns gibi bileşenler **birebir aynen kalır**.

**Tahmini efor:** deneyimli 1 geliştirici için ~**8–12 hafta** (MVP ~4 hafta). En riskli kısımlar: (1) PowerSync yerine senkron stratejisi, (2) @nuxt/ui bileşenlerinin Vuetify'a çevrilmesi, (3) Tauri içinde OAuth akışı.

---

## 2. Finapp Ne Yapıyor? (Özellik Envanteri)

### Finans çekirdeği
- **Cüzdanlar (6 tip):** `cash`, `credit` (kredi limitli), `cashless` (banka), `deposit`, `crypto`, `debt`. Her cüzdanın rengi, para birimi, sıralaması, arşiv durumu, "toplamdan hariç tut", "çekilebilir" bayrağı var.
- **İşlemler (4 mantıksal tip):** Gider, Gelir, Transfer, Düzeltme (adjustment). Dahili **hesap makinesi** (ifade değerlendirme: `2+2*3` gibi).
- **Kategoriler:** İki seviyeli hiyerarşi (parent → child), özel ikon + renk. `showInQuickSelector` (favori) ve `showInLastUsed` bayrakları.
- **Çoklu para birimi:** 165+ döviz, günlük otomatik kur güncellemesi, temel para birimine çevrilmiş toplamlar.

### Analitik
- Dashboard: özet / gider / gelir sekmeleri.
- Bar + çizgi grafikler (ortalama çizgisiyle) — **ECharts**.
- Esnek tarih aralığı: gün / hafta / ay / yıl / özel.
- Kategori kırılımı: birden fazla görünüm modu (yuvarlak, dikey, satır, detaylı).
- Cüzdan ve kategoriye göre çoklu seçimli filtre.

### Offline & Senkron
- İnternet olmadan tam çalışma; yerel SQLite ana kaynak.
- Yeniden bağlanınca arka planda otomatik senkron (PowerSync).
- Cihazlar arası gerçek zamanlı senkron.

### Kişiselleştirme
- Açık / Koyu / Sistem tema.
- 20+ ana renk, 5 nötr palet, ayarlanabilir köşe yuvarlaklığı (border radius).
- Sekme başına dashboard widget yapılandırması.
- İngilizce + Rusça (i18n).
- **Demo modu:** giriş yapmadan, sahte verilerle (`localforage` tabanlı) deneme.

---

## 3. Mevcut Mimari (Derinlemesine)

### 3.1 Monorepo yapısı
```
finapp/
  app/                      # @finapp/app — Nuxt uygulaması
    app/                    # gerçek kaynak kök (~/ alias buraya)
      components/[feature]/  # özelliğe göre gruplanmış bileşenler + store'lar
      pages/                # dosya-tabanlı yönlendirme
      composables/          # useSupabase, useStoreSync, useAuthSession...
      plugins/              # powersync.client.ts, theme.ts
      middleware/           # auth.global.ts
    services/powersync/     # istemci veri katmanı (schema, db, mutations, transforms)
    supabase/               # Postgres migration + edge functions
    powersync/              # kendi-barındırılan PowerSync (docker)
  docs/                     # Docus dokümantasyon sitesi
```

**Önemli desen:** Store'lar sayfa değil, **özellik klasörüyle birlikte** yaşıyor (ör. `components/wallets/useWalletsStore.ts`). Toplam **6 Pinia store'u** var.

### 3.2 Veri Modeli (çerçeveden bağımsız — birebir taşınacak)

5 tablo. Tüm `id` sütunları **istemci tarafında üretilen string UUID** (FK kısıtı yok — senkron sırası garanti değil). Sütunlar camelCase.

**`wallets`**
```ts
type WalletItem = {
  name: string
  type: 'cash' | 'credit' | 'cashless' | 'deposit' | 'crypto' | 'debt'
  currency: string          // ör. 'USD'
  color: string
  desc: string
  order: number             // manuel sıralama (sürükle-bırak)
  isArchived: boolean
  isExcludeInTotal: boolean
  isWithdrawal: boolean
  creditLimit?: number       // yalnızca type === 'credit'
  updatedAt: number
}
```

**`categories`**
```ts
type CategoryItem = {
  name: string
  icon: string              // ör. 'mdi:home'
  color: string
  parentId: string | 0      // 0 = kök kategori
  showInLastUsed: boolean
  showInQuickSelector: boolean
  updatedAt?: number
}
```

**`trns` (işlemler)** — `type` üzerinde ayrımlı birleşim (discriminated union):
```ts
enum TrnType { Expense = 0, Income = 1, Transfer = 2 }

// Gelir/Gider:
type Transaction = {
  type: 0 | 1
  amount: number            // her zaman pozitif
  categoryId: string
  walletId: string
  date: number; desc?: string; updatedAt: number
}

// Transfer:
type Transfer = {
  type: 2
  categoryId: 'transfer'    // literal
  expenseWalletId: string; expenseAmount: number
  incomeWalletId: string;   incomeAmount: number
  date: number; desc?: string; updatedAt: number
}
```

> **Kritik iş kuralı 1:** *Düzeltme (adjustment)*, ayrı bir `TrnType` DEĞİLDİR. `categoryId === 'adjustment'` olan bir Gelir/Gider işlemidir ve gelir/gider istatistiklerinden **hariç** tutulur (bakiye eşitleme amaçlı).
> **Kritik iş kuralı 2:** `'transfer'` ve `'adjustment'` sentetik kategori id'leridir; DB'de satırları yoktur, store'da bellek-içi enjekte edilir.

**`user_settings`** — `baseCurrency`, `locale`, `userId`. Kayıt sırasında trigger ile otomatik oluşur.

**`rates`** — günlük döviz kurları (JSON), sunucu tarafında `fetch-rates` edge function ile doldurulur (Coinbase + Open Exchange Rates birleşimi, pg_cron ile 06:00 UTC). İstemci asla yazmaz.

### 3.3 Store deseni (her store için tekrarlayan yapı)

Her domain store'u aynı yaşam döngüsünü uygular:

1. **`items`** — `shallowRef` ile tutulan `Record<id, item>` (veya `null`).
2. **`init...()`** — `db.watch('SELECT * FROM ...')` ile yerel SQLite'a abone olur. Tek abonelik hem ilk yüklemeyi hem gerçek-zamanlı güncellemeyi karşılar.
3. **`set...()`** — belleği günceller + kalıcılaştırır (demo → localforage, gerçek → cold-start snapshot).
4. **`save.../delete...()`** — **iyimser güncelleme (optimistic update)**: önce belleği/UI'ı günceller, sonra SQLite'a yazar; yazma başarısızsa geri alır (`setX(prev)`).
5. **`primeFromCache()`** — soğuk başlangıçta, watch ilk veriyi yaymadan önce snapshot'tan hızlı boyama.
6. **Türetilmiş `computed`'ler** — sıralı id'ler, favoriler, son kullanılanlar, toplamlar.

> Bu desen **framework'ten tamamen bağımsız**. Pinia + VueUse aynı kaldığı için store'ları neredeyse **hiç değiştirmeden** taşıyabiliriz; sadece `db.watch()` çağrısını (PowerSync) Tauri SQLite watch'una çevireceğiz.

### 3.4 Hesaplama motoru (`components/amount/getTotal.ts`)

İki saf fonksiyon tüm mali matematiği yapar:

- **`getAmountInRate()`** — kur çevrimi:
  ```
  çevrilen = amount / rates[currencyCode] * rates[baseCurrencyCode]
  ```
- **`getTotal()`** — bir işlem kümesi için gelir/gider/transfer/düzeltme toplamları (tek geçiş).
- **`getWalletsTotals()`** — tüm cüzdan bakiyeleri O(N) tek geçişte (gelir − gider + transferler + düzeltmeler).

Bunlar **birebir kopyalanacak**.

### 3.5 İşlem formu (`trnForm`) — en karmaşık UI

- Ayrı bir Pinia store (`useTrnsFormStore`) + ~28 bileşen.
- 3 elemanlı `amount` dizisi: `[işlem, transfer-gider, transfer-gelir]`.
- Dahili hesap makinesi: `createExpressionString` / `evaluateExpression` / `formatInput` (`utils/calculate.ts`).
- Aynı-para-birimli transferde iki tutarı senkron tutma.
- `validate.ts` + `formatData.ts` ile normalize edip `saveTrn`'e gönderir.

### 3.6 Analitik motoru (`components/stat/` — ~70 dosya)

- `useStatConfig` / `useStatPage` / `useStatItem` — yapılandırma ve sayfa durumu.
- `chart/` — ECharts serilerini kuran `useCategorySeriesBuilder`, `useStatChart`.
- `date/useGetDateRange` — gün/hafta/ay/yıl/özel aralık hesabı (date-fns).
- `categories/collectAndGroup` — kategori kırılımı ve gruplama.
- `filter/useFilter` — cüzdan/kategori çoklu filtresi.

### 3.7 Senkron & offline katmanı (`services/powersync/`)

- `AppSchema.ts` — istemci SQLite şeması.
- `db.ts` — lazy singleton `getPowerSyncDb()`; `watchTable`, `waitForFirstSync`.
- `connector.ts` — `SupabaseConnector`: `fetchCredentials` + `uploadData`.
- `mutations.ts` — `upsertRow` / `deleteRow` (INSERT/UPDATE; `ON CONFLICT` yok çünkü PowerSync tabloları view).
- `transforms.ts` — satır ↔ nesne dönüşümü (boolean 0/1, `parentId` null↔0, rates JSON).
- Oturum kaybında senkron **duraklatılır** (yerel veri + kuyruk korunur); yalnızca açık çıkış yerel veriyi siler.

### 3.8 Diğer altyapı
- **Auth:** Supabase Auth (e-posta/şifre + Google OAuth, PKCE, `?code=` dönüşü `/login`'de işlenir).
- **i18n:** `@nuxtjs/i18n`, `no_prefix`, en-US + ru-RU.
- **Tema:** `@nuxt/ui` color mode + `plugins/theme.ts`, CSS değişkenleriyle dinamik ana renk/palet/radius.
- **Yönlendirme:** dosya-tabanlı (`pages/`), global auth middleware.
- **Test:** Vitest (birim) + Playwright (e2e).

---

## 4. Yığın Eşleştirmesi (Orijinal → Hedef)

| İşlev | Finapp (orijinal) | Bizim hedef | Not |
|---|---|---|---|
| Uygulama kabuğu | Nuxt 4 SPA + PWA | **Tauri v2** + Vite | Native pencere + mobil |
| Build/dev | Nuxt/Nitro | **Vite** | Tauri'nin önerdiği |
| Yönlendirme | Nuxt dosya-tabanlı | **Vue Router** | Manuel route tablosu |
| Auto-import | Nuxt yerleşik | **unplugin-auto-import** + **unplugin-vue-components** | `ref`, `computed`, Vuetify bileşenleri otomatik |
| Durum yönetimi | Pinia | **Pinia** | ✅ Aynı |
| Yardımcılar | VueUse | **VueUse** | ✅ Aynı |
| UI kütüphanesi | @nuxt/ui + Tailwind v4 | **Vuetify 3** | ⚠️ En büyük dönüşüm |
| İkonlar | Iconify (mdi/lucide/hugeicons) | **Iconify + Vuetify** (`@iconify/vue`) veya MDI | mdi zaten Vuetify varsayılanı |
| Grafikler | ECharts + vue-echarts | **ECharts + vue-echarts** | ✅ Aynı |
| Yerel DB | PowerSync (wa-sqlite WASM) | **tauri-plugin-sql (native SQLite)** | ⚠️ Senkron ayrı çözülecek |
| Bulut backend | Supabase (Postgres) | **Supabase (opsiyonel)** veya yok | Aşağıda seçenekler |
| Senkron | PowerSync | **3 seçenek** (bkz. §6.2) | ⚠️ Kritik karar |
| Auth | Supabase Auth | **Supabase Auth + tauri-plugin-deep-link** | OAuth geri dönüşü |
| i18n | @nuxtjs/i18n | **vue-i18n** | Aynı sözlükler |
| Kalıcı önbellek | localforage (IndexedDB) | **tauri-plugin-store** veya SQLite | Native |
| Tema/renk | @nuxt/ui color mode | **Vuetify theme** + VueUse `useColorMode` | CSS değişkenleri |
| Doğrulama | zod | **zod** | ✅ Aynı |
| Tarih | date-fns | **date-fns** | ✅ Aynı |
| Sürükle-bırak | @formkit/drag-and-drop | **@formkit/drag-and-drop** veya vuedraggable | Cüzdan sıralama |
| Test | Vitest + Playwright | **Vitest** + Playwright/WebdriverIO | Tauri e2e için WDIO |

**Değişmeden kalan çekirdek (kopyala-yapıştır):** tüm `types.ts` (zod şemaları), `amount/getTotal.ts`, `stat/` içindeki saf util'ler (`intervals`, `collectAndGroup`, `barUtils`, `useGetDateRange`), `trnForm/utils/` (`calculate`, `validate`, `formatData`), `trns/getTrns.ts`, `trns/reconcile.ts`, 6 Pinia store'unun iş mantığı.

---

## 5. Neden Tauri v2 "Tüm Platformlar"ı Karşılıyor?

Tauri v2, tek kod tabanından şunları hedefler:
- **Masaüstü:** Windows (WebView2), macOS (WKWebView), Linux (WebKitGTK).
- **Mobil:** iOS + Android (v2 ile stabil).

Bu, orijinal PWA'nın kapsamını **aşar** (PWA mobilde ikinci sınıf; Tauri'de native uygulama + mağaza dağıtımı + native SQLite/dosya sistemi/derin bağlantı). Web hedefi de istenirse aynı Vite çıktısı tarayıcıda çalışır (PWA olarak) — yani "her yerde".

---

## 6. Tauri Mimari Kararları

### 6.1 Yerel depolama: native SQLite
`tauri-plugin-sql` (SQLite sürücüsü) yerel ana kaynak olur. PowerSync'in wa-sqlite WASM'ı yerine native SQLite:
- Daha hızlı, daha az bellek, tüm platformlarda çalışır.
- Store'lardaki `db.watch('SELECT ...')` deseni korunur; SQLite değişimini yaymak için ince bir **watch sarmalayıcı** yazarız (mutasyondan sonra ilgili tabloyu yeniden sorgulayıp emit eden bir olay yayıncısı — PowerSync'in `watchTable` API'sini taklit eder). Böylece store'lar neredeyse hiç değişmez.

> **Bu kararın tam gerekçesi, 5-platform uyumluluk matrisi, reddedilen alternatifler ve Android tuzağı/çözümü için bkz. § 14 "Veritabanı Kararı (Kapsamlı Analiz)".**

### 6.2 Senkron stratejisi (kritik karar — 3 seçenek)

Kullanıcı listesinde Supabase/PowerSync **yok**. Bu yüzden senkronu bilinçli seçmeliyiz:

| Seçenek | Açıklama | Artı / Eksi |
|---|---|---|
| **A) Yalnız yerel** (MVP) | Sadece native SQLite, senkron yok | ➕ En hızlı yol, sıfır backend. ➖ Cihazlar arası senkron yok |
| **B) Supabase'i koru** | Supabase (Postgres + Auth) + PowerSync SDK'sını Tauri webview'inde çalıştır | ➕ Finapp'e en sadık. ➖ Yığına Supabase ekler; mobilde PowerSync WASM riskli |
| **C) Hafif özel senkron** | Supabase REST/Realtime + `updatedAt` tabanlı "last-write-wins" çekme/gönderme kuyruğu | ➕ Kontrol bizde, native uyumlu. ➖ Çakışma çözümünü kendimiz yazarız |

**Önerilen yol:** **A ile başla** (MVP'yi hızla çıkar), mimariyi **C'ye açık** tasarla (mutasyonları bir `outbox` tablosuna da yaz; her satırda `updatedAt` zaten var). Böylece senkronu sonradan, çekirdeği bozmadan ekleyebiliriz. B, yalnızca Finapp'in PowerSync davranışını birebir istiyorsak.

> Not: Store'ların hepsi zaten "demo modu" (senkronsuz, localforage) ile "gerçek mod" ayrımı yapıyor. Yani **senkronsuz çalışma mimaride hazır** — biz "gerçek mod"u native SQLite'a bağlarız.

### 6.3 Kimlik doğrulama
- Yalnız-yerel (Seçenek A) için: hafif yerel profil / PIN, gerçek auth gerekmez.
- Bulut için: Supabase Auth + **tauri-plugin-deep-link** ile OAuth geri dönüşü (`finapp://callback`) ve **tauri-plugin-opener** ile sistem tarayıcısında Google girişi.

### 6.4 Döviz kurları
Edge function yerine: küçük bir istemci servisi günde bir kez ücretsiz bir kur API'sinden (ör. open.er-api.com / Coinbase) çeker, `rates` tablosuna yazar, `tauri-plugin-http` ile CORS'suz istek atar. Offline'da son kayıtlı kurlar kullanılır.

---

## 7. Önerilen Proje Yapısı

```
weltoly/                          # (veya proje adınız)
  src-tauri/                       # Rust — Tauri kabuğu
    tauri.conf.json                # pencere, izinler, bundle hedefleri
    capabilities/                  # plugin izinleri (sql, deep-link, http, store)
    migrations/                    # SQLite şema migration'ları
    src/main.rs
  src/                             # Vue uygulaması (Vite kökü)
    main.ts                        # createApp + Pinia + Router + Vuetify + i18n
    router/index.ts                # Vue Router route tablosu
    plugins/vuetify.ts             # Vuetify tema + renk sistemi
    layouts/                       # DefaultLayout, EmptyLayout
    pages/                         # dashboard, wallets, categories, stat, settings...
    features/                      # finapp'in "components/[feature]" karşılığı
      wallets/  { store, types, components/ }
      categories/{ store, types, components/ }
      trns/     { store, types, getTrns, reconcile, components/ }
      trnForm/  { store, utils/, components/ }
      stat/     { composables, chart/, date/, components/ }
      currencies/{ store, types }
      user/     { store }
    services/
      db/        # tauri-plugin-sql sarmalayıcı + watchTable taklidi + mutations
      sync/      # (opsiyonel) outbox + Supabase istemcisi
      rates/     # kur çekme servisi
    composables/ # useColorMode, useDb, useAuthSession...
    shared/lib/  # amount/getTotal, utils (finapp'ten kopya)
    i18n/        # tr, en, ru sözlükleri
  vite.config.ts                   # + unplugin-auto-import, unplugin-vue-components(Vuetify)
```

---

## 8. Özellik-Özellik Uygulama Planı

| # | Modül | Kaynak (finapp) | İş | Zorluk |
|---|---|---|---|---|
| 1 | Proje iskeleti | — | Tauri v2 + Vite + Vue + Vuetify + Pinia + Router + i18n kur | Orta |
| 2 | DB katmanı | `services/powersync/` | tauri-plugin-sql sarmalayıcı + migration + `watchTable` taklidi + `upsertRow/deleteRow` | **Yüksek** |
| 3 | Tipler & şemalar | `*/types.ts` | Kopyala (zod aynen) | Düşük |
| 4 | Hesaplama motoru | `amount/getTotal.ts` | Kopyala | Düşük |
| 5 | Cüzdan store + UI | `wallets/` | Store kopya; UI Vuetify'a çevir (liste, form, sürükle-sırala) | Orta |
| 6 | Kategori store + UI | `categories/` | Store kopya; hiyerarşik ağaç UI (Vuetify) | Orta |
| 7 | İşlem store | `trns/` | Store + `getTrns` + `reconcile` kopya | Orta |
| 8 | İşlem formu | `trnForm/` | Store + calculator kopya; UI'yı Vuetify ile yeniden (en yoğun UI) | **Yüksek** |
| 9 | Para birimi + kurlar | `currencies/` + edge fn | Store kopya; kur çekme servisi yaz | Orta |
| 10 | Analitik/istatistik | `stat/` | Saf util'ler kopya; grafik UI ECharts (aynen); config panelleri Vuetify | **Yüksek** |
| 11 | Tema/kişiselleştirme | `theme.ts` + color | Vuetify theme + renk/palet/radius ayarları | Orta |
| 12 | i18n | `i18n/` | vue-i18n; tr sözlüğü ekle | Düşük |
| 13 | Auth (opsiyonel) | `useSupabase` + middleware | yerel profil VEYA Supabase+deep-link | Orta/Yüksek |
| 14 | Senkron (opsiyonel) | PowerSync | outbox + last-write-wins | **Yüksek** |
| 15 | Demo modu | `demo/` | mock veriler + localforage/SQLite bellek | Düşük |
| 16 | Paketleme | — | Tüm hedefler için bundle + imzalama | Orta |

---

## 9. Kritik Zorluklar & Riskler

1. **PowerSync'in yerine konması (en yüksek risk).** Finapp'in reaktivitesi `db.watch()`'a dayanıyor. tauri-plugin-sql yerleşik "watch" sunmaz; mutasyondan sonra ilgili tabloyu yeniden sorgulayıp store'a emit eden bir olay katmanı yazmalıyız. İyi haber: store'lar zaten iyimser güncelleme yaptığı için watch gecikmesi görünmez.
2. **@nuxt/ui → Vuetify dönüşümü.** ~250 bileşen dosyası var. Vuetify'ın Material Design'ı, @nuxt/ui'ın minimalist estetiğinden farklı görünür. Estetiği birebir istiyorsak Vuetify temasını ciddi özelleştirmemiz (veya bazı `components/ui/` primitiflerini elle yeniden yazmamız) gerekir.
3. **Tauri içinde OAuth.** Webview'de üçüncü-parti OAuth pop-up'ları kısıtlıdır; deep-link + sistem tarayıcısı akışı gerekir. Yalnız-yerel MVP bu riski tamamen atlar.
4. **Mobil (iOS/Android) tuhaflıkları.** SQLite izinleri, güvenli alan (safe area), klavye davranışı, dokunmatik hedefler — Vuetify mobilde iyi ama test şart.
5. **ECharts + Vuetify tema uyumu.** Grafik renklerini Vuetify temasının CSS değişkenlerine bağlamak gerekir (finapp bunu Tailwind değişkenleriyle yapıyor).
6. **Hesap makinesi & çoklu-para transfer mantığı.** İnce kenar durumları var (aynı/farklı para birimi senkronu); `trnForm/utils` testleriyle birlikte kopyalanmalı.
7. **Sürükle-bırak sıralama.** `@formkit/drag-and-drop` Vue ile çalışır; mobilde dokunma davranışını doğrulayın.

---

## 10. Faz Faz Yol Haritası

**Faz 0 — İskelet (3–4 gün)**
Tauri v2 + Vite + Vue 3 + Vuetify 3 + Pinia + Vue Router + VueUse + vue-i18n kurulumu. Boş sayfalar + navigasyon kabuğu. Tüm platformlarda "hello world" derlenmesi doğrulanır.

**Faz 1 — Veri katmanı (1 hafta)**
tauri-plugin-sql + SQLite migration'ları (5 tablo). `services/db/` sarmalayıcı: `watchTable`, `upsertRow`, `deleteRow`, `transforms`. Tipler ve `amount/getTotal` kopyalanır. Birim testler.

**Faz 2 — Çekirdek CRUD (2 hafta)**
Cüzdanlar, kategoriler, işlemler store'ları + Vuetify UI. İşlem formu + hesap makinesi. Bu noktada uygulama **yerel olarak tam işlevsel** (senkronsuz) — MVP.

**Faz 3 — Analitik (1.5 hafta)**
`stat/` util'leri + ECharts grafikleri + tarih aralığı + filtreler + config panelleri. Dashboard sekmeleri.

**Faz 4 — Para birimi & kişiselleştirme (1 hafta)**
Kur çekme servisi, çoklu-para toplamlar, tema/renk/radius ayarları, i18n (tr/en/ru), demo modu.

**Faz 5 — (Opsiyonel) Auth + Senkron (1.5–2 hafta)**
Supabase Auth + deep-link OAuth; outbox tabanlı senkron; çakışma çözümü.

**Faz 6 — Paketleme & yayın (1 hafta)**
Windows/macOS/Linux installer'ları, iOS/Android build, kod imzalama, ikonlar, mağaza hazırlığı.

---

## 11. Bağımlılık Listesi (öneri)

```jsonc
// package.json (frontend)
{
  "dependencies": {
    "vue": "^3.5",
    "vue-router": "^4",
    "pinia": "^3",
    "@vueuse/core": "^14",
    "vuetify": "^3.9",
    "@mdi/font": "^7",            // veya @iconify/vue
    "vue-i18n": "^11",
    "echarts": "^6",
    "vue-echarts": "^8",
    "zod": "^4",
    "date-fns": "^4",
    "es-toolkit": "^1",
    "@formkit/drag-and-drop": "^0.6",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "@tauri-apps/plugin-store": "^2",
    "@tauri-apps/plugin-http": "^2",
    "@tauri-apps/plugin-deep-link": "^2",   // auth için
    "@tauri-apps/plugin-opener": "^2",
    "@supabase/supabase-js": "^2"           // yalnız bulut senkron seçilirse
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "vite": "^6",
    "@vitejs/plugin-vue": "^5",
    "vite-plugin-vuetify": "^2",
    "unplugin-auto-import": "^0.18",
    "unplugin-vue-components": "^0.27",
    "vitest": "^3",
    "vue-tsc": "^2",
    "typescript": "^5"
  }
}
```

```toml
# src-tauri/Cargo.toml — pluginler
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
tauri-plugin-http = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-opener = "2"
```

---

## 12. Sonuç & Öneri

- Finapp'in **iş mantığı framework'ten bağımsız ve iyi test edilmiş** — bu, taklidi büyük ölçüde bir **"kabuk değiştirme"** (Nuxt/PWA → Tauri) + **"UI yeniden derisi"** (@nuxt/ui → Vuetify) işine indirger.
- **En hızlı değer:** Faz 0–4'ü tamamlayıp **yalnız-yerel, senkronsuz** ama tam işlevsel bir Tauri uygulaması çıkarmak (~4–6 hafta). Senkron/auth sonradan, çekirdeği bozmadan eklenebilir çünkü store'lar zaten "demo (yerel)" vs "gerçek (uzak)" ayrımını içeriyor.
- **En büyük iki karar:** (1) senkron olacak mı? (§6.2 → öneri: sonradan-eklenebilir tasarımla A ile başla), (2) Vuetify Material görünümü kabul mü, yoksa @nuxt/ui minimalizmini birebir mi taklit edeceğiz (birebir taklit UI eforunu ~2×'ler).

> **Bir sonraki adım için önerim:** Faz 0 iskeletini kurmama izin verin; ardından veri katmanını (Faz 1) — projenin en riskli parçasını — çalışır hale getirip erken doğrulayalım.

---

## 13. Alınan Kararlar (2026-07-12)

- **Veritabanı:** **`tauri-plugin-sql` + `sqlite` özelliği** (sqlx ile derlemeye gömülü/bundled SQLite). 5 platformun (Android/iOS/macOS/Windows/Linux) tamamında resmî destekli. Tam gerekçe → § 14.
- **Senkron:** *Yerelle başla, sonra ekle* (Seçenek A). MVP native SQLite ile senkronsuz çalışacak; mimari outbox + `updatedAt` ile senkrona açık tasarlanacak.
- **UI stili:** *Vuetify Material* (Seçenek: önerilen). Vuetify'ın kendi Material estetiği kullanılacak, tema finapp renkleriyle özelleştirilecek — @nuxt/ui birebir taklit edilmeyecek.
- **Durum:** Analiz/rapor aşaması tamam. Kodlamaya (Faz 0 iskeleti) başlama kararı kullanıcıda bekliyor.

---

## 14. Veritabanı Kararı (Kapsamlı Analiz)

> **Soru:** Android, iOS, macOS, Windows ve Linux'ta **sorunsuz** çalışacak ideal yerel veritabanı hangisi?
> **Kesin cevap:** **SQLite**, resmî **`tauri-plugin-sql`** eklentisiyle (`sqlite` Cargo özelliği açık → SQLx, derlemeye **gömülü/bundled** SQLite kullanır). + UI tercihleri gibi hafif anahtar-değer verisi için tamamlayıcı olarak **`tauri-plugin-store`**.

### 14.1 Neden SQLite (motor kararı)

Bu bir finans uygulaması: en büyük tablo `trns` (işlemler) yıllar içinde **on binlerce satıra** ulaşır ve uygulama sürekli **toplama/gruplama/tarih-aralığı sorguları** çalıştırır (bakiyeler, istatistikler). Bu yük profili ilişkisel + indeksli bir motor ister:

- **SQLite** her platformda gömülü, sunucusuz, tek dosya, ACID; milyonlarca satırı rahat kaldırır. finapp'in tüm veri katmanı (PowerSync üzerinden) zaten SQLite; şema ve sorgular **doğrudan taşınır**.
- Alternatif "webview içi depolama" (IndexedDB) toplama sorgularında ve büyük veri setlerinde yetersiz kalır — finapp bunu yalnızca **demo modu** için kullanıyor, ana kaynak olarak değil.

### 14.2 Neden resmî `tauri-plugin-sql` (uygulama kararı)

| Kriter | Değerlendirme |
|---|---|
| **5 platform desteği** | Resmî dokümanın destek tablosu: **windows, linux, macos, android, ios** — beşi de listeli. |
| **Bakım** | Tauri çekirdek ekibi (`plugins-workspace`) tarafından bakılıyor — uzun ömür garantisi. |
| **Migration** | Yerleşik `Migration` struct (version + description + SQL + Up/Down), tümü tek transaction içinde atomik. finapp'in 5 tablosunu doğrudan tanımlarız. |
| **Gömülü SQLite** | `sqlite` özelliği SQLx üzerinden SQLite'ı **derlemeye gömer** — cihazdaki sistem `libsqlite3`'e bağımlı değildir (Android'de bu kütüphane yoktur; bkz. 14.4). |
| **API** | JS tarafında `Database.load()`, `.execute()`, `.select()` — ince, IPC üzerinden Rust'a gider. |
| **Ek ihtiyaç** | Bizim mimari için tam yeterli; ORM istenirse **Drizzle** bu eklentiyle çalışıyor (opsiyonel). |

### 14.3 5-Platform Uyumluluk Matrisi

| Platform | Webview motoru | SQLite durumu | Not |
|---|---|---|---|
| **Windows** | WebView2 | ✅ Gömülü SQLite | Sorunsuz |
| **macOS** | WKWebView | ✅ Gömülü SQLite | Sorunsuz |
| **Linux** | WebKitGTK | ✅ Gömülü SQLite | Sorunsuz |
| **iOS** | WKWebView | ✅ Gömülü SQLite | Tauri v2'den beri destekli |
| **Android** | Android WebView | ✅ Gömülü SQLite | **Koşul:** SQLite gömülü derlenmeli (14.4) |

> Kritik nokta: veritabanı **webview'de değil, Rust (native) katmanında** çalışır. Yani platformlar arası webview farkları (OPFS/IndexedDB tutarsızlıkları, iOS WKWebView kotaları) veriyi **etkilemez** — reaktivite ve depolama tamamen native tarafta.

### 14.4 Android tuzağı ve çözümü (tek gerçek risk)

Geçmişte Android'de iki bilinen hata var:
1. `missing libsqlite3.so.0` — SQLite'ı **sistem kütüphanesine dinamik bağlama** girişimi. Android'de böyle bir sistem kütüphanesi garanti değildir.
2. `UnsatisfiedLinkError: __extenddftf2` — bazı Android ABI'lerinde soft-float sembol linkleme hatası (özellikle `rusqlite` ile).

**Çözüm (mimaride baştan uygulanacak):**
- `rusqlite` **değil**, resmî eklentinin **SQLx + `sqlite`** yolunu kullan → SQLite kaynaktan **statik/gömülü** derlenir, sistem kütüphanesine bağımlılık ortadan kalkar.
- Android NDK doğru kurulu, `libsqlite3-sys`'in `bundled` özelliği aktif (SQLx `sqlite` bunu sağlar).
- Her platform hedefini CI'de en az bir kez derleyip çalıştır (Faz 0 çıkış kriteri).

Bu koşullar sağlandığında Android dahil beş platformda sorun yaşanmaz.

### 14.5 Reaktivite (önemli mimari not)

`tauri-plugin-sql`, PowerSync'teki gibi **yerleşik `watch`/değişiklik aboneliği sunmaz**. finapp'in tüm store'ları `db.watch('SELECT ...')` ile reaktif. Çözüm — ince bir sarmalayıcı:
- Mutasyondan (`upsertRow`/`deleteRow`) sonra ilgili tabloyu işaretle → yeniden sorgula → store'a emit et.
- Store'lar zaten **iyimser güncelleme** yaptığı için UI anında güncellenir; yeniden-sorgu ekosunun gecikmesi görünmez (finapp'teki `reconcile` deseninin birebir aynısı).

Bu sayede store dosyalarını **neredeyse değiştirmeden** taşırız; yalnızca `services/db/` altındaki `watchTable`/`upsertRow`/`deleteRow` gerçekleştirmeleri PowerSync yerine tauri-plugin-sql'e bağlanır.

### 14.6 Hibrit depolama (net iş bölümü)

| Veri türü | Nereye | Neden |
|---|---|---|
| İlişkisel domain (`wallets`, `categories`, `trns`, `rates`, `user_settings`) | **SQLite** (tauri-plugin-sql) | Sorgu/toplama/ilişki gerektirir |
| Salt-UI tercihleri (tema, ana renk, radius, aktif sekme, son görünüm) | **tauri-plugin-store** (JSON KV) | Basit, ilişkisel değil; hızlı okuma |
| Demo modu | Bellek + `tauri-plugin-store`/SQLite-bellek | Kalıcılık gerekmeyen deneme |

### 14.7 Değerlendirilen ve reddedilen alternatifler

| Aday | Neden ana çözüm değil |
|---|---|
| **IndexedDB / localforage** (webview) | Toplama sorgularında ve büyük veri setinde yetersiz; platformlar arası webview farkları. Yalnız demo için kabul. |
| **wa-sqlite / OPFS SQLite** (WASM, webview) | PowerSync'in yaptığı; WASM ağırlığı + mobil webview OPFS tuhaflıkları. Native SQLite dururken gereksiz. |
| **rusqlite** | Android emülatöründe çökme raporları; SQLx tercih edilir. |
| **PGlite / Postgres-in-WASM** | Bu ölçek için aşırı; büyük bundle. |
| **libsql / Turso (`tauri-plugin-libsql`)** | **Reddedilmedi — ertelendi.** Native AES-256 şifreleme + Turso "embedded replica" ile **hazır local-first senkron** sunar. Senkron fazına (Faz 5) geldiğimizde, özel outbox yazmak yerine bunu değerlendirmek mantıklı. Topluluk eklentisi olduğu için MVP'de resmî eklenti tercih edilir. |

### 14.8 Şifreleme (ileriye dönük not)

Resmî SQLx eklentisi **SQLite şifrelemesi sunmaz**. Cihaz kaybında veri gizliliği kritik olursa iki yol var: (a) **SQLCipher** entegrasyonu, (b) senkron fazında **libsql** (yerleşik AES-256). MVP yalnız-yerel olduğundan bu, senkron/güvenlik fazına ertelenebilir bir karardır.

### 14.9 Sonuç

**İdeal veritabanı = SQLite (resmî `tauri-plugin-sql`, `sqlite`/bundled) + tercih verisi için `tauri-plugin-store`.** Beş platformda resmî destekli, finapp şemasıyla birebir uyumlu, bakımlı ve migration'lı. Tek dikkat noktası Android'de **gömülü derleme** (14.4) — bu da mimaride baştan garanti altına alınır. Senkron/şifreleme gerektiğinde **libsql/Turso** yükseltme yolu açık bırakılır.

---

## 15. Yedekleme & Senkron Seçenekleri

> **Not:** Google Workspace / Google Drive entegrasyonu değerlendirildi ve **kullanılmayacak** (karar 2026-07-12). Bu bölüm Drive'sız yedekleme ve senkron yolunu tanımlar.

### 15.1 Yerel dosya yedekleme (herkes için, önerilir)

- Kullanıcının cihazına **yerel dosya dışa/içe aktarımı**: SQLite dosyasının tamamı veya JSON export/import (`tauri-plugin-dialog` + `tauri-plugin-fs`).
- Bulut bağımlılığı yok, kurumsal politika engeli yok, 5 platformda çalışır. Kullanıcı yedeğini dilediği yerde (kendi USB'si, kendi bulutu vb.) saklar.

### 15.2 Gerçek çok-cihazlı senkron (opsiyonel, Faz 5)

- Dosya-tabanlı senkron (koca dosyayı yükle-indir) finans verisi için **uygun değildir** — satır-bazlı birleştirme yapmaz, iki cihaz aynı anda düzenlerse son-yazan-kazanır → veri kaybı.
- Gerekirse **satır-bazlı** bir çözüm kullanılır: **libsql/Turso embedded replica** veya **PowerSync**. Her satırda zaten `updatedAt` var; mimari outbox ile buna hazır (§6.2).

### 15.3 Katmanlı strateji

| Katman | Çözüm | Faz |
|---|---|---|
| **Birincil depo** | Native SQLite (tauri-plugin-sql) | Faz 1 |
| **Yerel yedek/taşıma** (herkes için) | Dosya export/import (SQLite/JSON) | Faz 4 |
| **Gerçek çok-cihazlı senkron** (opsiyonel) | libsql/Turso embedded replica veya PowerSync | Faz 5 |

Bu seçeneklerin hiçbiri yalnız-yerel MVP'yi bloklamaz; hepsi Faz 4–5 eklemeleridir.
