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
        .invoke_handler(tauri::generate_handler![
            commands::create_pty_session,
            commands::write_to_pty,
            commands::resize_pty,
            commands::close_pty_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
