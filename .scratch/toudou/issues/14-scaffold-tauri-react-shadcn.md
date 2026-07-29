# Scaffold Tauri 2 + React + shadcn

Type: task
Status: resolved

## Question

Replace the Native SDK tree with a runnable **Tauri 2 + React + Vite + TypeScript** app at the repo root (or clean sub-app), add **shadcn/ui**, Toudou identity, macOS-first window + hide-to-tray stubs if cheap, and leave `bun dev` / `tauri dev` as the one-command loop — so the Copper UI and capture work have a real home.

## Answer

Scaffolded on branch `platform/tauri-react`: Tauri 2 + React + Vite + TypeScript, shadcn (radix / nova preset) with Input, Checkbox, Badge, Separator, ScrollArea, Textarea, Accordion, Card, Button. Product identity `Toudou` / `dev.toudou.app`. Window sized ~420×720. Tray stubs deferred. Verified `bun run build` and `bun run tauri build` (Toudou.app produced).

```sh
bun install
bun run tauri dev
```
