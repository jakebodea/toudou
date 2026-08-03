# toudou

Personal desktop capture inbox (“too-doo”). macOS-first.

**Stack:** Tauri 2 · React · Vite · TypeScript · shadcn/ui · Ultracite (Biome)

## Install (friends)

macOS, one liner (repo must be **public** so GitHub Releases are downloadable):

```sh
curl -fsSL https://raw.githubusercontent.com/jakebodea/toudou/main/scripts/install.sh | bash
```

Installs to `/Applications/toudou.app`. First launch: right-click → Open (unsigned / Gatekeeper).

Override install location:

```sh
TOUDOU_INSTALL_DIR="$HOME/Applications" bash scripts/install.sh
```

## Develop

```sh
bun install
bun run tauri dev
```

Frontend only:

```sh
bun run dev
```

## Quality

```sh
bun run check      # Ultracite / Biome lint + format check
bun run fix        # auto-fix
bun run typecheck  # tsc --noEmit
bun run build      # production frontend build
```

Lefthook: pre-commit runs `ultracite fix` on staged files; pre-push runs `typecheck` + `check`.

Editor: Biome format-on-save via `.vscode/settings.json` (install the recommended Biome extension).

## Capture (macOS)

- **Left Double-Shift** — adds selected text only (Accessibility); needs Input Monitoring. No selection → no capture
- **Right Double-Shift** — opens and focuses the window, including when it is hidden or minimized
- **⌘⇧Space** — same selection-only path (works without Input Monitoring)
- Close window → hides to tray (Quit from tray menu)

## Release + OTA updates

Installed apps poll GitHub Releases (`latest.json`) on launch and from **Settings → Check for updates**. Updates are signed with the Tauri updater key and replace the app binary (not App Store).

### Local (fastest while iterating)

```sh
bun run tauri build
open src-tauri/target/release/bundle/dmg
```

That produces `toudou.app` + a `.dmg`. Drag the app wherever you want (Applications is optional). Unsigned builds will show a Gatekeeper warning — right-click → Open the first time, or clear quarantine:

```sh
xattr -cr /path/to/toudou.app
```

To replace the installed local app in one step, use:

```sh
bun run rebuild:app
```

It quits toudou, builds a release bundle, replaces `/Applications/toudou.app`,
signs it with the local `toudou Development` Keychain identity, and opens the
new app. Your Captures remain in Application Support. The stable signature lets
macOS keep Accessibility and Input Monitoring grants across rebuilds. It builds
only the local `.app` bundle, so it does not require the updater signing key.

### GitHub Release

1. Bump `version` in `package.json` and `src-tauri/tauri.conf.json` (keep them in sync).
2. Commit, then tag and push:

```sh
git tag v0.1.0
git push origin v0.1.0
```

3. The [Release](.github/workflows/release.yml) workflow builds macOS arm64 + x64, signs updater artifacts, uploads `latest.json`, and publishes the GitHub Release.

Secrets required by CI:

- `TAURI_SIGNING_PRIVATE_KEY` — from `~/.tauri/toudou.key` (do not commit)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — empty if the key has no password
- `APPLE_CERTIFICATE` — base64-encoded `.p12` for a **Developer ID Application** certificate
- `APPLE_CERTIFICATE_PASSWORD` — password used when exporting that `.p12`
- `KEYCHAIN_PASSWORD` — a dedicated, random password for the temporary CI keychain
- `APPLE_ID` — Apple ID used to notarize releases
- `APPLE_PASSWORD` — app-specific password for that Apple ID
- `APPLE_TEAM_ID` — Apple Developer Team ID

The release job refuses to publish without these values. That is intentional: ad-hoc
signing gives each build a new macOS identity, which makes Accessibility, Input
Monitoring, and notification permissions look like they belong to a new app after
an update.

Public key lives in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Losing the private key breaks OTA for existing installs — keep a backup of `~/.tauri/toudou.key`.

**Private repo note:** friends cannot hit `/releases/latest/...` or the install script until the repo is public (or you host artifacts elsewhere). Flip with:

```sh
gh repo edit jakebodea/toudou --visibility public
```

Tauri updater signing and Apple Developer ID signing solve different problems: the
first authenticates the update payload; the second gives macOS a stable app identity
and enables notarization.

## Wayfinder

Planning lives in `.scratch/toudou/map.md`.
