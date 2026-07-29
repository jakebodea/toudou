use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capture {
    pub id: String,
    pub body: String,
    pub source: String,
    pub section: String,
    pub tags: Vec<String>,
    pub done: bool,
    pub done_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCapture {
    pub id: String,
    pub body: String,
    pub source: String,
    pub section: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub done_at: Option<i64>,
}

pub struct Db(pub Mutex<Connection>);

pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 2000;
        ",
    )
    .map_err(|e| e.to_string())?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if version < 1 {
        conn.execute_batch(
            "
            CREATE TABLE captures (
              id TEXT PRIMARY KEY NOT NULL,
              body TEXT NOT NULL,
              source TEXT NOT NULL,
              section TEXT NOT NULL,
              tags_json TEXT NOT NULL DEFAULT '[]',
              done INTEGER NOT NULL DEFAULT 0,
              done_at INTEGER,
              created_at INTEGER NOT NULL
            );
            CREATE INDEX idx_captures_inbox ON captures(done, created_at DESC);
            CREATE INDEX idx_captures_done_at ON captures(done_at);
            PRAGMA user_version = 1;
            ",
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn row_to_capture(row: &rusqlite::Row<'_>) -> Result<Capture, rusqlite::Error> {
    let tags_json: String = row.get(4)?;
    let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
    let done: i64 = row.get(5)?;
    Ok(Capture {
        id: row.get(0)?,
        body: row.get(1)?,
        source: row.get(2)?,
        section: row.get(3)?,
        tags,
        done: done != 0,
        done_at: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub fn list_captures(conn: &Connection) -> Result<Vec<Capture>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT id, body, source, section, tags_json, done, done_at, created_at
            FROM captures
            ORDER BY created_at DESC
            ",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_capture)
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn create_capture(conn: &Connection, capture: &NewCapture) -> Result<Capture, String> {
    let tags_json = serde_json::to_string(&capture.tags).map_err(|e| e.to_string())?;
    let done_int = i64::from(capture.done);
    conn.execute(
        "
        INSERT INTO captures (id, body, source, section, tags_json, done, done_at, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ",
        params![
            capture.id,
            capture.body,
            capture.source,
            capture.section,
            tags_json,
            done_int,
            capture.done_at,
            capture.created_at
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Capture {
        id: capture.id.clone(),
        body: capture.body.clone(),
        source: capture.source.clone(),
        section: capture.section.clone(),
        tags: capture.tags.clone(),
        done: capture.done,
        done_at: capture.done_at,
        created_at: capture.created_at,
    })
}

pub fn update_body(conn: &Connection, id: &str, body: &str) -> Result<(), String> {
    let changed = conn
        .execute(
            "UPDATE captures SET body = ?1 WHERE id = ?2",
            params![body, id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err(format!("capture not found: {id}"));
    }
    Ok(())
}

pub fn set_done(
    conn: &Connection,
    id: &str,
    done: bool,
    done_at: Option<i64>,
) -> Result<(), String> {
    let done_int = i64::from(done);
    let changed = conn
        .execute(
            "UPDATE captures SET done = ?1, done_at = ?2 WHERE id = ?3",
            params![done_int, done_at, id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err(format!("capture not found: {id}"));
    }
    Ok(())
}

pub fn purge_done_before(conn: &Connection, cutoff_ms: i64) -> Result<usize, String> {
    let changed = conn
        .execute(
            "
            DELETE FROM captures
            WHERE done = 1 AND done_at IS NOT NULL AND done_at <= ?1
            ",
            params![cutoff_ms],
        )
        .map_err(|e| e.to_string())?;
    Ok(changed)
}

pub fn count_captures(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM captures", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

pub fn seed_if_empty(conn: &Connection, seed: &[NewCapture]) -> Result<bool, String> {
    let count = count_captures(conn)?;
    if count > 0 {
        return Ok(false);
    }
    for capture in seed {
        create_capture(conn, capture)?;
    }
    Ok(true)
}
