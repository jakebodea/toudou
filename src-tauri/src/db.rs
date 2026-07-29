use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    pub kind: String,
    pub image_path: Option<String>,
    pub in_progress: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub image_path: Option<String>,
    #[serde(default)]
    pub in_progress: bool,
}

fn default_kind() -> String {
    "text".to_string()
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

    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if version < 2 {
        conn.execute_batch(
            "
            ALTER TABLE captures ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
            ALTER TABLE captures ADD COLUMN image_path TEXT;
            PRAGMA user_version = 2;
            ",
        )
        .map_err(|e| e.to_string())?;
    }

    let version: i32 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if version < 3 {
        conn.execute_batch(
            "
            ALTER TABLE captures ADD COLUMN in_progress INTEGER NOT NULL DEFAULT 0;
            CREATE INDEX idx_captures_in_progress ON captures(in_progress, created_at DESC);
            PRAGMA user_version = 3;
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
    let in_progress: i64 = row.get(10)?;
    Ok(Capture {
        id: row.get(0)?,
        body: row.get(1)?,
        source: row.get(2)?,
        section: row.get(3)?,
        tags,
        done: done != 0,
        done_at: row.get(6)?,
        created_at: row.get(7)?,
        kind: row.get(8)?,
        image_path: row.get(9)?,
        in_progress: in_progress != 0,
    })
}

pub fn list_captures(conn: &Connection) -> Result<Vec<Capture>, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT id, body, source, section, tags_json, done, done_at, created_at, kind, image_path, in_progress
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
    let in_progress_int = i64::from(capture.in_progress && !capture.done);
    conn.execute(
        "
        INSERT INTO captures (
          id, body, source, section, tags_json, done, done_at, created_at, kind, image_path, in_progress
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ",
        params![
            capture.id,
            capture.body,
            capture.source,
            capture.section,
            tags_json,
            done_int,
            capture.done_at,
            capture.created_at,
            capture.kind,
            capture.image_path,
            in_progress_int
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
        kind: capture.kind.clone(),
        image_path: capture.image_path.clone(),
        in_progress: in_progress_int != 0,
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

pub fn update_tags(conn: &Connection, id: &str, tags: &[String]) -> Result<(), String> {
    let tags_json = serde_json::to_string(tags).map_err(|e| e.to_string())?;
    let changed = conn
        .execute(
            "UPDATE captures SET tags_json = ?1 WHERE id = ?2",
            params![tags_json, id],
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
    // Completing clears in_progress; restoring leaves the row in the inbox.
    let in_progress_int = 0_i64;
    let changed = conn
        .execute(
            "UPDATE captures SET done = ?1, done_at = ?2, in_progress = ?3 WHERE id = ?4",
            params![done_int, done_at, in_progress_int, id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err(format!("capture not found: {id}"));
    }
    Ok(())
}

/// Set workflow status: `active`, `in_progress`, or `done`.
pub fn set_status(conn: &Connection, id: &str, status: &str) -> Result<(), String> {
    let (done, done_at, in_progress) = match status {
        "active" => (false, None, false),
        "in_progress" => (false, None, true),
        "done" => (
            true,
            Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as i64)
                    .unwrap_or(0),
            ),
            false,
        ),
        _ => return Err(format!("invalid status: {status}")),
    };
    let changed = conn
        .execute(
            "UPDATE captures SET done = ?1, done_at = ?2, in_progress = ?3 WHERE id = ?4",
            params![
                i64::from(done),
                done_at,
                i64::from(in_progress),
                id
            ],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err(format!("capture not found: {id}"));
    }
    Ok(())
}

pub fn purge_done_before(conn: &Connection, cutoff_ms: i64) -> Result<usize, String> {
    let mut stmt = conn
        .prepare(
            "
            SELECT image_path FROM captures
            WHERE done = 1 AND done_at IS NOT NULL AND done_at <= ?1
              AND image_path IS NOT NULL
            ",
        )
        .map_err(|e| e.to_string())?;
    let paths = stmt
        .query_map(params![cutoff_ms], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let changed = conn
        .execute(
            "
            DELETE FROM captures
            WHERE done = 1 AND done_at IS NOT NULL AND done_at <= ?1
            ",
            params![cutoff_ms],
        )
        .map_err(|e| e.to_string())?;

    for path in paths {
        let _ = std::fs::remove_file(PathBuf::from(path));
    }

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

pub fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "png",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::fs;
    use tempfile::tempdir;

    fn sample(id: &str, body: &str, created_at: i64) -> NewCapture {
        NewCapture {
            id: id.to_string(),
            body: body.to_string(),
            source: "Test".to_string(),
            section: "inbox".to_string(),
            tags: vec!["a".to_string()],
            created_at,
            done: false,
            done_at: None,
            kind: "text".to_string(),
            image_path: None,
            in_progress: false,
        }
    }

    #[test]
    fn open_migrates_to_v3_and_supports_crud() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("towdow.sqlite3");
        let conn = open(&path).unwrap();

        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 3);

        create_capture(&conn, &sample("1", "hello", 100)).unwrap();
        update_body(&conn, "1", "hello world").unwrap();
        update_tags(&conn, "1", &["x".to_string(), "y".to_string()]).unwrap();
        set_status(&conn, "1", "in_progress").unwrap();

        let rows = list_captures(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].body, "hello world");
        assert_eq!(rows[0].tags, vec!["x".to_string(), "y".to_string()]);
        assert!(!rows[0].done);
        assert!(rows[0].in_progress);
        assert_eq!(rows[0].kind, "text");

        set_done(&conn, "1", true, Some(200)).unwrap();
        let rows = list_captures(&conn).unwrap();
        assert!(rows[0].done);
        assert!(!rows[0].in_progress);
        assert_eq!(rows[0].done_at, Some(200));
    }

    #[test]
    fn migrates_v1_rows_to_v3() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("legacy.sqlite3");
        {
            let conn = Connection::open(&path).unwrap();
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
                PRAGMA user_version = 1;
                ",
            )
            .unwrap();
            conn.execute(
                "
                INSERT INTO captures (id, body, source, section, tags_json, done, done_at, created_at)
                VALUES ('legacy', 'old', 'Vim', 'inbox', '[\"tag\"]', 0, NULL, 42)
                ",
                [],
            )
            .unwrap();
        }

        let conn = open(&path).unwrap();
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 3);

        let rows = list_captures(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "legacy");
        assert_eq!(rows[0].kind, "text");
        assert_eq!(rows[0].image_path, None);
        assert!(!rows[0].in_progress);
        assert_eq!(rows[0].tags, vec!["tag".to_string()]);
    }

    #[test]
    fn purge_removes_rows_and_image_files() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("purge.sqlite3");
        let image = dir.path().join("shot.png");
        fs::write(&image, b"png-bytes").unwrap();

        let conn = open(&path).unwrap();
        create_capture(
            &conn,
            &NewCapture {
                id: "img".into(),
                body: String::new(),
                source: "Test".into(),
                section: "inbox".into(),
                tags: vec![],
                created_at: 1,
                done: true,
                done_at: Some(10),
                kind: "image".into(),
                image_path: Some(image.to_string_lossy().into_owned()),
                in_progress: false,
            },
        )
        .unwrap();
        create_capture(
            &conn,
            &NewCapture {
                id: "keep".into(),
                body: "fresh".into(),
                source: "Test".into(),
                section: "inbox".into(),
                tags: vec![],
                created_at: 2,
                done: true,
                done_at: Some(1000),
                kind: "text".into(),
                image_path: None,
                in_progress: false,
            },
        )
        .unwrap();

        let removed = purge_done_before(&conn, 50).unwrap();
        assert_eq!(removed, 1);
        assert!(!image.exists());

        let rows = list_captures(&conn).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "keep");
    }

    #[test]
    fn seed_if_empty_only_once() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("seed.sqlite3");
        let conn = open(&path).unwrap();
        let seed = vec![sample("a", "one", 1), sample("b", "two", 2)];
        assert!(seed_if_empty(&conn, &seed).unwrap());
        assert!(!seed_if_empty(&conn, &seed).unwrap());
        assert_eq!(count_captures(&conn).unwrap(), 2);
    }
}
