#[cfg(target_os = "macos")]
mod double_shift;
#[cfg(target_os = "macos")]
mod macos;

use crate::db::{self, Db, NewCapture};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

const CAPTURE_NOTICE_EVENT: &str = "capture://created";
const CAPTURE_NOTICE_WINDOW_LABEL: &str = "capture-notice";
const CAPTURE_NOTIFICATION_BODY: &str = "Added to toudou";

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

    show_capture_notice(app, &notice);
}

fn show_capture_notice(app: &AppHandle, notice: &CaptureNotice) {
    position_capture_notice(app);

    if let Some(window) = app.get_webview_window(CAPTURE_NOTICE_WINDOW_LABEL) {
        if let Err(err) = window.set_ignore_cursor_events(true) {
            eprintln!("capture notice input passthrough failed: {err}");
        }

        if let Err(err) = window.show() {
            eprintln!("capture notice show failed: {err}");
        }

        if let Err(err) = window.emit(CAPTURE_NOTICE_EVENT, notice) {
            eprintln!("capture notice emit failed: {err}");
        }
    }

    if let Err(err) = app.emit_to("main", CAPTURE_NOTICE_EVENT, notice) {
        eprintln!("capture emit failed: {err}");
    }

    // Keep a native fallback for users who prefer Notification Center.
    if let Err(err) = app
        .notification()
        .builder()
        .title("toudou")
        .body(CAPTURE_NOTIFICATION_BODY)
        .show()
    {
        eprintln!("capture notification failed: {err}");
    }
}

fn position_capture_notice(app: &AppHandle) {
    let Some(window) = app.get_webview_window(CAPTURE_NOTICE_WINDOW_LABEL) else {
        return;
    };

    let monitor = app
        .cursor_position()
        .ok()
        .and_then(|position| app.monitor_from_point(position.x, position.y).ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        return;
    };
    let Ok(window_size) = window.outer_size() else {
        return;
    };

    let work_area = monitor.work_area();
    let scale_factor = monitor.scale_factor();
    let horizontal_margin = (24.0 * scale_factor).round() as i32;
    let top_margin = (18.0 * scale_factor).round() as i32;
    let x = work_area.position.x + work_area.size.width as i32
        - window_size.width as i32
        - horizontal_margin;
    let y = work_area.position.y + top_margin;

    if let Err(err) = window.set_position(PhysicalPosition::new(x, y)) {
        eprintln!("capture notice positioning failed: {err}");
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
pub fn request_accessibility_permission() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        macos::request_accessibility_permission();
        return macos::permission_status();
    }
    #[cfg(not(target_os = "macos"))]
    {
        capture_permission_status()
    }
}

#[tauri::command]
#[specta::specta]
pub fn request_input_monitoring_permission() -> PermissionStatus {
    #[cfg(target_os = "macos")]
    {
        macos::request_input_monitoring_permission();
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
    show_capture_notice(&app, &notice);
    Ok(notice)
}
