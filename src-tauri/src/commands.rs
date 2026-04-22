/// Tauri command handlers for the IPC layer.
///
/// ## IPC Contract
///
/// ### Commands (Request/Response):
/// - `create_pty_session(session_id: String)` -> Result<()>
///   Creates a new PTY session with the given ID.
///
/// - `write_to_pty(session_id: String, data: String)` -> Result<()>
///   Writes data to the specified PTY session.
///
/// - `resize_pty(session_id: String, rows: u16, cols: u16)` -> Result<()>
///   Resizes the specified PTY session.
///
/// - `close_pty_session(session_id: String)` -> Result<()>
///   Closes the specified PTY session.
///
/// ### Events (Streams):
/// - `pty-output:{session_id}` - Emitted when PTY produces output
///   Payload: String (terminal output data)

use crate::errors::Result;
use crate::state::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn create_pty_session(
    session_id: String,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    log::info!("Command: create_pty_session({})", session_id);
    state.pty_manager.create_session(session_id, app_handle)
}

#[tauri::command]
pub fn write_to_pty(session_id: String, data: String, state: State<'_, AppState>) -> Result<()> {
    log::debug!("Command: write_to_pty({}, {} bytes)", session_id, data.len());
    state.pty_manager.write_to_session(&session_id, &data)
}

#[tauri::command]
pub fn resize_pty(
    session_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, AppState>,
) -> Result<()> {
    log::info!("Command: resize_pty({}, {}x{})", session_id, rows, cols);
    state.pty_manager.resize_session(&session_id, rows, cols)
}

#[tauri::command]
pub fn close_pty_session(session_id: String, state: State<'_, AppState>) -> Result<()> {
    log::info!("Command: close_pty_session({})", session_id);
    state.pty_manager.close_session(&session_id)
}
