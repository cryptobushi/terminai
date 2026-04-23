/**
 * Type definitions for skin editor
 */

export type RegionType =
  | "terminal"
  | "agent-status"
  | "memory-context"
  | "activity-feed"
  | "decorative"
  | "shape-overlay"
  | "image";

export type ShapeType = "rectangle" | "polygon";

export interface Region {
  id: string;
  type: RegionType;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zIndex?: number;
  visible?: boolean; // Layer visibility toggle
  locked?: boolean; // Layer lock state
  // Shape overlay properties
  shape?: {
    type: ShapeType;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
    // For polygons: array of points relative to rect.x, rect.y
    points?: Array<{ x: number; y: number }>;
  };
  // Image layer properties
  data?: {
    imageUrl?: string; // Base64 data URI or blob URL
    originalFileName?: string;
  };
}

export interface SkinManifest {
  id: string;
  name: string;
  version: string;
  visual: {
    width: number;
    height: number;
    chromeImage?: string;
  };
  regions: Region[];
  actions: Array<{
    id: string;
    label: string;
    position: { x: number; y: number };
  }>;
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;

export type DrawMode = "rectangle" | "polygon" | null;

export interface EditorState {
  chromeImage: HTMLImageElement | null;
  chromePath: string | null;
  regions: Region[];
  selectedRegion: Region | null;
  selectedRegions: Region[]; // Multi-select support
  hoveredRegion: Region | null;
  isDrawing: boolean;
  drawStart: { x: number; y: number } | null;
  drawMode: DrawMode;
  polygonPoints: Array<{ x: number; y: number }>;
  previewMode: boolean;
  snapToGrid: boolean;
  gridSize: number;
  isDragging: boolean;
  dragStart: { x: number; y: number } | null;
  dragOffset: { x: number; y: number } | null;
  isResizing: boolean;
  resizeHandle: ResizeHandle;
  resizeStart: { x: number; y: number } | null;
  history: Region[][];
  historyIndex: number;
  zoom: number; // Zoom level (1.0 = 100%)
  panX: number; // Pan offset X
  panY: number; // Pan offset Y
}
