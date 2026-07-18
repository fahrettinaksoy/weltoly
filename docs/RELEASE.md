# Weltoly — Packaging & Release Guide

This document covers producing signed packages for Windows, macOS, Linux, iOS,
and Android. Code-signing certificates and store accounts are **your
responsibility to provision** (they cannot be generated for you).

## 0. Prerequisites

- Node.js ≥ 20, Rust (rustup), dependencies via `npm ci`
- Desktop: platform WebView dependencies (the apt packages in `.github/workflows/release.yml` for Linux)
- Mobile: Android Studio + SDK + NDK; Xcode for iOS (macOS only)

## 1. Version number

Update `version` in `src-tauri/tauri.conf.json` and `package.json` (e.g. `0.2.0`).

## 2. Desktop build (unsigned — local test)

```bash
npm run tauri:build
```

Outputs under `src-tauri/target/release/bundle/`:

- macOS: `.app` + `.dmg`
- Windows: `.msi` and/or `.exe` (NSIS)
- Linux: `.AppImage` + `.deb`

> Unsigned packages work for local testing but warn on distribution. Signing (below) is required for distribution.

## 3. macOS signing + notarization

Requires an Apple Developer account ($99/yr).

1. Create a **Developer ID Application** certificate and export it as `.p12`.
2. Add these as GitHub repo → Settings → Secrets:
   - `APPLE_CERTIFICATE` (base64-encoded .p12), `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY` (e.g. `Developer ID Application: Name (TEAMID)`)
   - `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
3. CI (`release.yml`) signs + notarizes automatically with those secrets.

> For local signing, use the `xcrun notarytool` flow; see Tauri's "macOS code signing" docs.

## 4. Windows signing

Requires a code-signing certificate (OV/EV).

- Via Tauri `tauri.conf.json` → `bundle.windows.certificateThumbprint` / `signCommand`, or a signing step in CI.
- An EV certificate speeds up SmartScreen reputation. See Tauri's "Windows code signing".

## 5. Linux

- `.AppImage` and `.deb` can be distributed unsigned. Flatpak/Snap are optional.
- `bundle.linux.deb.depends` lists required libraries (WebKitGTK, GTK3).

## 6. Auto-update (SET UP)

The infrastructure is ready — `tauri-plugin-updater` + `tauri-plugin-process` are
installed, the public key is embedded in `tauri.conf.json` → `plugins.updater.pubkey`,
and the endpoint points at GitHub Releases (`latest.json`). In-app, **Settings →
Data → Check for updates** calls `checkForUpdates()`.

**Signing key** (generated with `npm run tauri signer generate`):

- Private key: `src-tauri/.tauri/weltoly-updater.key` — **gitignored, never
  committed**. Back this file up somewhere safe; if you lose it you can never again
  publish a signed update (a new key = auto-update breaks for all users).
- Public key: `...key.pub` (already embedded in the config).

**All you need to do for a release** — GitHub repo → Settings → Secrets:

- `TAURI_SIGNING_PRIVATE_KEY` = the **contents** of the private key file
  (`cat src-tauri/.tauri/weltoly-updater.key`).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = empty (the key was generated without a
  password) or your password if you set one.

With those secrets set, `tauri-action` generates and signs `latest.json` on each
release and attaches it; the endpoint finds it automatically. Without the secret
the build still works, only the updater JSON is not produced.

## 7. Android

```bash
npm run tauri android init        # once: generates the Android project
npm run tauri android dev         # development
npm run tauri android build       # AAB/APK
```

- Create a **keystore** (`keytool`), configure signing under `src-tauri/gen/android`.
- Play Store: Google Play Developer account ($25 one-time), AAB upload, privacy form.
- Icons are already generated via `tauri icon` (`mipmap-*`).

## 8. iOS (macOS only)

```bash
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```

- Requires an Apple Developer account, provisioning profile + signing identity.
- App Store Connect app registration, TestFlight, privacy "nutrition label".

## 9. CI/CD (ready)

`.github/workflows/release.yml` — pushing a `v*` tag builds for macOS (arm+intel),
Windows, and Linux, and creates a **draft Release**. It signs automatically when the
signing secrets are present.

```bash
git tag v0.2.0 && git push origin v0.2.0
```

## 10. Pre-release checklist

- [ ] Version bumped (conf + package.json)
- [ ] `npm run typecheck && npm test && npm run build` green
- [ ] Installed + launched on a clean machine per platform
- [ ] (Mobile) safe-area, keyboard, back button, bundled SQLite verified
- [ ] Privacy copy / store assets ready
- [ ] (Optional) CSP hardening (`tauri.conf.json` security.csp)

## Notes

- SQLite is **bundled into the build** (sqlx `sqlite`) — no system `libsqlite3` dependency on Android.
- There is no cloud sync (local-first). If added, use `tauri-plugin-deep-link` + OAuth callback for auth.
