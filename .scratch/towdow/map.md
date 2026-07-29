## Destination

A working macOS-first [Native SDK](https://native-sdk.dev/introduction) desktop app in this repo: capture selected content via global double-Shift (or best available path + configurable fallback), store everything locally (SQLite + attachments), organize with Tags + auto Source and filters, list + bottom Composer + expand-to-edit, multi-copy as numbered list, Done as collapsible/filterable with 24h purge. Clean, minimal, airy UI. Pronounced “toe doe.”

## Notes

- Domain: personal capture inbox (prompts/snippets), not a classic todo app — see root `CONTEXT.md`
- Skills: `/grilling`, `/domain-modeling`, `/research`, `/prototype`; Native SDK docs at https://native-sdk.dev
- Execution allowed: destination is a working MVP in-repo, not a handoff-only spec
- Platform: Native SDK (no shadcn/React/WebView UI); macOS-first
- Brand: clean, minimal, airy; silent capture feedback (tiny visual only, no system notification/sound)
- Capture: selection first, clipboard fallback; text + images + URLs-as-text
- Storage: SQLite in app data dir + `attachments/` for image bytes
- Shell: tray + hide-on-close
- Hotkey: global double-Shift is the goal; configurable global hotkey is an acceptable fallback

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

## Not yet specified

- Exact shape of the minimal capture toast / visual confirmation
- How users create/rename/delete Tags (beyond assigning on Expanded Capture)
- Whether Source tags are removable/editable by the user
- Hotkey preferences UI (where double-Shift / fallback is configured)
- Search across Capture bodies
- Packaging / install distribution beyond `native package`
- Cross-platform (Linux/Windows) beyond “Native SDK can target them later”

## Out of scope

- Coast app integration (screen history/OCR) — Source comes from frontmost app at capture time, not Coast
- shadcn / React / WebView-first UI
- Nested folders or Projects as a filing hierarchy (Tags replace this for MVP)
- Cloud sync / accounts
