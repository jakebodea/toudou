# Persistence boundary (SQLite service)

Type: task
Status: resolved

## Question

Stand up the persistence boundary from [Native SDK storage, tray, and local I/O](./02-native-sdk-storage-shell.md): SQLite at `app_dirs.data/towdow.sqlite3`, `attachments/` beside it, migrations, and narrow ops (load inbox, create/update Capture, tags, mark Done, purge by `done_at_ms`) exposed to the TypeScript `update` loop as ordinary `Msg`s — either Zig native module/ejected runner or the same companion process — without emulating a DB via whole-file `Cmd.writeFile`.

## Answer

Delivered a working companion-process spike. The ejected `build.zig` builds
and installs `towdow-storage`, a Zig executable linked to the platform
SQLite library. It resolves the same `app_dirs.data` path as the SDK, creates
`towdow.sqlite3` and adjacent `attachments/`, enables foreign keys/WAL, and
applies migration v1 through `PRAGMA user_version`.

Migration v1 defines Captures, Tags, capture/tag relationships, attachment
metadata, and indexes for inbox ordering and Done expiry. The proven narrow
operations are:

- `create <body> [created_at_ms]`
- `list`
- `mark-done <id> [done_at_ms]`
- `purge <cutoff_ms>` and `purge-expired`

`src/core.ts` exposes load/create/mark-Done/purge intents in the exhaustive
`Msg` union, issues the companion calls as `Cmd.spawn` data, and receives
results through ordinary `storage_finished` / `storage_failed` messages.
No SQLite bytes pass through `Cmd.readFile` or `Cmd.writeFile`.

Verification completed:

```sh
native check
native build

# Run against an isolated HOME:
HOME="$TEST_HOME" zig-out/bin/towdow-storage init
HOME="$TEST_HOME" zig-out/bin/towdow-storage create "first capture" 1000
HOME="$TEST_HOME" zig-out/bin/towdow-storage list
HOME="$TEST_HOME" zig-out/bin/towdow-storage mark-done 1 2000
HOME="$TEST_HOME" zig-out/bin/towdow-storage purge 2000
```

The isolated run created the expected database/attachments paths, reported
schema version 1, round-tripped the Capture, marked it Done, respected the
purge cutoff, and removed it at the cutoff.

Remaining gaps before this is the production persistence layer:

- Package the companion inside the app bundle and resolve its executable
  path; the TypeScript spike currently invokes `zig-out/bin/towdow-storage`.
- Decode companion JSON into typed Capture model records rather than retaining
  opaque result bytes.
- Add update-Capture, Tag replacement/listing, and attachment
  registration/orphan-file cleanup operations.
- Wire the real Composer/list UI and boot/hourly expiry scheduling; this
  ticket deliberately did not rebuild the UI or implement global capture.
- Define transaction/concurrency policy beyond SQLite WAL + a two-second busy
  timeout, and add durable migration fixtures for future schema versions.
