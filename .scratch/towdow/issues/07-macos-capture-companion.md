# macOS capture companion

Type: task
Status: open
Blocked by: 14

## Question

Implement (or spike) the thin non-sandboxed macOS companion from [Global double-Shift + selection capture on macOS](./01-global-capture-path.md) for **Tauri**: listen-only `CGEventTap` double-Shift, Accessibility selected text, AppKit clipboard text/PNG/TIFF fallback, spool large payloads to app data, and notify the Tauri/React app (events or IPC) while the window is hidden.
