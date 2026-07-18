# Weltoly

**English** · [Türkçe](README.tr.md)

[![CI](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml/badge.svg)](https://github.com/fahrettinaksoy/weltoly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/fahrettinaksoy/weltoly?include_prereleases&sort=semver)](https://github.com/fahrettinaksoy/weltoly/releases)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-blue)

**Weltoly** is a privacy-first, **local-first** open-source personal finance app.
Track your wallets, transactions, categories, and multi-currency balances in a
single desktop/mobile application.

All your data stays **on your device** in a SQLite database. There is no server,
no account, and **no remote telemetry** — none of your financial information ever
leaves your device. The internet is used only when you choose to fetch up-to-date
fiat/crypto exchange rates.

---

## ✨ Highlights

### Wallets

- Unlimited wallets; cash, bank, and **credit card** (limit + available balance) types
- Per-wallet icon and color, drag-and-drop ordering
- Per-wallet balance chart, period summary, and tag-based breakdown

### Transactions

- **Income**, **expense**, **transfer**, and **balance correction** types
- Built-in **calculator** for fast amount entry
- Category, tag, description, and date; powerful filtering
- Unified transactions page showing every wallet in one list

### Categories and tags

- Income/expense categories with icon and color pickers
- Sub-category rollup for hierarchical reporting
- Free-form tags for cross-cutting analysis

### Multi-currency

- **Selectable rate source:** ER-API, Frankfurter, TCMB
- **Crypto** prices via CoinGecko
- Rate **freshness panel** — transparent about when rates were last updated
- All balances consolidated into a single base currency

### Statistics and analysis

- Period-comparison spending charts (ECharts)
- Category breakdown and trend views

### Personalization

- Light / dark / system theme
- Customizable primary color, neutral palette, and corner radius
- **tr / en / ru** language support (RTL-ready foundation)

### Security and data

- **PIN lock** — exponential backoff on failed attempts; auto-lock when backgrounded
- **Export/import** backups (JSON)
- Quick start with sample data
- Diagnostic logs and in-app **auto-update** (signed)

---

## 🧱 Tech stack

| Layer        | Technology                                                    |
| ------------ | ------------------------------------------------------------- |
| App shell    | **Tauri v2** (Rust) — Windows / macOS / Linux / iOS / Android |
| UI           | **Vue 3** + **Vuetify 4** (Material)                          |
| State        | **Pinia**                                                     |
| Routing      | **Vue Router**                                                |
| Localization | **vue-i18n** (tr/en/ru)                                       |
| Charts       | **ECharts** (`vue-echarts`)                                   |
| Validation   | **Zod**                                                       |
| Dates        | **date-fns**                                                  |
| Database     | **SQLite** — `tauri-plugin-sql` (bundled)                     |
| Build        | **Vite** + TypeScript (strict)                                |

---

## 🏗️ Architecture

- **Local-first, offline:** data lives on the device in SQLite; no server/account.
- **Atomic writes:** money-affecting, multi-step operations are applied atomically
  inside a single SQLite transaction on the Rust side (`src-tauri/src/tx.rs → run_tx`)
  — no half-written/inconsistent records.
- **Reactive reads:** table changes are watched and only genuinely changed rows are
  recomputed (`services/db/watch` + `reconcile`).
- **Vertical feature slices:** each feature lives under `src/features/*` with its own
  store, types, pure logic, and tests.
- **Bundled SQLite:** no system `libsqlite3` dependency (works everywhere, incl. Android).
- **Hardened security:** narrow CSP, tightly scoped Tauri capabilities (only rate APIs
  and user document folders), no remote telemetry.

---

## 📁 Project structure

```text
weltoly/
├─ src/                      # Vue 3 frontend
│  ├─ features/              # vertical feature slices (wallets, trns, categories, …)
│  ├─ pages/                 # route pages (Dashboard, Wallets, Stats, Settings…)
│  ├─ components/            # shared components
│  ├─ services/              # db, rates, backup, updater
│  ├─ shared/lib/            # pure helpers (money, format, getTotal…)
│  ├─ stores/                # global stores (ui, settings)
│  ├─ plugins/               # vuetify, i18n, echarts
│  └─ i18n/                  # tr/en/ru dictionaries
├─ src-tauri/                # Rust backend (Tauri v2)
│  ├─ src/                   # lib.rs, tx.rs (transaction command)
│  ├─ migrations/            # SQLite schema migrations
│  └─ capabilities/          # permission scopes
└─ docs/                     # release and technical docs
```

---

## 🚀 Getting started

### Requirements

- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** — toolchain pinned via `src-tauri/rust-toolchain.toml`, installed automatically by `rustup`
- Desktop: platform WebView dependencies · Mobile: Android SDK+NDK / Xcode

### Commands

```bash
npm install          # dependencies + git hooks
npm run dev          # web preview only (Vite) — http://localhost:1420
npm run tauri:dev    # desktop app (native window)
npm run build        # web build (typecheck + vite build)
npm run tauri:build  # produce desktop bundle
npm run typecheck    # vue-tsc type check
npm test             # unit tests (Vitest)

# Mobile (after SDK setup):
npm run tauri android init && npm run tauri android dev
npm run tauri ios init && npm run tauri ios dev
```

---

## ✅ Quality gates

CI enforces the following on every push/PR (see [.github/workflows/ci.yml](.github/workflows/ci.yml)):

| Gate                     | Command                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Types                    | `npm run typecheck`                                             |
| Lint                     | `npm run lint` (@antfu)                                         |
| Frontend test + coverage | `npm run test:coverage` (Vitest)                                |
| Rust fmt/lint/test       | `cargo fmt --check` · `cargo clippy -D warnings` · `cargo test` |
| Supply chain             | `npm audit` (prod) · `cargo audit`                              |

Dependencies are updated weekly via **Dependabot**; code is scanned with **CodeQL**.
Diagnostic logs are written at runtime to a rotating file in the app log directory
(Settings → Data → **Open log folder**).

---

## 🔒 Security and privacy

- Data stays on your device; **it is never sent to any remote server.**
- Vulnerability reporting and threat model: [SECURITY.md](SECURITY.md)
- At-rest encryption roadmap and current mitigations: [docs/DB-ENCRYPTION-PLAN.md](docs/DB-ENCRYPTION-PLAN.md)

---

## 📚 Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution flow and architecture notes
- [SECURITY.md](SECURITY.md) — security policy
- [CHANGELOG.md](CHANGELOG.md) — release history
- [docs/RELEASE.md](docs/RELEASE.md) — signing, notarization, and publishing
- [docs/DB-ENCRYPTION-PLAN.md](docs/DB-ENCRYPTION-PLAN.md) — at-rest encryption plan

---

## 🤝 Contributing

Contributions are welcome. Before you start, read [CONTRIBUTING.md](CONTRIBUTING.md)
and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). When adding user-facing text, remember
to update all three of **tr/en/ru**.

## 📄 License

[MIT](LICENSE) © stackvo
