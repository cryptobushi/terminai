/// Application state management.
/// Backend owns process state (pty sessions).

use crate::pty::PtyManager;

/// Global application state
pub struct AppState {
    pub pty_manager: PtyManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pty_manager: PtyManager::new(),
        }
    }
}
