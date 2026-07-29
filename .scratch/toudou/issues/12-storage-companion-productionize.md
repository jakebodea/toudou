# Productionize storage companion

Type: task
Status: resolved

## Question

Under **Tauri 2**, implement local SQLite + attachments for Captures/Tags (create/list/update/Done/purge/tags), using the schema ideas from [Persistence boundary (SQLite service)](./09-persistence-boundary.md) as reference — not the Native SDK `toudou-storage` binary as the required runtime. Prefer a Tauri-native approach (e.g. plugin-sql or Rust commands) over the Zig spawn companion unless that stays clearly simpler.

## Answer

In-process Rust + `rusqlite` (bundled) under `src-tauri/src/db.rs`. DB at `app_data_dir/toudou.sqlite3`, migration v1 (`captures` table + inbox/done indexes). Commands: `list_captures`, `create_capture`, `update_capture_body`, `set_capture_done`, `purge_expired_done`, `seed_demo_captures`. React `src/lib/storage.ts` invokes them; shell boots from SQLite and purges Done after 24h. Tags as JSON array on the row for MVP; attachment files still open for image capture follow-up.
