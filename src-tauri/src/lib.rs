mod capture;
mod db;

use db::Db;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    capture::shortcut_handler(app, event.state);
                })
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
            let db_path = data_dir.join("towdow.sqlite3");
            let conn = db::open(&db_path)?;
            app.manage(Db(std::sync::Mutex::new(conn)));

            let show = MenuItem::with_id(app, "show", "Show Towdow", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Towdow")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            capture::start(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            db_commands::list_captures,
            db_commands::create_capture,
            db_commands::update_capture_body,
            db_commands::set_capture_done,
            db_commands::purge_expired_done,
            db_commands::seed_demo_captures,
            capture::capture_now,
            capture::capture_permission_status,
            capture::request_capture_permissions,
            capture::ingest_capture
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let RunEvent::ExitRequested { api, code, .. } = &event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}

mod db_commands {
    use crate::db::{self, Capture, Db, NewCapture};

    #[tauri::command]
    pub fn list_captures(state: tauri::State<'_, Db>) -> Result<Vec<Capture>, String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::list_captures(&conn)
    }

    #[tauri::command]
    pub fn create_capture(
        state: tauri::State<'_, Db>,
        capture: NewCapture,
    ) -> Result<Capture, String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::create_capture(&conn, &capture)
    }

    #[tauri::command]
    pub fn update_capture_body(
        state: tauri::State<'_, Db>,
        id: String,
        body: String,
    ) -> Result<(), String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::update_body(&conn, &id, &body)
    }

    #[tauri::command]
    pub fn set_capture_done(
        state: tauri::State<'_, Db>,
        id: String,
        done: bool,
        done_at: Option<i64>,
    ) -> Result<(), String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::set_done(&conn, &id, done, done_at)
    }

    #[tauri::command]
    pub fn purge_expired_done(
        state: tauri::State<'_, Db>,
        cutoff_ms: i64,
    ) -> Result<usize, String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::purge_done_before(&conn, cutoff_ms)
    }

    #[tauri::command]
    pub fn seed_demo_captures(
        state: tauri::State<'_, Db>,
        seed: Vec<NewCapture>,
    ) -> Result<bool, String> {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        db::seed_if_empty(&conn, &seed)
    }
}
