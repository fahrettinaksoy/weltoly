# 📋 Weltoly — Kapsamlı Mimari & Kod Kalitesi Raporu

**Tarih:** 2026-07-16
**Kapsam:** ~90 kaynak dosya, ~15k satır (TS/Vue) + Rust/Tauri backend + 5 SQL migrasyonu
**Yöntem:** 4 paralel derin-analiz ajanı (veri/güvenlik, finansal domain, Vue UI, auth/config) + çekirdek mimari inceleme

> Bu rapor **yalnızca analizdir** — hiçbir dosya değiştirilmemiştir.

---

## Genel Değerlendirme (Skorkart)

| Alan | Not | Yorum |
|------|-----|-------|
| Mimari kurgu | 🟢 İyi | Feature-based yapı, local-first, outbox + event-bus reaktivite bilinçli |
| Kod belgelemesi | 🟢 Çok iyi | Türkçe yorumlar "neden"i anlatıyor, kararlar gerekçeli |
| **Para bütünlüğü** | 🔴 Kritik | Float aritmetik + sessiz 1:1 kur fallback |
| **Backup/güvenlik** | 🔴 Kritik | SQL injection yüzeyi, atomik olmayan restore, geniş fs izni, CSP kapalı |
| **Auth (PIN)** | 🔴 Kritik | Kozmetik kilit, brute-force koruması yok |
| Test kapsamı | 🟠 Zayıf | En riskli katman (yazma/para/backup) test edilmemiş; test-kopya drifti |
| **DevEx/kalite kapısı** | 🔴 Eksik | Lint yok, CI'da typecheck/test yok, pre-commit yok |
| i18n | 🟢 Çok iyi | tr/en/ru üçü de tam 302 anahtar, eksik yok |
| Tip güvenliği | 🟡 Orta | `strict` açık ama DB katmanı `any`, çok sayıda `as`/`!` |

---

## 🔴 KRİTİK Bulgular

### K-1 · Para birimi IEEE-754 float olarak saklanıp işleniyor
**Dosyalar:** `src-tauri/migrations/001_init.sql:38` (`amount/expenseAmount/incomeAmount/creditLimit REAL`) → `src/services/db/transforms.ts:55`, `src/shared/lib/getTotal.ts`, `src/features/wallets/store.ts`

Tüm tutarlar `REAL` (double) olarak saklanıyor, tüm toplama/çıkarma/dönüşüm ham JS float'ında yapılıyor. Hesap makinesi 8 ondalığa kadar üretebildiği için (kripto) hata payı büyür. `0.1+0.2` sınıfı hata yüzlerce işlemde kuruş düzeyinde birikir; kredi limiti, net varlık ve grafik tabanı bu hatayı taşır. **Finans uygulaması için kabul edilemez.**

**Çözüm:** Parayı **tamsayı minor unit** (kuruş/satoshi) olarak `INTEGER` sakla, ya da `decimal.js`/`dinero.js` kullan. Merkezi bir `Money` tipi + `addMoney/sumMoney` (her adımda round) yardımcıları; ham `+`/`-` ile para toplamayı yasakla. *Bu mimari düzeyde en yüksek teknik borç.*

### K-2 · `importBackup` — güvenilmeyen JSON'dan identifier ile SQL injection + veri kaybı
**Dosya:** `src/services/backup/index.ts:51-67`

```ts
const quoted = cols.map(c => `"${c}"`).join(', ')   // kolon adı JSON anahtarından
await db.execute(`DELETE FROM ${t}`)                 // önce hepsini sil, transaction YOK
```

İki ayrı kritik sorun:
- **(a) SQL injection:** Kolon adları içe-aktarılan dosyanın JSON anahtarlarından geliyor; anahtarda çift tırnak varsa tırnak kaçışı kırılır → keyfi SQL. Değerler parametreli ama **identifier'lar değil**.
- **(b) Veri kaybı:** Her tablo önce `DELETE`, sonra satır-satır INSERT — hiçbir transaction yok. Ortada hata olursa mevcut veri silinmiş, yenisi eksik yazılmış olur; `version` alanı da hiç doğrulanmıyor.

**Çözüm:** Kolon adlarını tablo bazlı **allow-list**'ten geçir (`assertTable` desenini kolon seviyesine taşı); `[^A-Za-z0-9_]` içeren anahtarı reddet. Tüm restore'u tek transaction'a sar (tercihen tek Rust `#[command]` + `sqlx::Transaction`) ve import öncesi otomatik yedek al. `data.app==='weltoly'` + `version` uyumunu **önce** doğrula.

