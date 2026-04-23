/**
 * Type definitions for skin editor
 */

export type RegionType =
  | "terminal"
  | "agent-status"
  | "memory-context"
  | "activity-feed"
  | "decorative";

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

export interface EditorState {
  chromeImage: HTMLImageElement | null;
  chromePath: string | null;
  regions: Region[];
  selectedRegion: Region | null;
  hoveredRegion: Region | null;
  isDrawing: boolean;
  drawStart: { x: number; y: number } | null;
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
}
