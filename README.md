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

Pre-commit runs `lint-staged` → `ultracite fix` on staged JS/TS/CSS/JSON/MD.

Editor: Biome format-on-save via `.vscode/settings.json` (install the recommended Biome extension).

## Wayfinder

Planning lives in `.scratch/towdow/map.md`.