### K-3 · PIN kilidi kozmetik + brute-force koruması yok
**Dosyalar:** `src/features/auth/useLockStore.ts`, `src/App.vue:129`, `src/features/auth/LockScreen.vue:12-22`

PIN = `SHA-256("weltoly.pin.v1" + pin)` — **tek tur, koda gömülü sabit salt**, sonuç düz `localStorage`'da. `isLocked` sadece reaktif bir `ref`; kilitliyken **altındaki finansal veri DOM'da render edilmeye devam ediyor** → DevTools'tan `lock.isLocked=false` ya da SQLite dosyasına erişim kilidi tamamen baypas eder. 4 haneli PIN (10.000 kombinasyon) için deneme sayacı/backoff/kilitleme yok; hash offline mikrosaniyede kırılır.

**Çözüm:**
1. Kilitliyken layout'u `v-if` ile DOM'dan tümüyle kaldır.
2. PBKDF2/argon2 + **per-cihaz rastgele salt** (`crypto.getRandomValues`), min 6 hane.
3. Kalıcı başarısız-deneme sayacı + üstel backoff.
4. UI'da "PIN veriyi şifrelemez, yalnızca gösterim kilididir" ibaresi — ya da gerçek gizlilik için SQLCipher/`tauri-plugin-stronghold` ile at-rest şifreleme.

---

## 🟠 YÜKSEK Bulgular

### Y-1 · Eksik kur oranında sessiz 1:1 dönüşüm → yanlış toplamlar
**Dosyalar:** `src/shared/lib/getTotal.ts:22` · `src/features/stat/store.ts:157`

```ts
return amount / (rates[currencyCode] ?? 1) * (rates[baseCurrencyCode] ?? 1)
```

Cüzdanın kuru `rates`'te yoksa `?? 1` devreye girer → 10.000 EUR, EUR kuru yokken 10.000 USD gibi net'e girer. Ekranda tamamen makul görünür, hiçbir uyarı yok. Cüzdan bulunamayınca `?? 'USD'` de sessizce yanlış varsayar. **En sinsi sınıf: sessiz veri bütünlüğü hatası.**

**Çözüm:** Eksik kuru yutma — dönüşümü `null` döndürüp cüzdanı toplamdan **açıkça hariç tut** + UI'da "kur eksik" rozeti göster. `?? 1` yalnız `base===currency` iken güvenli.

### Y-2 · Kur API yanıtı doğrulanmadan DB'ye ve hesaba giriyor + timeout yok
**Dosya:** `src/services/rates/index.ts:23-27`

Uzak API yanıtı tip-cast ile `Rates` kabul ediliyor; değerlerin sayı/pozitif/sonlu olduğu doğrulanmıyor. Bir kur `0`/negatif/`null` gelirse `Infinity`/`NaN` üretir ve tüm çoklu-para toplamlarını zehirler. `fetch`'te timeout da yok — API asılırsa sonsuz bekler.

**Çözüm:** Yanıtı zod/valibot ile doğrula (`typeof v==='number' && isFinite(v) && v>0`), geçersiz kodları at; `AbortController` ile timeout ekle.

### Y-3 · Mutasyon + outbox atomik değil (transactional outbox eksik)
**Dosyalar:** `src/services/db/mutations.ts:32-47`, `src/services/db/outbox.ts:21-24`

Ana yazma ve outbox iki ayrı `execute`; arada çökme olursa mutasyon kalır, outbox kaydı oluşmaz → Faz 5 senkronunda **kalıcı sapma**. `outbox.ts` hatayı yutuyor, sapmayı gizliyor. `upsertRows` döngüsü de transaction'sız → cüzdan yeniden-sıralamada yarısı yeni/yarısı eski `order`. `deleteTrnsReferencing` ise outbox'a hiç yazmıyor (`src/services/db/mutations.ts:61-73`).

**Çözüm:** Çok-adımlı yazmaları tek Rust komutu + `sqlx` transaction ile expose eden **repository + unit-of-work** katmanı. Bu deseni şimdi kurmak Faz 5'i kurtarır.

### Y-4 · CSP kapalı + `fs` izni `$HOME/**` (XSS → veri imhası zinciri)
**Dosyalar:** `src-tauri/tauri.conf.json:22-24` (`"csp": null`) · `src-tauri/capabilities/default.json:16-23`

