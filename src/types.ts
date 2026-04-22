/**
 * Type definitions for Terminai.
 */

/**
 * Region types supported by the renderer
 */
export type RegionType =
  | "terminal"
  | "agent-status"
  | "memory-context"
  | "activity-feed"
  | "decorative";

/**
 * Region definition - a functional zone within the skin
 */
export interface Region {
  /** Unique ID for this region */
  id: string;

  /** Type of region */
  type: RegionType;

  /** Position and size */
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Optional z-index for layering */
  zIndex?: number;
}

/**
 * SkinManifest defines the structure of a skin.
 * Day 5: Extended to support multiple functional regions.
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

    /** Shape definition (SVG path, CSS clip-path, or similar) - optional if using chromeImage alpha */
    shape?: string;

    /** Background styling - optional if using chromeImage */
    background?: string;

    /** Optional background image */
    backgroundImage?: string;

    /** Chrome image (PNG with alpha channel for shape) - for real WMP skins */
    chromeImage?: string;
  };

  /** Functional regions within the skin */
  regions: Region[];

  /** DEPRECATED: Legacy single terminal region - use regions array instead */
  terminalRegion?: {
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
