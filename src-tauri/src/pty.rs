/// PTY session management for Terminai.
/// Handles spawning, reading, and writing to pseudo-terminal sessions.

use crate::errors::{Result, TerminaiError};
use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::io::Read;
use std::os::unix::io::AsRawFd;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// Commands that can be sent to the PTY session
enum PtyCommand {
    Write(Vec<u8>),
    Resize(u16, u16),
}

/// Represents a single PTY session
pub struct PtySession {
    pub id: String,
    command_tx: Sender<PtyCommand>,
    reader_thread: Option<std::thread::JoinHandle<()>>,
    writer_thread: Option<std::thread::JoinHandle<()>>,
    _master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

impl PtySession {
    /// Spawn a new PTY session with the given shell command
    pub fn spawn(id: String, app_handle: AppHandle) -> Result<Self> {
        log::info!("Spawning PTY session: {}", id);

        let pty_system = NativePtySystem::default();

        // Create PTY with initial size
        let mut pair = pty_system
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

        // Create channel for write/resize commands
        let (command_tx, command_rx) = channel::<PtyCommand>();

        // Spawn reader thread to emit output events
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| TerminaiError::PtyReadFailed(e.to_string()))?;

        let session_id = id.clone();
        let reader_thread = std::thread::spawn(move || {
            log::info!("Reader thread started for session {}", session_id);
            let mut buf = [0u8; 8192];
            loop {
                log::debug!("Reader thread waiting for data...");
                match reader.read(&mut buf) {
                    Ok(0) => {
                        log::info!("PTY session {} closed (EOF)", session_id);
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        // Truncate for logging using char boundaries, not byte boundaries
                        let preview = data.chars().take(50).collect::<String>();
                        log::info!("PTY output: {} bytes: {:?}", n, preview);
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
            log::info!("Reader thread exiting for session {}", session_id);
        });

        // Get raw FD for writing and resizing
        let fd = pair.master.as_raw_fd().expect("Failed to get PTY file descriptor");

        // Keep master alive in Arc for resize operations
        let master = Arc::new(Mutex::new(pair.master));
        let master_clone = master.clone();

        // Spawn writer thread to handle write/resize commands using raw FD
        let session_id_writer = id.clone();
        let writer_thread = std::thread::spawn(move || {
            use std::os::unix::io::FromRawFd;
            use std::fs::File;
            use std::io::Write;

            // Create a File from the raw FD for writing
            // SAFETY: We own this FD and it's valid for the lifetime of the PTY
            let mut writer = unsafe { File::from_raw_fd(fd) };

            while let Ok(cmd) = command_rx.recv() {
                match cmd {
                    PtyCommand::Write(data) => {
                        if let Err(e) = writer.write_all(&data) {
                            log::error!("PTY write error in session {}: {}", session_id_writer, e);
                            break;
                        }
                        if let Err(e) = writer.flush() {
                            log::error!("PTY flush error in session {}: {}", session_id_writer, e);
                            break;
                        }
                    }
                    PtyCommand::Resize(rows, cols) => {
                        log::info!("Resizing PTY {} to {}x{}", session_id_writer, cols, rows);
                        let master = master_clone.lock().unwrap();
                        if let Err(e) = master.resize(PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        }) {
                            log::error!("PTY resize error in session {}: {}", session_id_writer, e);
                        }
                    }
                }
            }

            // Don't close the FD - it's owned by pair.master
            std::mem::forget(writer);
            log::info!("Writer thread for session {} exiting", session_id_writer);
        });

        // Keep pair slave alive so the PTY doesn't close
        std::mem::forget(pair.slave);

        Ok(Self {
            id,
            command_tx,
            reader_thread: Some(reader_thread),
            writer_thread: Some(writer_thread),
            _master: master,
        })
    }

    /// Write data to the PTY
    pub fn write(&self, data: &str) -> Result<()> {
        self.command_tx
            .send(PtyCommand::Write(data.as_bytes().to_vec()))
            .map_err(|e| TerminaiError::PtyWriteFailed(e.to_string()))?;
        Ok(())
    }

    /// Resize the PTY
    pub fn resize(&self, rows: u16, cols: u16) -> Result<()> {
        self.command_tx
            .send(PtyCommand::Resize(rows, cols))
            .map_err(|e| TerminaiError::InternalError(format!("Resize failed: {}", e)))?;
        Ok(())
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        log::info!("Dropping PTY session: {}", self.id);
        // Dropping command_tx will cause the writer thread to exit
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

    /// Resize a PTY session
    pub fn resize_session(&self, session_id: &str, rows: u16, cols: u16) -> Result<()> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(session_id)
            .ok_or_else(|| TerminaiError::SessionNotFound(session_id.to_string()))?;

        let session = session.lock().unwrap();
        session.resize(rows, cols)
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
