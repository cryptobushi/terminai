/**
 * Region renderer registry - plugin-style dispatch system
 */

import type { RegionType } from "../types";
import type { RegionRenderer } from "./types";

class RegionRendererRegistry {
  private renderers = new Map<RegionType, RegionRenderer>();

  /**
   * Register a renderer for a region type
   */
  register(type: RegionType, renderer: RegionRenderer): void {
    this.renderers.set(type, renderer);
  }

  /**
   * Get the renderer for a region type
   */
  get(type: RegionType): RegionRenderer | undefined {
    return this.renderers.get(type);
  }

  /**
   * Check if a renderer exists for a region type
   */
  has(type: RegionType): boolean {
    return this.renderers.has(type);
  }
}

// Global singleton registry
export const regionRegistry = new RegionRendererRegistry();
