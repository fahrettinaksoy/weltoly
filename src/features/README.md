# src/features — özellik modülleri

Uygulama, dikey **özellik dilimleri** olarak düzenlenir: her özellik kendi
store'u, tipleri, saf mantığı, testleri ve bileşenleriyle birlikte tek bir
klasörde yaşar.

| Klasör        | İçerik                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| `wallets/`    | cüzdanlar — `store.ts`, `types.ts`, bakiye serisi, etiket dağılımı, `components/` |
| `categories/` | gelir/gider kategorileri — `store.ts`, ikon listesi, rollup, `components/`        |
| `trns/`       | işlemler — `store.ts`, `getTrns.ts`, `reconcile.ts`, filtreler, `components/`     |
| `trnForm/`    | işlem formu — `store.ts`, `utils/{calculate,validate,formatData}`, hesap makinesi |
| `tags/`       | etiketler — `store.ts`, `types.ts`, `components/`                                 |
| `stat/`       | istatistik — dönem karşılaştırma, kategori dağılımı, `components/` (ECharts)      |
| `currencies/` | çoklu para birimi — kur kaynakları, güncellik, kripto, `components/`              |
| `theme/`      | tema paleti ve nötr tonlar                                                        |
| `auth/`       | PIN kilidi — `pinCrypto.ts`, `dbKey.ts`, kilit ekranı                             |
| `user/`       | kullanıcı ayarları store'u                                                        |
| `demo/`       | örnek veri tohumlama                                                              |

Kardeş dizinler:

- `../services/db/` — SQLite erişimi (`watch`, `mutations`, `transforms`); çok-adımlı
  yazımlar Rust `run_tx` komutundan geçer (`src-tauri/src/tx.rs`).
- `../shared/lib/` — çerçeveden bağımsız saf yardımcılar (`getTotal`, `money`, `format` vb.).
