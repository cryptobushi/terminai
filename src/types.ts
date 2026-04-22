/**
 * Type definitions for Terminai.
 */

/**
 * SkinManifest defines the structure of a skin.
 * Even the placeholder skin satisfies this interface.
 *
 * This is the seam that allows skin swapping: loading a different skin
 * means swapping a SkinManifest object, not editing rendering logic.
 */
export interface SkinManifest {
  /** Unique identifier for the skin */
  id: string;

  /** Display name */
  name: string;

  /** Skin version */
  version: string;

  /** Visual rendering specification */
  visual: {
    /** Window dimensions */
    width: number;
    height: number;

    /** Shape definition (SVG path, CSS clip-path, or similar) */
    shape: string;

    /** Background styling */
    background: string;

    /** Optional background image */
    backgroundImage?: string;
  };

  /** Terminal viewport region within the skin */
  terminalRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Action button bindings (for future WMZ buttons) */
  actions: Array<{
    id: string;
    label: string;
    position: { x: number; y: number };
    // Handler will be bound later
  }>;
}

/**
 * IPC layer types - matches the Rust commands.rs contract
 */
export interface IPCCommands {
  create_pty_session(sessionId: string): Promise<void>;
  write_to_pty(sessionId: string, data: string): Promise<void>;
  resize_pty(sessionId: string, rows: number, cols: number): Promise<void>;
  close_pty_session(sessionId: string): Promise<void>;
}

/**
 * Typed error from Rust backend
 */
export interface TerminaiError {
  type:
    | "PtySpawnFailed"
    | "PtyWriteFailed"
    | "PtyReadFailed"
    | "SessionNotFound"
    | "InvalidInput"
    | "InternalError";
  message: string;
}
