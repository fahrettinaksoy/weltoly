# 📋 Weltoly — İkinci Analiz Raporu

**Tarih:** 2026-07-17
**Kapsam:** CODE-REVIEW-2026-07-16 düzeltmeleri sonrası tüm proje
**Yöntem:** 3 paralel derin-analiz ajanı (veri/güvenlik, Vue/UI/perf, kur alt sistemi) + canlı uygulamada gerçek veriyle doğrulama + dist/ ölçümü

> Bir önceki rapordan farkı: bulguların bir kısmı **çalışan uygulamada gerçek veriyle** doğrulandı, tahminle değil.

---

## Özet — 16 Temmuz raporunun durumu

| Faz | Durum |
|---|---|
| K-1 Money | 🟡 Merkezi yuvarlama katmanı kuruldu; **INTEGER minor-unit storage hâlâ açık** |
| K-2 Backup | 🟢 Kapandı (allow-list + versiyon + transaction + oto-yedek) |
| K-3 PIN | 🟢 Kapandı (PBKDF2 + salt + backoff + DOM'dan kaldırma) |
| Y-1 Sessiz 1:1 kur | 🟢 Kapandı — **ama iki tüketicide delik kalmıştı, bu raporda kapatıldı** |
| Y-2 Kur doğrulama | 🟢 Kapandı |
| Y-3 Transactional outbox | 🟡 outbox boşluğu kapandı; **gerçek atomiklik hâlâ Rust komutu bekliyor** |
| Y-4 CSP / fs | 🟢 Kapandı |
| Y-5 Kopya mantık | 🟢 Kapandı (5 tek-kaynak modül) |
| Y-6 Kalite kapısı | 🟢 Kapandı (CI + ESLint + pre-commit) |
| Y-7 Tanrı-bileşen | 🟢 Kapandı (1265 → 200 satır) |
| O-1..O-15 | 🟢 Hepsi kapandı |

**Test: 120 → 212.** Typecheck/lint/test kapısı yeşil.

---

## 🔴 Bu turda bulunan ve DÜZELTİLEN kritik hatalar

### Y-1'in delikleri — aynı veri, iki ekranda çelişik toplam
**Dosyalar:** `WalletsPage.vue:131` · `WalletSummary.vue:120` (düzeltildi)

`getAmountInRate` eksik kurda `null` döndürecek şekilde düzeltilmişti, ama iki tüketici o null'ı `?? 1` ile yutuyordu:

```ts
const rate = w.rate ?? 1              // WalletsPage
return w.amount * (w.rate ?? 1)       // WalletSummary
```

Yani politika **kaynakta doğru, tüketicide delikti**: 3,15 ETH "≈ 3,15 $" yazıyordu. Üstelik `walletsStore.totals` o cüzdanı net'ten zaten hariç tutuyordu → **aynı veri Panel'de hariç, Cüzdanlar'da 1:1 dahil**. Hiçbir uyarı yoktu.

**Çözüm:** `features/wallets/lib/baseAmount.ts` (tek kaynak, 5 test). Kur yoksa `null` → pay çubuğu, pasta ve "≈ karşılık" hiç çizilmez.

**Ders:** bir politikayı kaynakta düzeltmek yetmiyor; tüketicileri de taramak gerekiyor. `?? 1` gibi kalıplar grep'lenebilir olmalı.

### Kur güncelliği kendiliğinden onarılmıyordu
**Dosya:** `services/rates/index.ts` (düzeltildi)

Gerçek veride kanıtlandı: kripto kurları **16 Temmuz'dan beri** düşüyordu. `refreshRates` günde bir çalışıp satırı yazıyor, gün "tamamlandı" sayılıyor ve **o gün bir daha denenmiyordu**. Tek bir CoinGecko 429'u tüm günü kriptosuz bırakıyordu ve durum ertesi gün de tekrarlıyordu.

Y-1 rozeti bunu görünür kıldı; "kripto eksikse günü tamamlanmış sayma" düzeltmesi onardı:

**Net varlık: 8.488,35 $ → 42.351,96 $** (kripto 33.976 $ = varlığın %63'ü). Kullanıcı net varlığını **5 kat düşük** görüyordu.

### formatPercent dili değil sayı-biçimini kullanıyordu
**Dosya:** `shared/lib/format.ts` (düzeltildi)

O-5 düzeltmesinde `numberLocale()` kullanmışım — o, kullanıcının **binlik/ondalık ayracı** tercihini temsilî bir locale'e eşliyor (`space_comma` → fr-FR). Sonuç: Türkçe arayüzde **"Kullanım oranı 57 %"** (Fransız stili). Testlerim yalnız `auto` biçimini denediği için yeşil kalmıştı.

**Yalnızca uygulamayı açtığımız için bulundu** — typecheck, lint ve 176 test hepsi geçiyordu. İşaretin yeri **dilin** özelliği; artık `o.locale` kullanılıyor ve 5 biçimin hepsi testle kilitli.

---

## 🟠 YÜKSEK — açık bulgular

### A-1 · ECharts ana bundle'ı şişiriyordu → **düzeltildi**
`main.ts:9` ECharts'ı koşulsuz yüklüyordu. Rotalar lazy olsa bile Panel'e giren kullanıcı hiç grafik görmeden ~540 kB ECharts indiriyordu.

| | Önce | Sonra |
|---|---|---|
| Ana chunk | **1.263.675 B** | **722.439 B** (−43%) |
| ECharts | ana chunk içinde | ayrı `echarts-*.js` (543 kB), lazy |

Kayıt, grafiği gerçekten çizen iki bileşene taşındı. `zrender` artık ana chunk'ta **sıfır**.

> **Not: "sayfalarda lazy loading" maddesi zaten yapılmıştı** — `router/index.ts`'te 7 rotanın hepsi dinamik `import()`. Asıl darboğaz buydu.

### A-2 · Yükleme durumu yoktu, YANLIŞ BOŞ DURUM gösteriliyordu → **düzeltildi**
`isLoaded` dört store'da tanımlı, export edilmiş — ve **hiçbir bileşende okunmuyordu** (grep: sıfır). Store'lar `items = null` ile başladığı için sayfalar yüklenme anını "veri yok" sanıyordu:

- `WalletDetailPage`: var olan cüzdan için **"cüzdan bulunamadı"** + "Cüzdanlar'a dön"
- `DashboardPage`: bir an **"net varlık 0,00 $"**, sonra gerçek rakama sıçrama
- Transactions/Wallets/Categories/Tags: "henüz kayıt yok" + "Ekle" çağrısı

**Çözüm:** 5 ekrana `v-skeleton-loader`; `isLoaded` başlangıcı `!isTauriRuntime()` (tarayıcıda SQLite yok → sonsuz skeleton olmasın).

### A-3 · Kalan performans borcu — **büyük kısmı ölçünce ÇÜRÜDÜ**

Bu maddeyi uygularken ölçtüm; önerilerin çoğu web varsayımıyla yazılmış ve Tauri'de geçerli değil.

**MDI font alt kümesi → REDDEDİLDİ.** İkonlar **kullanıcı verisi**: DB'de 86 kategori + 28 cüzdan ikonu duruyor ve 77'si `shared/icons.ts` listesinde bile yok (seed'den gelmiş). Build zamanında yapılan bir alt küme, kullanıcının DB'sindeki veya geri yüklediği yedekteki ikonu bilemez → **sessizce boş kare**. Üstelik Tauri'de font ağdan değil yerel diskten okunuyor; 403 kB'lık maliyet web'deki gibi değil. (Ölçüm: uygulamanın ihtiyacı 415/7447 ikon = %5.6 — oran cazip ama risk sessiz.)

**`build.target` → EKLENDİ, ama bir UYUMLULUK DÜZELTMESİ olarak, boyut kazancı değil.**
Vite varsayılanı `'modules'` = `[…, 'safari14']`, oysa `tauri.conf.json` `minimumSystemVersion: "10.15"` (Catalina → **Safari 13**) diyor. Yani bundle, uygulamanın desteklediğini iddia ettiği macOS'ta çalışmayabilecek sözdizimi taşıyordu ve bu ancak o makinede çalışma anında patlardı.

| Hedef | Ana chunk |
|---|---|
| Varsayılan | 730.781 B |
| **safari13** (uygulandı) | 737.058 B (**+6,3 kB**) |
| chrome105 (Windows) | 713.807 B |

Yani doğru ayar bundle'ı **büyütüyor** — 6 kB için sessiz bir uyumsuzluk taşınmaz.

**`manualChunks` → uygulanmadı.** Chunk bölmenin iki faydası var: (a) gereksizi yüklememek, (b) HTTP önbelleği. (a)'yı ECharts düzeltmesi zaten sağladı; (b) yerel-önce masaüstü uygulamasında **anlamsız** — tüm varlıklar zaten diskte.

**CSS 666 kB → dokunulmadı.** Kod yorumu bunun bilinçli olduğunu söylüyor: `styles: { configFile }` SASS derlemesi açardı ve ".sass 404 / beyaz ekran" sorununa yol açıyordu.

**Açık kalanlar:** `i18n/messages.ts` üç dil eager (819 satır); `TrnFormDialog` (400 satır) `DefaultLayout`'ta her zaman mount.

### A-4 · Tablo satırları klavyeyle kullanılamıyor → **düzeltildi**
`@click:row` yalnız fare olayı; `<tr>` odaklanabilir değil.

**Kapsam ilk sanıldığından dar çıktı.** Beş tablo da satır tıklaması kullanıyor ama üçünde satır içi kalem/çöp butonu var — onlar zaten klavyeyle erişilebilir, orada satır tıklaması sadece fare kısayolu:

| Sayfa | Satır tıklaması | Satır içi buton | Durum |
|---|---|---|---|
| **TransactionsPage** | var | **yok** | işlevsel engel |
| **WalletTransactions** | var | **yok** | işlevsel engel |
| WalletsPage / CategoriesPage / TagsPage | var | var (kalem/çöp) | alternatif yol mevcut |

Yani **gerçek engel iki işlem tablosunda**: klavye kullanıcısı hiçbir işlemi düzenleyemiyordu.

**Çözüm:** `shared/lib/rowA11y.ts` (`rowProps` ile `tabindex` + Enter/Space), 6 test. `role="button"` **verilmedi**: `<tr>`'nin örtük `role="row"`'unu ezmek satırı tablo yapısından koparır (ekran okuyucu satır/sütun bağlamını ve "3/181" konumunu kaybeder).

**Sıralanabilir başlıklar:** `shared/lib/sortA11y.ts` — `aria-sort` + `tabindex` + Enter/Space, 8 test. Özel `#headers` şablonu Vuetify'ın `VDataTableHeaderCell`'inin yerine geçtiği için erişilebilirliğini de siliyordu.

**Süzgeç satırındaki `<td>` BİLİNÇLİ OLARAK bırakıldı.** İlk analiz "`<thead>` içinde `<td>` olmaz" diyordu; denedim, geri aldım. Kodun kendi yorumu sebebini açıklıyor: *"fixed-header YALNIZ th'yi yapıştırıyor, bu satır td'lerden oluşuyor"* — `th`'ye çevirmek Vuetify'ın `thead th { position: sticky; top: 0 }` kuralını devreye sokar ve süzgeç satırı başlığın üstüne yapışır; ayrıca 4 CSS kuralı hedefini kaybeder. `<thead>` içinde `<td>` **geçerli HTML** ve hücreler form kontrolü taşıdığı için a11y kazancı marjinal. Maliyet > fayda.

> Kıyas: `CategoryBreakdown.vue:30-38` bunu doğru çözmüş (`:is="canDrill ? 'button' : 'div'"`).

### A-5 · Reaktivite → **gerçek olanlar düzeltildi, gerisi ölçülüp elendi**

**`stat/store.ts` çift süzme → düzeltildi.** `totalsForRange` ve `countForRange` `filterTrnsIds`'i AYNI argümanlarla iki kez çağırıyordu; `summary` ikisini de kullandığı için her aralık iki kez süzülüyordu (`prevSummary` ile aralık başına 4). Tek `summaryForRange` fonksiyonunda birleştirildi → süzme yarıya indi.

**`Date.now()` computed içinde → düzeltildi. Bu bir performans değil, DOĞRULUK hatasıydı.**
`computed(() => startOfMonth(Date.now()))` ifadesinin reaktif bağımlılığı YOK: Vue ilk değerlendirmede önbelleğe alır ve bir daha asla invalidate etmez. Masaüstü uygulaması günlerce açık kaldığı için gece yarısı geçince **"Bu ay" kartları eski ayı göstermeye devam ediyordu** ve hiçbir şey onları tazelemiyordu.

Çözüm: `composables/useCurrentDay.ts` — gün granülerliğinde reaktif "bugün", modül düzeyinde TEK zamanlayıcı (4 test, gece yarısı geçişi dahil). Dakikalık `useNow` kullanılmadı: `thisMonth` her seferinde yeni nesne döndürdüğü için ona bağlı tüm zincir dakikada bir yeniden çalışırdı.

**`DashboardPage` 4 tam tarama → ÖLÇÜLDÜ, dokunulmadı.**

| Ölçek | 4 tarama |
|---|---|
| **181 işlem (mevcut)** | **0,1 ms** |
| 100k işlem | 22 ms |

Bu ölçekte sorun değil; ölçülebilir kazanç olmadan riskli refactor yapılmadı. Veri büyürse geri dönülmeli. Aynısı `TransactionsPage:102` `trnRows` için de geçerli.

### A-6 · Tekrar eden UI kalıpları (AÇIK)
KPI şeridi (4 birebir kopya), donut + `#center` (5), özel `#headers` (2 × ~25 satır), `factCards` dizisi (3), gelir/gider indirgeyicisi (2), `usedRatio` göstergesi (2), yüzde hizalama CSS'i (3).

---

## 🟡 ORTA

| ID | Yer | Sorun |
|----|-----|-------|
| B-1 | `WalletsPage.vue:105`, `WalletSummary.vue` | O-10'da sabite bağlanmıştı ama bu iki nokta kaçmış: hâlâ `'adjustment'` sihirli string'i |
| B-2 | `currencies/types.ts:5` | `ratesSchema` (zod) tanımlı, **hiçbir yerde kullanılmıyor** — ölü kod |
| B-3 | `currencies/list.ts` ↔ `rates/index.ts` | `allCurrencies` kripto listesi ile `CRYPTO_IDS` **elle senkron**, test yok |
| B-4 | `user/store.ts` ↔ `stores/settings.ts` | `locale` **iki yerde birden** (SQLite + localStorage) — mevcut tutarsızlık |
| B-5 | `WalletSummary.vue` 687 satır | Y-7 sonrası hâlâ en büyük bileşen; içinde 6 bağımsız bölüm |
| B-6 | `features/demo/seed.ts` 587 satır | Prod bundle'a girip girmediği doğrulanmalı |
| ~~B-7~~ | `DashboardPage.vue:280` | ✅ Düzeltildi — çipe `tabindex="0"` + `open-on-focus`. Vuetify'ın `useActivator`'ı focus olaylarını zaten bağlıyor |
| ~~B-8~~ | `DefaultLayout.vue:59`, `Calculator.vue:26` | ✅ Düzeltildi — `a11y.mainNav` / `a11y.calcDelete` (3 dil) |

---

## 🏛️ Mimari — açık kalan borç

1. **K-1'in ikinci yarısı**: para hâlâ `REAL`. Merkezi `money.ts` katmanı float birikmesini durduruyor ama tam çözüm INTEGER minor-unit storage. Katman, geçişin tek noktası olarak duruyor.
2. **Y-3'ün ikinci yarısı**: mutasyon + outbox hâlâ iki ayrı `execute`. Gerçek transaction JS'ten **kurulamıyor** — tauri-plugin-sql her `execute`'u havuzdan bir bağlantıya veriyor, `BEGIN`/`COMMIT` aynı bağlantıya düşmüyor. Tek Rust `#[command]` + `sqlx::Transaction` gerekiyor. **Faz 5 senkronundan ÖNCE** yapılmalı: outbox'ın tüketicisi olduğunda sapma görünür hale gelir.
3. **Şemada FK/NOT NULL/CHECK yok** — bütünlük tümüyle uygulama katmanında (16 Temmuz raporundan devam).
4. **Migration'larda `Down` yok** — rollback yolu yok.

---

## ✅ Bu turda eklenenler

### Kur kaynağı seçimi
`Frankfurter (varsayılan) · TCMB · open.er-api` — Ayarlar → Kurlar. **Kripto ayrı**: üç kaynağın hiçbiri kripto vermiyor, CoinGecko her zaman fiat setinin üstüne ekleniyor.

- `currencies/sources.ts` — kayıt defteri
- `services/rates/sources/parse.ts` — **saf** ayrıştırıcılar, gerçek yanıtlarla 15 test
- Migration 006: `user_settings.rateSource` + `rates.rateDate`
- Kaynak DB'den **doğrudan** okunuyor (Pinia'dan değil) — `initUserSettings` watch'ı asenkron dolduğu için açılışta yarış vardı

**TCMB'nin iki tuzağı** (testle kilitli):
1. `<Unit>` her zaman 1 değil — **JPY için 100**. Bölünmezse JPY 100 kat yanlış çıkar ve bu sessizdir.
2. TRY listede yok (kaynağın tabanı) → elle eklenir.

Türetilen kurlar Frankfurter ile bağımsız olarak çapraz doğrulandı: **EUR %0.00, JPY %0.28 sapma** (TCMB satış kuru ile ECB orta kuru arasındaki makas — beklenen).

**Frankfurter tuzağı**: yanıt tabanı kendi sözlüğüne koymaz (`base=USD` iken `rates.USD` yok). Enjekte edilmezse USD cüzdanlar için kur bulunamaz ve **her şey "kur eksik"e düşerdi**.

### Kur güncellik ekranı
`RatesPanel.vue` — kaynak, **kur tarihi**, son çekim, para birimi adedi, taze/bayat rozeti, manuel yenile.

Kritik ayrım: `date` = **bizim çektiğimiz gün**, `rateDate` = **kaynağın kendi kur tarihi**. İkisi aynı değil — ECB/TCMB iş günü sonunda yayımlar; 17 Temmuz'da çekilen kur 16 Temmuz tarihlidir. Eskiden yalnız ilki saklanıyordu, "kurlar güncel mi" sorusu **yanıtlanamıyordu**.

Güncellik kararı saf mantıkta (`freshness.ts`, 10 test): **iş günü** sayılır. Naif "rateDate === bugün" kontrolü her hafta sonu yanlış alarm verir; kullanıcı uyarıyı yok saymaya başlar ve gerçek bayatlığı da kaçırır.

`refreshRates` artık şu üç durumda yeniden çeker: `force` · kaynak değişti · kripto eksik.

---

## 🗺️ Önerilen sıra

### ~~Faz 1 — erişilebilirlik ve algı~~ ✅ TAMAMLANDI

1. ~~**A-4** tablo satırı klavye erişimi~~ — `rowA11y` + `sortA11y` (14 test). Süzgeç `<td>`'si bilinçli bırakıldı (yukarıda gerekçesi).
2. ~~**B-7/B-8**~~ — tooltip odağı + i18n aria (3 dil).

> **Doğrulama boşluğu:** uygulama kapalıyken yapıldı; şablonlar `vite build` ile derleniyor ve 226 test geçiyor, ama klavye akışı **gözle görülmedi**. İşlemler tablosunda satıra Tab'layıp Enter'a basmak ve başlıkta Enter ile sıralamak teyit edilmeli.

### ~~Faz 2 — performans~~ ✅ TAMAMLANDI (çoğu ölçünce elendi)

3. ~~**A-3**~~ — MDI alt kümesi **reddedildi** (ikonlar kullanıcı verisi, sessiz boş kare riski). `build.target` eklendi ama **uyumluluk düzeltmesi** olarak (+6,3 kB). `manualChunks` yerel-önce uygulamada anlamsız.
4. ~~**A-5**~~ — `stat` çift süzmesi düzeltildi; `Date.now()` donması `useCurrentDay` ile çözüldü (gerçek doğruluk hatası). Dashboard taramaları **ölçüldü: 0,1 ms** → dokunulmadı.

> **Ders:** Faz 2'nin dört önerisinden ikisi ölçünce çürüdü. Rapor web varsayımıyla yazılmıştı; Tauri'de varlıklar diskten geliyor ve veri 181 satır. "Performans borcu" sanılan şeyin bir kısmı borç değildi — asıl bulgu, aralarına gizlenmiş bir **doğruluk** hatasıydı (donmuş "Bu ay").

### Faz 3 — mimari borç ✅ tamamlandı (2026-07-17)

Üç maddenin **biri uygulandı, biri ölçümle reddedildi, biri kısmen** — ayrıntı aşağıda.

#### 5. Y-3 — Rust `#[command]` + `sqlx::Transaction` ✅

**Önceki değerlendirmemi geri alıyorum.** Faz 1'de "güvenle yapılamaz" demiştim; gerekçem
plugin'in havuzuna erişilemediğiydi. Doğrulayınca yanlış çıktı: `tauri-plugin-sql` 2.4.0'da
`DbInstances(pub RwLock<HashMap<String, DbPool>>)` ve `pub enum DbPool` **public** —
plugin'in KENDİ havuzu ödünç alınabiliyor. `Cargo.lock`'ta tek sqlx (0.8.6) olduğu için
tip çakışması da yok.

- `src-tauri/src/tx.rs` — `run_tx` komutu: ifadeleri tek `sqlx::Transaction`'da yürütür,
  ilk hatada `?` ile çıkar, `tx` commit edilmeden düşünce sqlx **otomatik ROLLBACK** yapar.
- `src/services/db/tx.ts` + `mutations.ts` — tüm yazma yolları `runTx`'ten geçer;
  mutasyon + outbox kaydı artık **tek birim**.
- `src/services/db/outbox.ts` **silindi** — ölü, hataları yutan "best-effort" yazıcıydı.

**Faz 3'te bulunan İKİ ek delik** (rapor bunları öngörmemişti, kodu okurken çıktı):

- `deleteWallet`/`deleteCategory` `Promise.all` ile **N+1 ayrı transaction** yapıyordu.
  Biri patlarsa diğerleri kalıcı oluyor, `catch` bloğu ise UI'ı tamamen geri alıyordu →
  ekran cüzdanı geri getirir ama işlemler diskten gerçekten silinmiş olurdu. Yeni
  `deleteRows()` hepsini tek transaction'da gönderiyor (6 test).
- `deleteTrnsReferencing` **ölü koddu** — hiçbir yerden çağrılmıyordu; silindi.

**Test — 7 Rust + 6 TS.** İki katman, çünkü ilki tek başına yanıltıcıydı:

*`tx::tests` (3)* — sqlx akışı bellek-içi DB'de: commit hepsini uygular / hata her şeyi
geri alır / yarım uygulama imkânsız. **Ama asıl risk burada değildi:** bu testler geçse
de komut, plugin'in havuzunu hiç bulamıyor olabilirdi.

*`tx::app_tests` (4)* — **`run_tx` komutunun kendisi**, `tauri::test::mock_builder` ile
kurulmuş **gerçek bir uygulamada, gerçek `tauri-plugin-sql` yüklüyken** çalıştırılır
(plugin `preload` ile DB'yi setup'ta açar; normalde bunu JS `Database.load()` yapar).
Kanıtlananlar: havuz `DbInstances`'tan gerçekten bulunuyor, `DbPool` varyantı eşleşiyor,
**sqlx sürümleri uyuşuyor**, `Stmt` serde ile çözülüyor, yazmalar **plugin'in kendi
havuzuna** gidiyor, hata durumunda geri alınıyor, tamsayı INTEGER kalıyor (REAL'e düşmüyor),
NULL gerçekten NULL oluyor.

Bu testler bir gerçek uyumsuzluk yakaladı: plugin'in setup'ı `block_in_place` kullanıyor,
bu yüzden `#[tokio::test]` varsayılanı (tek iş parçacığı) panikliyor →
`flavor = "multi_thread"` şart.

`DB_URL` `tx.rs`'de sabit olduğundan testler de `sqlite:weltoly.db` kullanmak zorunda;
**identifier test başına benzersiz yapılmasaydı testler kullanıcının gerçek DB'sini
açardı**. Test başına ayrı identifier hem bunu hem test-arası sızmayı engelliyor.
(Testler `~/Library/Application Support/com.stackvo.weltoly.test-*` altında dizin bırakır;
her koşuda baştan silinir, zararsız.)

> Kalan boşluk: canlı uygulamada `run_tx` henüz yürütülmedi (yeniden başlatmadan beri
> kullanıcı yazması olmadı). Komut yolu artık uçtan uca test edildiği için risk küçük;
> kırılırsa **sesli** kırılır (her kayıt hata toast'ı verir), sessizce bozmaz.

#### 6. K-1 — INTEGER minor-unit migrasyonu ❌ ölçümle reddedildi

Rapor bunu "en büyük teknik borç" saymıştı. **Gerçek veriye bakınca dayanağı yok:**

| Ölçüm | Sonuç |
|---|---|
| 8 ondalıkta hassasiyet kaybeden tutar | **0 / 152** |
| En büyük tutar ×1e8 vs 2^53 | 4,2e13 vs 9,0e15 — taşma yok |

REAL saklama bugün **hiç kayıp vermiyor**. Asıl hata olan *aritmetik birikmesi* zaten
`money.ts` ile çözüldü (Faz 1). Geriye kalan migrasyon 4 para sütununu, tüm dönüşümleri,
tüm hesapları ve yedek formatını değiştirir — **ölçülebilir faydası olmayan, geri alınamaz
bir risk**. Faz 5'te uzak taraf farklı bir sayı tipi dayatırsa yeniden değerlendirilmeli.

#### 7. Şemaya FK/NOT NULL/CHECK + `Down` — kısmen (ölçümle kapsam daraltıldı)

**FK(trns.categoryId → categories.id) İMKÂNSIZ.** `'transfer'` ve `'adjustment'`
sözde-kategorilerdir; `categories` tablosunda **satırları yoktur** (store'da sabit olarak
enjekte edilirler). FK eklenseydi mevcut **181 işlemin 65'i (%36) reddedilir**, uygulama
açılmazdı. Rapor bunu öngörmemişti.

**Migration `Down` ANLAMSIZ.** Plugin kaynağı okundu: yalnız `_migrator.run(pool)`
çağrılıyor, `undo()` **hiçbir yerde yok**. `Down` eklemek asla çalışmayacak ölü SQL olur —
geri alma yeteneği *yanılsaması* yaratır. Eklenmedi.

**Eklenen: `007_trns_constraints.sql`** — her kısıt önce gerçek veriye karşı ölçüldü
(181 satır, 0 ihlal), sonra yazıldı:

- `NOT NULL`: `categoryId`, `date`, `type`, `updatedAt`, `userId` (hepsinde 0 NULL).
  `amount`/`walletId`'ye **eklenemez** — transferlerde kasıtlı olarak NULL (29 satır).
- `CHECK type IN (0,1,2)` ve tutarlar `>= 0` (yön `type` ile taşınır, işaretle değil).
- **Şekil değişmezi** — asıl değer: transfer (type=2) iki cüzdan kullanır ve
  `walletId`/`amount`'u boş bırakır; gelir/gider tam tersi. Karışması en sinsi bozulma:
  satır geçerli görünür ama bakiye hesabı onu ya iki kez sayar ya hiç.
  Bu kısıt `trnToRow`'un zaten uyguladığı niyetin şemaya yazılmış hali.

**Neden şimdi:** Faz 5'te senkron uzak taraftan gelen satırları yazacak; onlar TypeScript
tiplerimizden geçmez. Tek savunma hattı şema.

**Doğrulama:** gerçek DB kopyası üzerinde çalıştırıldı → 181 satır korundu, **checksum
birebir aynı**, 4 indeks geri geldi. Ardından 9 bozuk şekil (geçersiz type, negatif tutar,
transfer/gider karışımı, NULL'lar) **reddedildi**, 4 geçerli şekil kabul edildi.

> ⚠️ Bu migration `npm run tauri:dev` açıkken `lib.rs`'i düzenlediğim an **gerçek DB'ye
> otomatik uygulandı** (15:44). Kasıtlı değildi; dev sunucusu yeniden derleyip uygulamayı
> başlattı. Sonrasında doğrulandı: `integrity_check` ok, 181 işlem, 36 cüzdan, 87 kategori,
> 4/4 indeks. `Down` olmadığı için **geri dönüşü yok**.

### Faz 4 — bakım ✅ tamamlandı (2026-07-17)

> **Fazın en önemli çıktısı raporda yoktu.** A-6 için Panel ile İstatistik'in KPI
> markup'ını karşılaştırırken `DashboardPage.vue`'de **üç Y-1 deliği** bulundu.
> Ayrıntı aşağıda — bakım maddesi değil, gerçek bir hesap hatasıydı.

#### 🔴 Y-1 (Panel) — Faz 1'in kaçırdığı üç delik

Faz 1'de Y-1 için rapor iki dosya göstermişti (`WalletsPage`, `WalletSummary`);
ikisi de düzeltildi. Ama `DashboardPage.vue` kendi hesaplarını yapıyor ve **üç yerde**
`?? 1` ile kuru eksik cüzdanı 1:1 sayıyordu:

| Yer | Etki |
|---|---|
| `flowIn` (aylık gelir/gider/net/adet) | 0,4 BTC'lik gider akışa **0,40 $** olarak giriyordu |
| `assetsByType` ("para nerede duruyor" donut'u) | pay 1:1 sayıyor, payda (`totals.assets`) hariç tutuyordu → **yüzdeler %100'ü aşabiliyordu** |
| `creditTotal` (kredi kartı doluluğu) | limit ve kullanım farklı oranda sapıyor → **oran bozuluyordu** |

**En kötü yanı:** sayfa aynı anda `totals.hasMissingRates`'e bakan bir **"Kur eksik"
rozeti gösteriyordu.** Yani ekran "bu cüzdanlar toplama katılmadı" derken hemen
yanındaki aylık kartlar onları sessizce 1:1 sayıyordu — sayfa kendi kendisiyle
çelişiyordu. Kullanıcının kriptosu varlıkların %63'ü ve kurlar 07-16'da kaybolmuştu:
tam da bu koşulda her rakam bozulurdu.

Düzeltme: üçü de tek kaynak `toBaseAmount` üzerinden Y-1 kuralına uydu (kur yoksa
**hariç tut + bayrak kaldır**, store'un `totals`'ı ile aynı desen). Rozet artık
`anyMissingRates` ile sayfanın **tüm** hesaplarını kapsıyor.

**Kök sebep (kayda değer):** `DashboardPage.flowIn`, `shared/lib/getTotal`'ın
gelir/gider mantığını **elle yeniden yazmış** bir kopya. `getTotal` Y-1'i baştan beri
doğru ele alıyor (`hasMissingRates` + null hariç tutma) — İstatistik sayfası bu yüzden
sağlamdı. Panel onu kullansaydı hata hiç olmayacaktı. Kopyayı `getTotal`'a devretmek
doğru adım ama anlamsal fark taşıyor (`net` vs `sum`, adet tanımı); hatayı düzeltmek
ile riskli bir semantik takası aynı ada sığdırmamak için **ayrı bir iş olarak bırakıldı**.

#### 8. A-6 — tekrar eden UI kalıpları (kısmen; ölçümle kapsam daraltıldı)

**`KpiStrip` ✅ → `components/KpiCard.vue`.** Panel ve İstatistik'te **birebir aynı**
24 satırlık markup vardı; `dash-kpi`/`stat-kpi` CSS'i bile aynıydı (`min-width: 150px`),
yalnız sınıf adı farklıydı. Kart nesneleri de aynı şekildeydi (aynı 4 anahtar, aynı i18n
etiketleri, aynı tonlar) — yalnız veri kaynağı farklı.

- **Cüzdanlar sayfasının KPI'ları BİLİNÇLİ OLARAK alınmadı:** kıyas rozeti yok, değerleri
  önceden biçimli geliyor, donut'la aynı `v-sheet`'i paylaşıyorlar. Benzer *görünen* ama
  farklı olanı tek bileşene zorlamak, her iki çağıranı da bozan seçenek bayrakları üretirdi.
- `deltaTone` **zaten** tek kaynaktaydı (`stat/lib/periodCompare.ts`) — rapor burada
  tekrar olduğunu ima ediyordu, yoktu.

**`DonutSummary` ❌ — temiz bir çıkarım değil.** `stat/components/CategoryBreakdown.vue`
(99 satır) satır listesi çiziyor ve `{ categoryId, amount, percent, canDrill }` alıyor;
`WalletSummary`'nin kırılımı ise **donut'u besliyor** ve `{ key, title, color, value }`
üretiyor. Benzer isim, farklı amaç. Zorlamak iki şekli de taşıyan bir bileşen doğururdu.

**`SortableTableHeader` — yapılmadı.** Yalnız iki çağıranı var
(`WalletTransactions`, `TransactionsPage`) ve erişilebilirlik kuralları zaten
`shared/lib/sortA11y.ts`'te tek kaynakta. Kalan tekrar sığ.

#### 9. B-1..B-6 — orta bulgular

| # | Durum | Not |
|---|---|---|
| **B-1** | ✅ yapıldı — **kapsam raporun 4 katı** | Rapor 2 dosya demişti; biri (`WalletSummary`) zaten temizdi, ama **8 dosyada** `categoryId` sihirli string'i vardı. Hepsi `TRANSFER_ID`/`ADJUSTMENT_ID`/`isPseudoCategoryId` sabitlerine bağlandı. `TransactionsPage:518` ve `trnKind:37` **kasıtlı bırakıldı**: onlar `TrnKind` birleşimi, `categoryId` değil — farklı alan. |
| **B-2** | ✅ yapıldı — **ama gerekçe yanlıştı** | Rapor "ölü kod" demiş; `ratesSchema` **kullanılıyordu** (`z.infer` ile `Rates` tipini O üretiyordu), silmek tipi kırardı. Gerçek sorun: şema doğrulama sözleşmesi gibi durup **hiç `.parse` edilmiyordu** ve gerçek doğrulayıcı `sanitizeRates`'ten **daha gevşekti** (0, negatif, NaN, Infinity'ye izin verir — Y-2'nin tam da attığı değerler). İki çelişen sözleşmeden yanlış olanı okuyup "kurlar doğrulanıyor" sanmak kolaydı → düz tip yapıldı. |
| **B-3** | ✅ yapıldı — **test yerine tek kaynak** | Rapor "test yok" demiş. Test sapmayı yalnız *fark eder*; yeni `currencies/crypto.ts` sapmayı **imkânsız kılıyor**: `allCurrencies` ve `CRYPTO_IDS` artık aynı listeden türetiliyor. Sessiz sapma sınıfıydı: `list.ts`'e eklenip `CRYPTO_IDS`'e eklenmeyen para seçilebilir ama kuru hiç çekilmez → cüzdan net değerden sessizce düşer. **9 test** türetmenin garanti ETMEDİĞİ şeyleri tutuyor (kod/id tekrarı, kod↔id karışması, **kripto kodunun bir fiat koduyla çakışması**). |
| **B-4** | ✅ yapıldı — **rapor durumu hafife almış** | Rapor "iki yerde birden, mevcut tutarsızlık" demiş. Gerçek: `settings.ts` (localStorage) **tek gerçek kaynak**; `user/store.ts`'teki `locale`'ın **hiçbir tüketicisi yoktu** ve **setter'ı da yoktu** — kullanıcı dili değiştirse bile SQLite sonsuza dek `'tr'` kalıyordu. Yani "kaynak" gibi duran, hep bayat bir kopya: dil hatasını düzeltmeye kalkan buradaki değeri değiştirip hiçbir etki göremezdi. Faz 5'te bu bayat değer karşı cihaza senkronlanacaktı. Ölü ref silindi; kolon şemada duruyor (nullable, artık yazılmıyor). |
| **B-5** | ⏸️ **bilinçli ertelendi** | `WalletSummary.vue` 696 satır (script 305 / template 275 / style 111). Bölünmesi gerçek: 5 bağımsız bölüm var. Ama hepsi ortak durumu paylaşıyor (`period`, `drillRoot`, `expenseByLeaf`, `leavesByRoot`) → bölmek prop-drilling ya da yeni bir store demek. **Kullanıcıya faydası yok, regresyon riski gerçek** ve sonucu görsel olarak doğrulayamıyorum. Çalışan grafik/donut kodunu göremeden bölmek, tam da sessizce düzeni bozan değişiklik türü. |
| **B-6** | ✅ doğrulandı — **sorun yok** | Rapor "prod bundle'a girip girmediği doğrulanmalı" demişti. Ölçüldü: `seed.ts` prod'a **giriyor ama ana bundle'a değil** — tembel yüklenen `SettingsPage` chunk'ında (71 kB, tüm sayfa dahil). "Demo veri yükle" zaten Ayarlar'daki bilinçli bir kullanıcı özelliği. Değişiklik gerekmedi. |

---

## Yöntem notu

Bu turda üç hata **yalnızca uygulamayı çalıştırdığımız için** bulundu; hiçbiri typecheck, lint veya 176 testten geçmedi:

- `formatPercent` locale hatası (ekranda "57 %" görüldü)
- Kripto kurlarının 2 gündür düşmesi (rozet göründü → DB incelendi)
- Net varlığın 5 kat düşük olması (yukarıdakinin sonucu)

Statik doğrulama gerekli ama yeterli değil — **para söz konusuysa rakamın kendisine bakmak gerekiyor.**
