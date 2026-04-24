/**
 * Type definitions for skin editor
 * Extends base types from main app with editor-specific properties
 */

import type { RegionType as BaseRegionType, Region as BaseRegion, SkinManifest as BaseSkinManifest } from "@terminai/types";

// Extend RegionType with editor-specific region types
export type RegionType = BaseRegionType | "shape-overlay" | "image";

export type ShapeType = "rectangle" | "polygon";

// Extend Region interface with editor-specific properties
export interface Region extends Omit<BaseRegion, 'type' | 'data'> {
  type: RegionType; // Use extended type
  visible?: boolean; // Layer visibility toggle
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
  // Image layer properties (extends base data field)
  data?: {
    imageUrl?: string; // Base64 data URI or blob URL
    originalFileName?: string;
  };
}

// Editor uses a simplified SkinManifest (keeping separate for now)
export interface SkinManifest {
  id: string;
  name: string;
  version: string;
  visual: {
    width: number;
    height: number;
    chromeImage?: string;
    chromeZIndex?: number;
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
  chromeZIndex: number;
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
