/// Typed error enums for the Terminai backend.
/// All errors returned to the frontend go through these types.

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum TerminaiError {
    PtySpawnFailed(String),
    PtyWriteFailed(String),
    PtyReadFailed(String),
    SessionNotFound(String),
    InvalidInput(String),
    InternalError(String),
}

impl std::fmt::Display for TerminaiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TerminaiError::PtySpawnFailed(msg) => write!(f, "PTY spawn failed: {}", msg),
            TerminaiError::PtyWriteFailed(msg) => write!(f, "PTY write failed: {}", msg),
            TerminaiError::PtyReadFailed(msg) => write!(f, "PTY read failed: {}", msg),
            TerminaiError::SessionNotFound(msg) => write!(f, "Session not found: {}", msg),
            TerminaiError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            TerminaiError::InternalError(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for TerminaiError {}

/// Convert anyhow errors to TerminaiError
impl From<anyhow::Error> for TerminaiError {
    fn from(err: anyhow::Error) -> Self {
        TerminaiError::InternalError(err.to_string())
    }
}

/// Result type alias for Terminai operations
pub type Result<T> = std::result::Result<T, TerminaiError>;
