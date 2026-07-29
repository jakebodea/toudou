# Scaffold Native SDK app in repo

Type: task
Status: resolved

## Question

Scaffold a Native SDK TypeScript app at the repo root (or agreed subdir) via `native init`, wire tray/hide-on-close stubs if trivial from docs, and leave a runnable `native dev` baseline — so UI/prototype and capture work have a real tree to land in.

## Answer

Scaffolded the Native SDK 0.6.3 TypeScript app at the repository root with
the `toudou` identity and Toudou display name. The generated counter remains
as a deliberately small build/runtime smoke test; Captures, Tags, Source, and
hotkeys are reserved for follow-up tickets.

Run it from the repository root:

```sh
native dev
```

`native check` passes, and `native dev` was smoke-tested successfully after
the CLI installed its pinned Zig 0.16.0 toolchain. The main window uses
`close_policy = "hide"` and can be reopened from the Dock on macOS. A tray
status item remains a TODO: the 0.6.3 docs expose `Cmd.showWindow` and
`Cmd.quitApp` to TypeScript cores, but the generated TypeScript runner does
not expose the status-item declaration seam shown for Zig apps.
