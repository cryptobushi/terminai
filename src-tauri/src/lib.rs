// Terminai - A visual identity layer for AI agents
//
// Architecture:
// - Backend (Rust): Owns process state (PTY sessions)
// - Frontend (TypeScript): Owns render state only
// - IPC: Tauri commands for request/response, events for streams
// - See commands.rs for the complete IPC contract

mod commands;
mod errors;
mod pty;
mod state;

use state::AppState;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    log::info!("Starting Terminai");

    // Initialize application state
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            use tauri::menu::*;

            // Build native menu using Tauri v2 API
            let import_item = MenuItemBuilder::with_id("import_skin", "Import Skin Bundle...")
                .accelerator("Cmd+O")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .copy()
                .paste()
                .separator()
                .item(&import_item)
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;

            // Set up menu event handler
            app.on_menu_event(|app, event| {
                if event.id().as_ref() == "import_skin" {
                    // Emit event to frontend to trigger file picker
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("import-skin-requested", ());
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_pty_session,
            commands::write_to_pty,
            commands::resize_pty,
            commands::close_pty_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
