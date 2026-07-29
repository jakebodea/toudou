# Airy list + Composer + expand + capture toast

Type: prototype
Status: resolved

## Question

Raise fidelity with a rough Native SDK UI shell: Capture list, bottom Composer (Enter submits), click-to-expand edit, collapsible Done section, and a very minimal silent capture confirmation visual — so we can react to layout/density before wiring real persistence and global capture.

## Answer

Copper-inspired direction locked (soft cards, section headers, search, circle-complete, bottom composer) — see prototype branch `prototype/airy-list-shell` and the Copper reference screenshot. Native SDK house components were too constraining; platform pivoted to Tauri + React + shadcn ([Platform pivot to Tauri + React + shadcn](./13-platform-pivot-tauri.md)). Rebuild this shell in React next; do not invest further in Native SDK markup.
