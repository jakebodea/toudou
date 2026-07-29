# Productionize storage companion

Type: task
Status: open
Blocked by: 14

## Question

Under **Tauri 2**, implement local SQLite + attachments for Captures/Tags (create/list/update/Done/purge/tags), using the schema ideas from [Persistence boundary (SQLite service)](./09-persistence-boundary.md) as reference — not the Native SDK `towdow-storage` binary as the required runtime. Prefer a Tauri-native approach (e.g. plugin-sql or Rust commands) over the Zig spawn companion unless that stays clearly simpler.