CSP devre dışı + ön yüz JS'i tüm home dizinini okuyup yazabiliyor. Bir XSS (işlem açıklaması/etiket adında render edilen girdi) → geniş fs izni + `sql:allow-execute` ile zincirlenince keyfi SQL + `$HOME` altındaki dosyaları (SSH anahtarları vb.) okuma/yazma → tam veri sızması.

**Çözüm:** Sıkı CSP (`default-src 'self'; connect-src <kur-api-hostları>; ...`, `'unsafe-eval'` verme). `fs $HOME/**` iznini kaldır; backup için dialog'un döndürdüğü tek yola scope-tabanlı erişim ya da yolu Rust komutunda doğrula (**en az yetki**).

### Y-5 · Testler üretim mantığını değil, elle kopyalanmış KOPYASINI test ediyor
**Dosyalar:** `src/features/wallets/balanceSeries.test.ts` vs `WalletBalanceChart.vue` · `periodCompare.test.ts` vs 3 sayfadaki `changeRatio`/`deltaTone` kopyası · `trnFilters.test.ts` vs `filterTrnsIds`

`signedAmount`, `buildSeries`, `changeRatio`, `deltaTone`, `applyFilters`, `tagBreakdown` üretimde `.vue` içinde yaşıyor; test dosyaları aynı mantığı **elle kopyalayıp** onu test ediyor. Üretim kopyası değişse (bir yerde `<` diğerinde `<=`) test yakalamaz → **yanlış güven**. Gerçek `filterTrnsIds` hiç test edilmiyor.

**Çözüm:** Saf finansal mantığı bileşenlerden çıkar → `features/wallets/lib/` (veya `stat/periodCompare.ts`) altında **tek kaynak**; hem `.vue` hem test bunu `import` etsin.

