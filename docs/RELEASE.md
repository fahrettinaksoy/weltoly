# Weltoly — Paketleme & Yayın Kılavuzu (Faz 6)

Bu belge; Windows, macOS, Linux, iOS ve Android için imzalı paket üretme adımlarını içerir.
Kod imzalama sertifikaları ve mağaza hesapları **sizin provizyonunuzdur** (ben üretemem).

## 0. Ön koşullar
- Node.js ≥ 20, Rust (rustup), `npm ci` ile bağımlılıklar
- Masaüstü: platform WebView bağımlılıkları (Linux için `.github/workflows/release.yml`'deki apt paketleri)
- Mobil: Android Studio + SDK + NDK; iOS için Xcode (yalnız macOS)

## 1. Sürüm numarası
`src-tauri/tauri.conf.json` → `version` ve `package.json` → `version` alanlarını güncelleyin (ör. `0.2.0`).

## 2. Masaüstü build (imzasız — yerel test)
```bash
npm run tauri:build
```
Çıktılar `src-tauri/target/release/bundle/` altında:
- macOS: `.app` + `.dmg`
- Windows: `.msi` ve/veya `.exe` (NSIS)
- Linux: `.AppImage` + `.deb`

> İmzasız paketler yerel test için çalışır; dağıtımda işletim sistemi uyarısı verir. Dağıtım için imzalama (aşağıda) şart.

## 3. macOS imzalama + notarization
Apple Developer hesabı ($99/yıl) gerekir.
1. **Developer ID Application** sertifikası oluşturup `.p12` olarak dışa aktarın.
2. GitHub repo → Settings → Secrets olarak ekleyin:
   - `APPLE_CERTIFICATE` (base64'lenmiş .p12), `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY` (ör. `Developer ID Application: Ad (TEAMID)`)
   - `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
3. CI (`release.yml`) bu sırlarla otomatik imzalar + notarize eder.
> Yerel imzalama için `.env` yerine `xcrun notarytool` akışı; ayrıntı: Tauri "macOS code signing" dokümanı.

## 4. Windows imzalama
Bir kod imzalama sertifikası (OV/EV) gerekir.
- Tauri `tauri.conf.json` → `bundle.windows.certificateThumbprint` / `signCommand` ile ya da CI'de imza adımı.
- EV sertifika SmartScreen itibarını hızlandırır. Ayrıntı: Tauri "Windows code signing".

## 5. Linux
- `.AppImage` ve `.deb` imzasız dağıtılabilir. Flatpak/Snap isteğe bağlı.
- `bundle.linux.deb.depends` gerekli kütüphaneleri listeler (WebKitGTK, GTK3).

## 6. Otomatik güncelleme (KURULU)

Altyapı hazır — `tauri-plugin-updater` + `tauri-plugin-process` kurulu, public
anahtar `tauri.conf.json` → `plugins.updater.pubkey`'de gömülü, endpoint GitHub
Releases'e (`latest.json`) bakıyor. Uygulama içinde **Ayarlar → Veri →
Güncellemeleri denetle** akışı `checkForUpdates()`'i çağırır.

**İmza anahtarı** (`npm run tauri signer generate` ile üretildi):

- Özel anahtar: `src-tauri/.tauri/weltoly-updater.key` — **gitignore'lu, ASLA
  commit'lenmez**. Bu dosyayı güvenli bir yerde yedekleyin; kaybederseniz bir
  daha imzalı güncelleme yayınlayamazsınız (yeni anahtar = tüm kullanıcılar için
  otomatik güncelleme kopar).
- Public anahtar: `...key.pub` (config'e zaten gömülü).

**Yayın için tek yapılacak** — GitHub repo → Settings → Secrets:

- `TAURI_SIGNING_PRIVATE_KEY` = özel anahtar dosyasının **içeriği**
  (`cat src-tauri/.tauri/weltoly-updater.key`).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = boş (anahtar parolasız üretildi) veya
  parola belirlediyseniz o.

Bu sırlar ayarlıyken `tauri-action` her release'de `latest.json`'ı üretip imzalar
ve release'e ekler; endpoint onu otomatik bulur. Sır YOKSA build yine çalışır,
yalnız güncelleyici JSON'u üretilmez.

## 7. Android
```bash
npm run tauri android init        # bir kez: Android projesi üretir
npm run tauri android dev         # geliştirme
npm run tauri android build       # AAB/APK
```
- **Keystore** oluşturun (`keytool`), `src-tauri/gen/android` içinde imza yapılandırın.
- Play Store: Google Play Developer hesabı ($25 tek sefer), AAB yükleme, gizlilik formu.
- İkonlar `tauri icon` ile zaten üretildi (`mipmap-*`).

## 8. iOS (yalnız macOS)
```bash
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```
- Apple Developer hesabı, provisioning profile + signing identity gerekir.
- App Store Connect'te uygulama kaydı, TestFlight, gizlilik "nutrition label".

## 9. CI/CD (hazır)
`.github/workflows/release.yml` — `v*` etiketi push edilince macOS (arm+intel), Windows, Linux için build alıp **taslak Release** oluşturur. İmzalama sırları eklenirse otomatik imzalar.
```bash
git tag v0.2.0 && git push origin v0.2.0
```

## 10. Yayın öncesi kontrol listesi
- [ ] Sürüm numarası güncellendi (conf + package.json)
- [ ] `npm run typecheck && npm test && npm run build` yeşil
- [ ] Her platformda temiz cihazda kurulum + açılış denendi
- [ ] (Mobil) safe-area, klavye, geri tuşu, SQLite gömülü çalışması doğrulandı (analiz raporu § 14.4)
- [ ] Gizlilik metni / mağaza görselleri hazır
- [ ] (İsteğe bağlı) CSP sıkılaştırması (`tauri.conf.json` security.csp)

## Notlar
- SQLite **derlemeye gömülü** (sqlx `sqlite`) — Android'de sistem `libsqlite3` bağımlılığı yok.
- Bulut senkronu şu an yok (yerel-önce). Eklenirse (Turso/Supabase) auth için `tauri-plugin-deep-link` + OAuth geri dönüşü.
