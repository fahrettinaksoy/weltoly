# src/features — özellik modülleri

finapp'in `components/[feature]/` yapısının karşılığı. Her özellik kendi store'u, tipleri ve
bileşenleriyle birlikte yaşar. Faz 1+ ile doldurulacak (bkz. `finapp-tauri-gelistirme-plani.md` § 6 Taşıma Haritası).

| Klasör | İçerik (planlanan) | Faz |
|---|---|---|
| `wallets/` | `store.ts`, `types.ts`, `components/` | 2 |
| `categories/` | `store.ts`, `types.ts`, `components/` | 2 |
| `trns/` | `store.ts`, `types.ts`, `getTrns.ts`, `reconcile.ts`, `components/` | 2 |
| `trnForm/` | `store.ts`, `utils/{calculate,validate,formatData}`, `components/` | 2 |
| `stat/` | `composables/`, `chart/`, `date/`, `components/` | 3 |
| `currencies/` | `store.ts`, `types.ts` | 4 |
| `user/` | `store.ts` | 4/5 |

Kardeş dizinler:
- `../services/db/` — tauri-plugin-sql sarmalayıcı (`watchTable`, `upsertRow`, `deleteRow`, `transforms`). Faz 1.
- `../shared/lib/` — çerçeveden bağımsız saf yardımcılar (finapp `amount/getTotal.ts` vb.). Faz 1.
