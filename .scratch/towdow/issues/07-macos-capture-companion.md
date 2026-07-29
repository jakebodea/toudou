# macOS capture companion

Type: task
Status: resolved

## Question

Implement (or spike) the thin non-sandboxed macOS companion from [Global double-Shift + selection capture on macOS](./01-global-capture-path.md) for **Tauri**: listen-only `CGEventTap` double-Shift, Accessibility selected text, AppKit clipboard text/PNG/TIFF fallback, spool large payloads to app data, and notify the Tauri/React app (events or IPC) while the window is hidden.

## Answer

Implemented **in-process** in the Tauri Rust binary (`src-tauri/src/capture/`) — separate companion not required while the app stays alive via tray/hide-on-close.

- Selection via Accessibility (`AXFocusedUIElement` → `AXSelectedText`); clipboard text fallback via `NSPasteboard`
- Source = frontmost app localized name
- Persist with existing SQLite `create_capture`, emit `capture://created` for React toast/refresh
- Global shortcut: **⌘⇧Space** (`tauri-plugin-global-shortcut`); capture work dispatched on main thread
- Double-Shift: custom listen-only `CGEventTap` on `FlagsChanged` only (`capture/double_shift.rs`) — no `rdev`/TSM
- Permission banner + `request_capture_permissions` / `capture_permission_status`

**Regression (2026-07-29):** `rdev` SIGTRAPped via TSM off the tap thread. Replaced with a narrow FlagsChanged tap that only reads keycode/flags and dispatches capture onto the main thread.

Still open: image clipboard → attachments, richer onboarding, packaging/TCC signing stability.
