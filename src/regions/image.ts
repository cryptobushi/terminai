/**
 * Image region renderer
 * Displays a bitmap image (for WMZ layer support)
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";

export const imageRenderer: RegionRenderer = {
  mount(element: HTMLElement, region: Region, _dataSource: DataSource, _scale?: number): () => void {
    // Style the container
    element.style.background = "transparent";
    element.style.overflow = "hidden";
    element.style.boxSizing = "border-box";

    // Create img element
    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.display = "block";

    // Set image source from region data
    if (region.data && 'imageUrl' in region.data) {
      img.src = region.data.imageUrl;
    }

    element.appendChild(img);

    // Cleanup function
    return () => {
      img.remove();
    };
  },
};
