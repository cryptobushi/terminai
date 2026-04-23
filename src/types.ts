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
  | "decorative"
  | "image"
  | "shape-overlay";

/**
 * Data structure for image regions
 */
export interface ImageRegionData {
  /** URL or data URI for the image to display */
  imageUrl: string;
}

/**
 * Data structure for shape overlay regions
 */
export interface ShapeData {
  type: "rectangle" | "circle" | "polygon";
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  points?: Array<{ x: number; y: number }>;
}

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

  /** Optional locked state (for editor) */
  locked?: boolean;

  /** Optional data for image regions, shape overlays, etc. */
  data?: ImageRegionData | ShapeData;

  /** Optional shape data for shape-overlay regions (alternative to data) */
  shape?: ShapeData;
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

    /** Z-index for chrome layer (defaults to 9999 if not specified) */
    chromeZIndex?: number;
  };

  /** Functional regions within the skin */
  regions: Region[];

  /** Action button bindings (for future WMZ buttons) */
  actions: Array<{
    id: string;
    label: string;
    position: { x: number; y: number };
    // Handler will be bound later
  }>;
}
