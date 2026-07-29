# Copper UI React shell

Type: prototype
Status: resolved

## Question

Rebuild the Copper-inspired Capture shell in React/shadcn (search, section headers, soft cards, circle-complete, bottom composer, Done, expand-to-edit, silent toast) against in-memory data — matching the locked visual direction from [Airy list + Composer + expand + capture toast](./05-airy-list-shell-prototype.md) with real CSS liberty.

## Answer

Shipped in `src/components/capture-*.tsx` on `platform/tauri-react`:

- Search, PROMPTS / LINKS / INBOX sections, soft cards, circle Done
- Click expands to edit; Cmd/Ctrl-click multi-select + Copy as list
- Bottom Composer (Enter submits), Done accordion, silent Captured toast
- Demo seed when the SQLite DB is empty; Ultracite-clean
