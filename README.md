# Towdow

Personal desktop capture inbox (“toe doe”). macOS-first.

**Stack:** Tauri 2 · React · Vite · TypeScript · shadcn/ui · Ultracite (Biome)

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

- **Double-Shift** — selection (Accessibility) then clipboard text; needs Input Monitoring
- **⌘⇧Space** — same path (works without Input Monitoring; clipboard if no AX)
- Close window → hides to tray (Quit from tray menu)

## Release

### Local (fastest while iterating)

```sh
bun run tauri build
open src-tauri/target/release/bundle/dmg
```

That produces `Towdow.app` + a `.dmg`. Drag the app wherever you want (Applications is optional). Unsigned builds will show a Gatekeeper warning — right-click → Open the first time, or clear quarantine:

```sh
xattr -cr /path/to/Towdow.app
```

### GitHub Release (draft)

1. Bump `version` in `package.json` and `src-tauri/tauri.conf.json` (keep them in sync).
2. Commit, then tag and push:

```sh
git tag v0.1.0
git push origin v0.1.0
```

3. The [Release](.github/workflows/release.yml) workflow builds macOS arm64 + x64 and opens a **draft** GitHub Release with the artifacts. Publish the draft when you’re happy.

Signing/notarization (no more Gatekeeper nag) needs an Apple Developer ID + secrets later — not required for private personal use.

## Wayfinder

Planning lives in `.scratch/towdow/map.md`.
