/// PTY session management for Terminai.
/// Handles spawning, reading, and writing to pseudo-terminal sessions.

use crate::errors::{Result, TerminaiError};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::Read;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::os::unix::io::AsRawFd;
use tauri::{AppHandle, Emitter};

/// Represents a single PTY session
pub struct PtySession {
    pub id: String,
    write_tx: Sender<Vec<u8>>,
    reader_thread: Option<std::thread::JoinHandle<()>>,
    writer_thread: Option<std::thread::JoinHandle<()>>,
}

impl PtySession {
    /// Spawn a new PTY session with the given shell command
    pub fn spawn(id: String, app_handle: AppHandle) -> Result<Self> {
        log::info!("Spawning PTY session: {}", id);

        let pty_system = NativePtySystem::default();

        // Create PTY with initial size
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| TerminaiError::PtySpawnFailed(e.to_string()))?;

        // Spawn the shell (zsh on macOS)
        let mut cmd = CommandBuilder::new("zsh");
        cmd.env("TERM", "xterm-256color");

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| TerminaiError::PtySpawnFailed(e.to_string()))?;

        // Create channel for write requests
        let (write_tx, write_rx) = channel::<Vec<u8>>();

        // Spawn reader thread to emit output events
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| TerminaiError::PtyReadFailed(e.to_string()))?;

        let session_id = id.clone();
        let reader_thread = std::thread::spawn(move || {
            let mut buf = [0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        log::info!("PTY session {} closed", session_id);
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        if let Err(e) = app_handle.emit(&format!("pty-output:{}", session_id), data) {
                            log::error!("Failed to emit pty output: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("PTY read error: {}", e);
                        break;
                    }
                }
            }
        });

        // Get raw FD for writing
        let fd = pair.master.as_raw_fd().expect("Failed to get PTY file descriptor");

        // Spawn writer thread to handle write requests using raw FD
        let session_id_writer = id.clone();
        let writer_thread = std::thread::spawn(move || {
            use std::os::unix::io::FromRawFd;
            use std::fs::File;
            use std::io::Write;

            // Create a File from the raw FD for writing
            // SAFETY: We own this FD and it's valid for the lifetime of the PTY
            let mut writer = unsafe { File::from_raw_fd(fd) };

            while let Ok(data) = write_rx.recv() {
                if let Err(e) = writer.write_all(&data) {
                    log::error!("PTY write error in session {}: {}", session_id_writer, e);
                    break;
                }
                if let Err(e) = writer.flush() {
                    log::error!("PTY flush error in session {}: {}", session_id_writer, e);
                    break;
                }
            }

            //  Don't close the FD - it's owned by pair.master
            std::mem::forget(writer);
            log::info!("Writer thread for session {} exiting", session_id_writer);
        });

        // Keep pair alive so the PTY doesn't close
        std::mem::forget(pair);

        Ok(Self {
            id,
            write_tx,
            reader_thread: Some(reader_thread),
            writer_thread: Some(writer_thread),
        })
    }

    /// Write data to the PTY
    pub fn write(&self, data: &str) -> Result<()> {
        self.write_tx
            .send(data.as_bytes().to_vec())
            .map_err(|e| TerminaiError::PtyWriteFailed(e.to_string()))?;
        Ok(())
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        log::info!("Dropping PTY session: {}", self.id);
        // Dropping write_tx will cause the writer thread to exit
        // Reader thread will exit when the PTY closes
    }
}

/// Global PTY session manager
pub struct PtyManager {
    sessions: Arc<Mutex<std::collections::HashMap<String, Arc<Mutex<PtySession>>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }

    /// Create a new PTY session
    pub fn create_session(&self, session_id: String, app_handle: AppHandle) -> Result<()> {
        let session = PtySession::spawn(session_id.clone(), app_handle)?;
        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id, Arc::new(Mutex::new(session)));
        Ok(())
    }

    /// Write to a PTY session
    pub fn write_to_session(&self, session_id: &str, data: &str) -> Result<()> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| TerminaiError::SessionNotFound(session_id.to_string()))?;

        let session = session.lock().unwrap();
        session.write(data)
    }

    /// Resize a PTY session (removed for now - requires different architecture)
    pub fn resize_session(&self, _session_id: &str, _rows: u16, _cols: u16) -> Result<()> {
        // TODO: Implement resize with a resize channel
        log::warn!("PTY resize not yet implemented");
        Ok(())
    }

    /// Close a PTY session
    pub fn close_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions
            .remove(session_id)
            .ok_or_else(|| TerminaiError::SessionNotFound(session_id.to_string()))?;
        Ok(())
    }
}
