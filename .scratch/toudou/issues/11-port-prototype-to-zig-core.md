# Port airy list prototype onto Zig core

Type: task
Status: resolved

## Question

After [Airy list + Composer + expand + capture toast](./05-airy-list-shell-prototype.md) lands a density pick, port the chosen shell onto the Zig app core from [Tray status item on TypeScript scaffold](./10-tray-status-item.md) (`src/main.zig` + tray), since Native SDK 0.6.3 requires Zig for `status_item` and Toudou is staying tray-first.

## Answer

Ruled **out of the MVP route**. Keep a TypeScript app core; use Zig only for spawned helpers (storage companion proven; capture companion later). Menu-bar tray stays optional — Dock + hide-on-close is enough unless we later choose a Zig status-item shim or the SDK adds a TS seam. See map Out of scope / Notes.
