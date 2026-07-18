# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Rust CI quality gate** — `cargo fmt --check`, `cargo clippy -D warnings`, and
  `cargo test` now run on every push/PR (previously the `tx.rs` transaction tests
  were outside CI).
- **Supply-chain gates** — `dependabot.yml` (npm/cargo/actions) and `npm audit`
  (prod) + `cargo audit` in CI.
- README status badges (CI, license, release, platforms) and a `FUNDING.yml`
  template. (CodeQL code scanning is enabled via GitHub "Default setup" — no
  separate workflow needed.)
- **Observability** — global Vue `errorHandler` + `window` error listeners, a
  persistent rotating log file via `tauri-plugin-log`, the `@/shared/lib/logger`
  wrapper, and an "Open log folder" diagnostics button in Settings.
- **Auto-update** — `tauri-plugin-updater` + `tauri-plugin-process`, over signed
  GitHub Releases; "Check for updates" in Settings.
- **Boot smoke test** — verifies the real `App.vue` mounts cleanly with the full
  plugin stack (Vitest).
- Test coverage measurement and CI thresholds (`@vitest/coverage-v8`, `test:coverage`).
- Toolchain pinning: `rust-toolchain.toml`, `.nvmrc`.
- Repository governance: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `CODEOWNERS`, PR/issue templates, `.editorconfig`.
- **DB at-rest encryption foundation** — pure, tested logic deriving a SQLCipher
  raw key from the PIN (`dbKey.ts`); encryption is not enabled yet (plugin
  limitation), with the plan/risk documented in `docs/DB-ENCRYPTION-PLAN.md`.
- CI concurrency so superseded PR runs are cancelled; `.DS_Store` is gitignored.

### Changed

- All `console.error/warn` calls are routed to the persistent `logger`.
- English is now the default `README.md`; Turkish moved to `README.tr.md`.

## [0.1.0] — 2026

### Added

- Initial skeleton: Tauri v2 + Vue 3 + Vuetify + Pinia + vue-i18n (tr/en/ru).
- SQLite data layer (`tauri-plugin-sql`, bundled) and migrations.
- Wallets, transactions, categories, tags, statistics, and multi-currency
  (selectable rate source + freshness panel).
- PIN lock, light/dark/system theme, backup export/import.

[Unreleased]: https://github.com/fahrettinaksoy/weltoly/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fahrettinaksoy/weltoly/releases/tag/v0.1.0
