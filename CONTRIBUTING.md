# Katkı Rehberi

Teşekkürler! Weltoly'ye katkı sağlamadan önce lütfen bu kısa rehberi okuyun.

## Geliştirme ortamı

- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** araç zinciri `src-tauri/rust-toolchain.toml` ile SABİTTİR — `rustup`
  doğru sürümü otomatik kurar. Elle bir şey yapmanıza gerek yok.
- Masaüstü WebView bağımlılıkları (platforma göre — bkz. [README](README.md)).

```bash
npm install          # bağımlılıklar + git hook'ları (simple-git-hooks)
npm run dev          # yalnız web (Vite)
npm run tauri:dev    # native masaüstü uygulaması
```

## Kalite kapıları (CI'da zorunlu)

Bir PR birleştirilmeden önce CI şunların HEPSİNİ yeşil ister. Aynılarını yerelde
push'tan önce çalıştırın:

| Komut | Ne doğrular |
| ----- | ----------- |
| `npm run typecheck` | `vue-tsc` — tip güvenliği |
| `npm run lint` | ESLint (@antfu) — kod stili |
| `npm test` | Vitest — frontend birim testleri |
| `cargo fmt --check` | Rust biçimi (src-tauri/) |
| `cargo clippy --all-targets -- -D warnings` | Rust lint |
| `cargo test` | Rust testleri (tx.rs transaction bütünlüğü) |

Ayrıca `npm audit` (prod) ve `cargo audit` tedarik zinciri kapıları çalışır.

> **pre-commit hook** `lint-staged` ile değişen dosyalarda `eslint --fix` çalıştırır.
> Rust tarafını elle kontrol edin (`cargo fmt && cargo clippy`).

## Commit ve PR

- Küçük, odaklı commit'ler. Commit mesajı **[Conventional Commits](https://www.conventionalcommits.org/)**
  formatında: `feat(rates): ...`, `fix(db): ...`, `chore(ci): ...`.
- Dal adı: `feat/...`, `fix/...`, `chore/...`.
- PR açıklamasında **ne** ve **neden**'i yazın; davranış değişiyorsa nasıl
  doğruladığınızı belirtin (bu depoda "ölçmeden iddia etme" kültürü var —
  `docs/CODE-REVIEW-*.md`).
- Kullanıcıya görünen metin eklerken **tr/en/ru** üçünü de `src/i18n/messages.ts`'e
  ekleyin.

## Mimari notlar

- `src/features/*` — dikey özellik dilimleri (store + bileşen + saf mantık + test).
- `src/services/db` — SQLite erişimi; çok-adımlı yazımlar Rust `run_tx` komutundan
  geçer (`src-tauri/src/tx.rs`), asla JS'ten ayrı `execute`'larla değil.
- Log için `console.*` DEĞİL `@/shared/lib/logger` kullanın — kalıcı log dosyasına
  yazar (tek istisna: logger modülünün kendisi).

## Davranış

Bu proje [Katkıda Bulunan Sözleşmesi](CODE_OF_CONDUCT.md) kapsamındadır.
