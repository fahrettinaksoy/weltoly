# DB At-Rest Encryption — Plan and Blocker Record

**Status:** foundation laid, encryption NOT enabled yet. This document records why,
the plan, and the risk.

## Why it's not enabled yet (technical blocker)

Weltoly's data lives in `weltoly.db` as **plaintext** SQLite. The standard way to
encrypt at rest is **SQLCipher** (transparent encryption via `PRAGMA key`). However:

- `tauri-plugin-sql` 2.4.0 opens the sqlite connection with a plain `Pool::connect(url)`
  (`wrapper.rs`). There is no hook to run `PRAGMA key` before the connection is used.
- In SQLCipher, `PRAGMA key` must be the **first** statement on the connection and must
  apply to **every** connection in the pool.
- sqlx's sqlite URL parser only recognizes `mode/cache/immutable/vfs`; `key`/`pragma`
  are rejected as "unknown query parameter". So passing the key via the URL is also
  impossible.

Conclusion: encryption **cannot be added** to the plugin through a supported path.

## Already in place (safe foundation)

- `src/features/auth/dbKey.ts` — pure, tested logic that derives a SQLCipher raw key
  (64 hex) from the PIN + a per-install salt (`dbKey.test.ts`).
- Salt generation/storage follows the same pattern as the PIN flow (`pinCrypto.ts`,
  `tauri-plugin-store`).

## Implementation paths (later, verified on-device)

### Path A — our own encrypted connection layer (recommended)
1. `Cargo.toml`: add `libsqlite3-sys` with the `bundled-sqlcipher` feature (switches
   sqlx's libsqlite3-sys to SQLCipher across the workspace).
2. Bypass `tauri-plugin-sql`: build the connection pool on the Rust side with
   `SqliteConnectOptions::new().pragma("key", "x'<hex>'")` and put it in `DbInstances`
   (via a `#[command]` instead of JS `Database.load`).
3. `tx.rs` already borrows the pool from `DbInstances` — unchanged.
4. The key is passed from JS (derived from the PIN) to Rust over IPC once; Rust never
   writes it to disk.

### Path B — vendor/patch the plugin
Fork `tauri-plugin-sql` and add `pragma("key", …)` in the `connect` path. Less code but
carries the maintenance debt of diverging from upstream.

## Key/PIN relationship and rekey
- If the key derives from the PIN, then **changing the PIN requires `PRAGMA rekey`** on
  the DB (to the new key). That step must be part of the migration.
- If there is NO PIN: a per-install random key is stored in `tauri-plugin-store` (stays
  on the device). This gives encryption even for users without a PIN, but protection
  against device access is weaker (the key is on the device). Decision point.

## Plaintext → encrypted migration (RISKY — on-device verification REQUIRED)
1. On launch, detect whether the existing `weltoly.db` is plaintext.
2. Export to a new encrypted file with `sqlcipher_export()`; verify; atomically swap it
   in; delete the old file only on success.
3. Must NOT ship without testing on every platform (macOS/Windows/Linux) with clean and
   populated DBs — if it goes wrong, the user loses access to all their financial data.

## Interim (currently applicable) mitigation
- OS full-disk encryption (macOS **FileVault**, Windows **BitLocker**, Linux **LUKS**) —
  recommended to users; this is today's source of at-rest protection.
- The app PIN lock (`LockScreen`) blocks unauthorized UI access (but not the DB file).
