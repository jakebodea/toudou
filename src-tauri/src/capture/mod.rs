#[cfg(target_os = "macos")]
mod double_shift;
#[cfg(target_os = "macos")]
mod macos;

use crate::db::{self, Db, NewCapture};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CaptureNotice {
    pub id: String,
    pub body: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility: bool,
    pub input_monitoring: bool,
}

pub(crate) struct CapturePayload {
    pub body: String,
    pub source: String,
}

pub fn start(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    macos::start_double_shift_listener(app.clone());

    let shortcut: Shortcut = match "CommandOrControl+Shift+Space".parse() {
        Ok(s) => s,
        Err(err) => {
            eprintln!("invalid capture shortcut: {err}");
            return;
        }
    };

    if let Err(err) = app.global_shortcut().register(shortcut) {
        eprintln!("failed to register capture shortcut: {err}");
    }
}

pub fn run_capture(app: &AppHandle) {
    let app_for_task = app.clone();
    if let Err(err) = app.run_on_main_thread(move || {
        run_capture_on_main(&app_for_task);
    }) {
        eprintln!("capture main-thread dispatch failed: {err}");
    }
}

fn run_capture_on_main(app: &AppHandle) {
    let Some(payload) = read_capture_payload() else {
        return;
    };

    let capture = NewCapture {
        id: Uuid::new_v4().to_string(),
        body: payload.body,
        source: payload.source,
        section: "inbox".to_string(),
        tags: vec![],
        created_at: now_ms(),
        done: false,
        done_at: None,
        kind: "text".to_string(),
        image_path: None,
        in_progress: false,
    };

    let Some(db) = app.try_state::<Db>() else {
        return;
    };

    let saved = {
        let conn = match db.0.lock() {
            Ok(conn) => conn,
            Err(_) => return,
        };
        match db::create_capture(&conn, &capture) {
            Ok(saved) => saved,
            Err(err) => {
                eprintln!("capture persist failed: {err}");
                return;
            }
        }
    };

    let notice = CaptureNotice {
        id: saved.id,
        body: saved.body,
        source: saved.source,
    };

    if let Err(err) = app.emit("capture://created", &notice) {
        eprintln!("capture emit failed: {err}");
    }

    // System notification so feedback works while the main window is hidden.
    if let Err(err) = app
        .notification()
        .builder()
        .title("toudou")
        .body("Captured")
        .show()
    {
        eprintln!("capture notification failed: {err}");
    }
}

fn read_capture_payload() -> Option<CapturePayload> {
    #[cfg(target_os = "macos")]
    {
        return macos::read_capture_payload();
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn shortcut_handler(app: &AppHandle, event_state: ShortcutState) {
    if event_state == ShortcutState::Pressed {
        run_capture(app);
    }
}

#[tauri::command]
#[specta::specta]
pub fn capture_now(app: AppHandle) -> Result<(), String> {
    run_capture(&app);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn capture_permission_status() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        return macos::permission_status();
    }
    #[cfg(not(target_os = "macos"))]
    {
        PermissionStatus {
            accessibility: false,
            input_monitoring: false,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn request_capture_permissions() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        macos::request_permissions();
        return macos::permission_status();
    }
    #[cfg(not(target_os = "macos"))]
    {
        capture_permission_status()
    }
}

#[tauri::command]
#[specta::specta]
pub fn ingest_capture(
    state: State<'_, Db>,
    body: String,
    source: String,
    app: AppHandle,
) -> Result<CaptureNotice, String> {
    let capture = NewCapture {
        id: Uuid::new_v4().to_string(),
        body,
        source,
        section: "inbox".to_string(),
        tags: vec![],
        created_at: now_ms(),
        done: false,
        done_at: None,
        kind: "text".to_string(),
        image_path: None,
        in_progress: false,
    };
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let saved = db::create_capture(&conn, &capture)?;
    let notice = CaptureNotice {
        id: saved.id,
        body: saved.body,
        source: saved.source,
    };
    let _ = app.emit("capture://created", &notice);
    let _ = app
        .notification()
        .builder()
        .title("toudou")
        .body("Captured")
        .show();
    Ok(notice)
}
