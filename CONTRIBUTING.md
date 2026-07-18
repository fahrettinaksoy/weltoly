# Contributing

Thanks for your interest! Please read this short guide before contributing to Weltoly.

## Development environment

- **Node.js ≥ 20** (`.nvmrc` → `nvm use`), npm
- **Rust** toolchain is pinned via `src-tauri/rust-toolchain.toml` — `rustup`
  installs the right version automatically. Nothing to do manually.
- Desktop WebView dependencies per platform (see the [README](README.md)).

```bash
npm install          # dependencies + git hooks (simple-git-hooks)
npm run dev          # web only (Vite)
npm run tauri:dev    # native desktop app
```

## Quality gates (enforced in CI)

A PR must have ALL of these green before it can be merged. Run the same locally
before pushing:

| Command | What it checks |
| ------- | -------------- |
| `npm run typecheck` | `vue-tsc` — type safety |
| `npm run lint` | ESLint (@antfu) — code style |
| `npm test` | Vitest — frontend unit tests |
| `cargo fmt --check` | Rust formatting (src-tauri/) |
| `cargo clippy --all-targets -- -D warnings` | Rust lint |
| `cargo test` | Rust tests (tx.rs transaction integrity) |

The `npm audit` (prod) and `cargo audit` supply-chain gates also run.

> The **pre-commit hook** runs `eslint --fix` on changed files via `lint-staged`.
> Check the Rust side manually (`cargo fmt && cargo clippy`).

## Commits and PRs

- Small, focused commits. Commit messages follow
  **[Conventional Commits](https://www.conventionalcommits.org/)**:
  `feat(rates): ...`, `fix(db): ...`, `chore(ci): ...`.
- Branch names: `feat/...`, `fix/...`, `chore/...`.
- In the PR description, explain **what** and **why**; if behavior changes, say how
  you verified it (this repo has a "don't claim without measuring" culture — see
  `docs/`).
- When adding user-facing text, add all three of **tr/en/ru** in `src/i18n/messages.ts`.

## Architecture notes

- `src/features/*` — vertical feature slices (store + components + pure logic + tests).
- `src/services/db` — SQLite access; multi-step writes go through the Rust `run_tx`
  command (`src-tauri/src/tx.rs`), never through separate JS `execute` calls.
- Use `@/shared/lib/logger` instead of `console.*` for logging — it writes to the
  persistent log file (the only exception is the logger module itself).

## Conduct

This project is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md).