### Y-6 · CI'da kalite kapısı yok + lint/pre-commit yok
**Dosya:** `.github/workflows/release.yml` (tek workflow, yalnız tag'de build)

`typecheck`/`test` script'leri var ama **hiçbir PR/push workflow'u çalıştırmıyor**. ESLint/Prettier **kurulu değil** (kalıntı: `src/features/color/colors.ts:1`'de `eslint-disable perfectionist` yorumu — bir zamanlar planlanmış). Pre-commit hook yok. Bozuk tip/kırık test main'e sızabilir.

**Çözüm:** `ci.yml` (`on: [push, pull_request]` → `npm ci` → `typecheck` → `test`) + branch protection. `@antfu/eslint-config` (kod zaten o stilde) + `lint` script. `simple-git-hooks` + `lint-staged`.

### Y-7 · Tanrı-bileşen + %60 tekrar eden filtre-tablo
**Dosyalar:** `src/pages/WalletDetailPage.vue` **1265 satır** · `src/pages/TransactionsPage.vue:334-456`

`WalletDetailPage.vue` tek dosyada iki tam özellik (Özet + İşlemler) + tam filtre motoru barındırıyor. Filtreli sanal-tablo bloğu `TransactionsPage.vue` ile neredeyse karakter-karakter aynı (`trnKind`, `KIND_META`, filtre şeması, `clearFilters` dahil).

**Çözüm:** `WalletSummary.vue` + `WalletTransactions.vue`'ye böl; ortak `TrnFilterTable.vue` bileşeni + `features/trns/kind.ts` çıkar; akış mantığını `useWalletFlow()` composable'ına taşı.

#### En büyük / en karmaşık 5 `.vue` dosyası

| # | Dosya | Satır | Bölünmeli mi? |
|---|-------|-------|----------------|
| 1 | `src/pages/WalletDetailPage.vue` | **1265** | **Evet, acilen** — iki tam özellik tek dosyada |
| 2 | `src/pages/DashboardPage.vue` | 574 | Kısmen — script mantığı composable'a |
| 3 | `src/pages/TransactionsPage.vue` | 568 | ~%60'ı WalletDetailPage ile aynı |
| 4 | `src/pages/WalletsPage.vue` | 550 | Sınırda; şu haliyle kabul edilebilir |
| 5 | `src/pages/CategoriesPage.vue` | 435 | Kabul edilebilir |

---

## 🟡 ORTA Bulgular

| ID | Dosya | Sorun | Çözüm |
|----|-------|-------|-------|
| O-1 | `src/features/trns/getTrns.ts:47-50` | `filterTrnsIds` sıralı yolda çağıranın dizisini **yerinde** `.sort()` ile mutasyona uğratıyor | `.slice()`/`.toSorted()` — girdiyi asla mutasyona uğratma |
| O-2 | `src/features/trns/getTrns.ts:27-29` | Tarih aralığı sınırı normalize edilmiyor, off-by-one riski (`end`=00:00 → o günün tümü elenir) | Yarı-açık `[start, end)` konvansiyonu veya fonksiyon içinde `getEndOf(end,'day')` |
| O-3 | `src/services/db/watch.ts:6-14` | `parseTables` regex ile tablo bağımlılığını tahmin ediyor → alt sorgu/CTE'de yanlış/kaçırılan invalidation | `watchTable`'a açık `tables: string[]` parametresi geç |
| O-4 | `src/App.vue:93-95` | router-view'de `:key` yok → cüzdanlar arası geçişte `trnFilters`/`tab` durumu sızıyor | `:key="route.fullPath"` veya `watch(walletId, clearFilters)` |
| O-5 | 7 dosya (`%{{ }}`) | Yüzde sabit ön ekle basılıyor, `en`/`ru`'da "50%" olmalı | `useFormat.percent()` + `Intl.NumberFormat(style:'percent')` |
| O-6 | `src/pages/WalletDetailPage.vue:540`, TransactionsPage | Kategori/etiket filtresi **ada** göre → ad çakışmasında yanlış eşleşme | id-bazlı filtre |
| O-7 | `src/features/tags/store.ts:66-93` | `deleteTag`: N ayrı `saveTrn`, await edilmeden `deleteRow` → yarış | tek toplu güncelleme + `await Promise.all` sonra sil |
| O-8 | `src/features/trnForm/utils/calculate.ts:113` | `evaluateExpression` `Math.abs` ile işareti atıyor (`100-150`→`50`) | Niyet buysa `evaluateAbsExpression` adı + belge |
| O-9 | `src/features/trnForm/utils/formatData.ts:12` vs `:33` | `formatTransaction` tarihe fallback koyuyor, `formatTransfer` koymuyor → transfer 1970'e düşebilir | İki yol da `props.date \|\| Date.now()` |
| O-10 | `src/features/trns/store.ts:159-163` | transfer/adjustment kategorileri satır-içi hardcode + İngilizce (i18n dışı) | `pseudoCategories.ts` sabiti, i18n anahtarlı |
| O-11 | `src/features/categories/utils.ts:41-46` | Silinmiş üst kategori "kök" olarak dönebilir → isimsiz dilim | `parentId` yoksa yaprağın kendisine düş + test |
| O-12 | `src/components/DateRangeField.vue:38-49` | Klavyeyle erişilemez (sadece fare), `aria-haspopup`/`expanded` yok | `role="combobox"` + `@keydown.enter/space` |
| O-13 | `src/pages/SettingsPage.vue:39`, SetPinDialog | PIN değiştir/kaldır mevcut PIN'i doğrulamıyor | Önce `verifyPin` iste |
| O-14 | `/auto-imports.d.ts`, `/components.d.ts` | Kök dizinde stale, **git'te izlenen** üretilmiş dosyalar (gerçekleri `src/` altında) | `git rm` + `.gitignore`'a kök varyantı ekle |
| O-15 | `src/features/trns/reconcile.ts:27` | Değişiklik tespiti yalnız `updatedAt`'e güveniyor; `Number(undefined)`→NaN | `ts()` yardımcısını kullan; içerik-hash düşün |

---

## 🔵 DÜŞÜK Bulgular (seçme)

- **Tip delikleri:** `Row = Record<string, any>` → DB katmanı tipsiz; `rowToTrn` okuma yolunda `zod` ile doğrulanmıyor; `Number(row.amount)` bozuk satırda sessiz `NaN` üretip toplamları zehirler; çok sayıda `!` non-null assertion (`src/services/db/transforms.ts:10`, wallets/store).
- **`getCreditAvailable`** (`src/features/wallets/types.ts:56`) pozitif bakiyede (fazla ödeme) `Math.abs` ile yanlış limit → `creditLimit - Math.max(0, -amount)`.
- **Adlandırma:** `formatByCurrency` aslında binlik-ayraç ekliyor, para ile ilgisi yok → `groupThousands`; `simple.ts` → `collections.ts`; `ts` → `toTimestamp`; `getTotal`'daki `sum` → `net`/`flow`.
- **Hata stratejisi tutarsız:** fırlat / sessiz-yut / kod-döndür bir arada → tek strateji (`Result<T,E>` veya tipli hata hiyerarşisi) + merkezi `logger`.
- **Migrasyonlarda `Down` yok** (`src-tauri/src/lib.rs`) — rollback yolu yok.
- **Şemada FK/NOT NULL/CHECK kısıtı yok** — bütünlük tümüyle uygulama katmanına bırakılmış.
- **Vitest:** `environment: 'node'` ama Vuetify mount ediliyor; `happy-dom` kurulu ama global bağlı değil; coverage yapılandırması yok.
- **a11y:** `FormDrawer` odak-tuzağı/iade yok; tıklanabilir avatarlar (`WalletFormDialog:165`) klavyeyle erişilemez; sabit Türkçe `aria-label`'lar.
- **README güncel değil** ("Faz 0" diyor ama kod Faz 3-4+).

---

## 🏛️ Mimari & Tasarım Deseni Önerileri (kesişen)

1. **Repository + Unit-of-Work katmanı** — Store'lar doğrudan `upsertRow/deleteRow` çağırıyor. Çok-tabloyu tek iş birimi olarak yazacak (cüzdan sil + referans trn temizle + `defaultWalletId` sıfırla) transaction sınırı yok. Bu, Y-3'ün (atomiklik) kök nedeni. → Tek Rust `#[command]` + `sqlx` transaction.
2. **`Money` değer nesnesi** — K-1/Y-1/Y-2'nin ortak çözümü. Tamsayı minor-unit + açık ölçek; ham float aritmetiğini merkezi yardımcılara hapset.
3. **Saf-fonksiyon çıkarımı (testability)** — Bileşen/store içindeki finansal saf mantık (`filterTrnsIds`, `changeRatio`, `buildSeries`, `getTotal`) tek-kaynak modüllere; hem UI hem test import etsin (Y-5'i yapısal olarak imkânsız kılar).
4. **Merkezi doğrulama katmanı (zod)** — Sınırlarda (kur API, backup dosyası, DB okuma) tip-cast yerine parse. Yazımda kullanılan şemaları okumada da uygula.
5. **Sihirli string'leri enum/sabite taşı** — `'transfer'`, `'adjustment'`, `categoryId==='...'` kontrolleri → `isAdjustment` alanı veya `pseudoCategories` sabiti.
6. **Sunum/konteyner ayrımı** — Tanrı-bileşenleri (WalletDetailPage 1265, Dashboard 574) bölme + composable'a çıkarma.

---

## ✅ İyi Yapılmış Olanlar (regresyon önlemek için)

- **i18n tam** — tr/en/ru üçü de 302 anahtar, hiç eksik yok.
- **Proje hijyeni** — `dist/`, `target/`, `.env` git'te değil; commit'lenmiş secret yok.
- **Reaktivite disiplini** — `onScopeDispose` temizlik, manuel `addEventListener` sızıntısı yok, liste sanallaştırması her yerde (`v-data-table-virtual`).
- **Optimistic update + rollback** deseni store'larda tutarlı; merkezi toast kuyruğu.
- **a11y temelleri** — skip-link, tıklanabilir legend'lar gerçek `<button>`, KPI'da renk + ok ikonu (renge tek bağımlılık yok).
- **stat aggregation** doğru tasarlanmış; seed için davranışsal testler güçlü (bakiye tutarlılığı, kredi ekstresi).
- **TS `strict`** + `noUnusedLocals/Parameters` açık.

---

## 🗺️ Önerilen Yol Haritası (öncelik sırası)

### Faz 1 — Güvenlik & bütünlük (acil)
1. **K-2:** `importBackup` → transaction + kolon allow-list + versiyon doğrulaması
2. **Y-4:** CSP tanımla + `fs $HOME/**` iznini daralt
3. **K-3:** PIN'i ya gerçekten sertleştir (argon2 + backoff + DOM'dan kaldır) ya da beklentiyi dürüstçe belirt

### Faz 2 — Para doğruluğu
4. **K-1:** `Money` (tamsayı minor-unit) migrasyonu
5. **Y-1/Y-2:** Eksik-kur sessiz fallback'ini kaldır + kur API doğrulama/timeout

### Faz 3 — Kalite kapısı (kalıcı koruma)
6. **Y-6:** `ci.yml` (typecheck+test) + ESLint (`@antfu`) + pre-commit
7. **Y-5:** Saf mantığı çıkar, tek-kaynak test

### Faz 4 — Mimari sağlamlaştırma
8. **Y-3:** Repository/Unit-of-Work + transactional outbox
9. **Y-7:** Tanrı-bileşen bölme + tekrar eden filtre-tablo birleştirme
