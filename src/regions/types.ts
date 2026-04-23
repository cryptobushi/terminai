/**
 * Region renderer system types
 */

import type { Region } from "../types";
import type { DataSource } from "../data/types";

/**
 * Region renderer interface
 * Each region type implements this to mount/unmount its content
 */
export interface RegionRenderer {
  /**
   * Mount the region content into the given DOM element
   * @param element - DOM element to mount into
   * @param region - Region configuration
   * @param dataSource - Data source for agent state
   * @param scale - Current UI scale factor (for responsive text sizing)
   * @returns Cleanup function to call on unmount
   */
  mount(
    element: HTMLElement,
    region: Region,
    dataSource: DataSource,
    scale?: number
  ): () => void;
}
