# Security Policy

## Supported versions

Weltoly is still in `0.x`/early development; security fixes are applied only to
the `main` branch and the latest published release.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Reporting a vulnerability

If you find a security vulnerability, **do not open a public issue**. Instead:

- email **backend@cyh.com.tr**, or
- use GitHub's private **"Report a vulnerability"** flow
  (repo → Security → Advisories → Report a vulnerability).

Please include:

- the affected component (frontend / Tauri backend / SQLite layer / a dependency),
- reproduction steps or a PoC,
- your impact assessment (data leak, RCE, local file access, etc.).

**Response targets:** initial reply within 72 hours, a fix/mitigation plan within 30 days.

## Scope and threat model

Weltoly is a **local-first**, **offline** desktop application: there is no server,
account, or remote telemetry. All data lives on the user's device in SQLite.
The classes we care about most are therefore:

- **Tauri capability / CSP escapes** — `src-tauri/capabilities/default.json` and the
  `csp` in `tauri.conf.json` are deliberately narrow (only the rate APIs and the
  user's document folders). Anything that crosses those boundaries is in scope.
- **Local data integrity** — money-affecting, multi-step writes run inside a single
  SQLite transaction (`src-tauri/src/tx.rs`). Partial-write/corruption paths.
- **Dependency vulnerabilities** — CI has `npm audit` (prod) and `cargo audit` gates;
  known and unavoidable exceptions are documented with rationale in
  `src-tauri/.cargo/audit.toml`.

**Out of scope (for now):** an attacker with physical/root access to the device. The
SQLite file is currently **unencrypted at rest**. A safe foundation for encryption
exists (`src/features/auth/dbKey.ts` — deriving a SQLCipher key from the PIN, tested),
but it is **not enabled yet** because `tauri-plugin-sql` does not allow injecting
`PRAGMA key` on connect; the blocker, plan, and migration risk are in
[docs/DB-ENCRYPTION-PLAN.md](docs/DB-ENCRYPTION-PLAN.md). Today's at-rest protection
comes from OS full-disk encryption (FileVault/BitLocker/LUKS).
