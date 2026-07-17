# Güvenlik Politikası

## Desteklenen sürümler

Weltoly henüz `0.x` geliştirme aşamasındadır; güvenlik düzeltmeleri yalnızca
`main` dalına ve en son yayınlanan sürüme uygulanır.

| Sürüm | Destek |
| ----- | ------ |
| 0.1.x | ✅     |
| < 0.1 | ❌     |

## Açık bildirimi

Bir güvenlik açığı bulduysanız **herkese açık bir issue AÇMAYIN**. Bunun yerine:

- **backend@cyh.com.tr** adresine e-posta gönderin, veya
- GitHub'ın özel **"Report a vulnerability"** akışını kullanın
  (repo → Security → Advisories → Report a vulnerability).

Lütfen şunları ekleyin:

- Etkilenen bileşen (frontend / Tauri arka uç / SQLite katmanı / bir bağımlılık),
- Yeniden üretme adımları veya bir PoC,
- Etki değerlendirmeniz (veri sızıntısı, RCE, yerel dosya erişimi vb.).

**Yanıt hedefi:** 72 saat içinde ilk yanıt, 30 gün içinde düzeltme/azaltma planı.

## Kapsam ve tehdit modeli

Weltoly **yerel-önce** ve **offline** bir masaüstü uygulamasıdır: sunucu, hesap
veya uzak telemetri yoktur. Tüm veri kullanıcının cihazında SQLite'ta durur.
Bu yüzden ilgilendiğimiz sınıflar özellikle:

- **Tauri capability / CSP kaçışları** — `src-tauri/capabilities/default.json` ve
  `tauri.conf.json`'daki `csp` bilinçli olarak dar tutulmuştur (yalnız kur API'leri
  ve kullanıcı belge klasörleri). Bu sınırları aşan her şey ilgi alanımızdadır.
- **Yerel veri bütünlüğü** — para yazan çok-adımlı işlemler tek bir SQLite
  transaction'ında yapılır (`src-tauri/src/tx.rs`). Kısmi yazım/bozulma yolları.
- **Bağımlılık açıkları** — CI'da `npm audit` (prod) ve `cargo audit` kapıları
  vardır; bilinen ve azaltılamayan istisnalar `src-tauri/.cargo/audit.toml`'da
  gerekçesiyle belgelenir.

**Kapsam dışı (şimdilik):** cihazına fiziksel/root erişimi olan saldırgan. SQLite
dosyası şu an at-rest **şifresizdir**. Şifreleme için güvenli temel atıldı
(`src/features/auth/dbKey.ts` — PIN'den SQLCipher anahtarı türetme, test edilmiş)
ama `tauri-plugin-sql` bağlantıda `PRAGMA key` enjeksiyonuna izin vermediği için
henüz **açık değildir**; engel, plan ve migration riski
[docs/DB-ENCRYPTION-PLAN.md](docs/DB-ENCRYPTION-PLAN.md)'de. Bugünkü at-rest
koruma kaynağı işletim sistemi tam-disk şifrelemesidir (FileVault/BitLocker/LUKS).
