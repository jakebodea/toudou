## Destination

A working macOS-first **Tauri 2 + React + Vite + shadcn** desktop app in this repo: capture selected content via global double-Shift (or best available path + configurable fallback), store everything locally (SQLite + attachments), organize with Tags + auto Source and filters, list + bottom Composer + expand-to-edit, multi-copy as numbered list, Done as collapsible/filterable with 24h purge. Copper-inspired soft UI with full CSS/animation control. Pronounced “too-doo.”

## Notes

- Domain: personal capture inbox (prompts/snippets), not a classic todo app — see root `CONTEXT.md`
- Skills: `/grilling`, `/domain-modeling`, `/research`, `/prototype`, `/shadcn`
- Execution allowed: destination is a working MVP in-repo
- Platform: **Tauri 2 + React + TypeScript + shadcn**; macOS-first
- Brand: Copper-inspired — soft cards, section headers, search, circle-complete, bottom composer; silent minimal toast
- Capture: selection first, clipboard fallback; text + images + URLs-as-text — thin native helper for global gesture + AX (research 01 still applies)
- Storage: local SQLite + attachments (prefer Tauri SQL plugin or similar; Native SDK `toudou-storage` spike is reference-only)
- Shell: tray + hide-on-close preferred (Tauri supports this without rewriting the UI stack)
- Hotkey: global double-Shift is the goal; configurable global hotkey is an acceptable fallback

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [Scaffold Native SDK app in repo](.scratch/toudou/issues/03-scaffold-native-sdk-app.md) — Root TypeScript scaffold runs with Toudou identity and hide-on-close; tray wiring awaits a TypeScript declaration seam.
- [Persistence boundary (SQLite service)](.scratch/toudou/issues/09-persistence-boundary.md) — Ejected build installs a Zig/SQLite companion at the TypeScript `Cmd.spawn` seam; create/list/Done/purge are proven, with packaging and typed model decoding left for follow-up. *(superseded as implementation path by Tauri pivot — keep as reference)*
- [Global double-Shift + selection capture on macOS](.scratch/toudou/issues/01-global-capture-path.md) — Use a non-sandboxed macOS companion: event-tap double-Shift, Accessibility selected text, then clipboard text/image fallback. *(still valid under Tauri)*
- [Native SDK storage, tray, and local I/O](.scratch/toudou/issues/02-native-sdk-storage-shell.md) — Keep SQLite and attachments in app data via a Zig-owned persistence boundary; tray/hide and timers are supported, while image clipboard needs native extension work. *(Native-SDK-specific; superseded)*
- [Airy list + Composer + expand + capture toast](.scratch/toudou/issues/05-airy-list-shell-prototype.md) — Copper-inspired direction chosen; rebuild the shell in React/shadcn under Tauri rather than Native SDK markup.
- [Port airy list prototype onto Zig core](.scratch/toudou/issues/11-port-prototype-to-zig-core.md) — Ruled out; TypeScript UI stack; no Zig app core.
- [Platform pivot to Tauri + React + shadcn](.scratch/toudou/issues/13-platform-pivot-tauri.md) — Leave Native SDK; Tauri 2 + React + Vite + shadcn for CSS/animation liberty and React comfort.
- [Scaffold Tauri 2 + React + shadcn](.scratch/toudou/issues/14-scaffold-tauri-react-shadcn.md) — Runnable Tauri/React/shadcn app at repo root; `bun run tauri dev` / build verified.
- [Copper UI React shell](.scratch/toudou/issues/15-copper-ui-react-shell.md) — Single capture list + optional tags + Composer + Done; click expands to edit; ⌘/ctrl-click multi-select; system “Captured” notification when window is hidden.
- [Tauri SQLite persistence](.scratch/toudou/issues/12-storage-companion-productionize.md) — In-process `rusqlite` at app data; create/list/update/Done/24h purge; tags JSON on row for MVP.
- [macOS capture (in-process)](.scratch/toudou/issues/07-macos-capture-companion.md) — Double-Shift (safe FlagsChanged tap) + ⌘⇧Space; AX selection + clipboard text; tray; `capture://created`.

## Not yet specified

- Tag create/rename/delete UX
- Whether Source tags are removable/editable
- Hotkey preferences UI
- Image clipboard → attachments spool
- Packaging / notarization + stable TCC signing
- Cross-platform beyond macOS-first

## Out of scope

- Coast app integration
- Nested folders or Projects as filing hierarchy (Tags replace this for MVP)
- Cloud sync / accounts
- Native SDK as the UI/runtime (prototype + Zig core path abandoned for MVP)
- Electron (unless Tauri is later blocked)
- Rewriting the app core to Zig solely for tray
