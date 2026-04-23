/**
 * DOM manipulation utility functions
 */

import type { Region } from "../types";

/**
 * Position and size a container element based on region rect and scale factor
 *
 * @param container - HTMLElement to position
 * @param region - Region definition with rect coordinates
 * @param scale - Scale factor to apply (default 1.0)
 */
export function positionRegionContainer(
  container: HTMLElement,
  region: Region,
  scale: number = 1.0
): void {
  container.style.left = `${region.rect.x * scale}px`;
  container.style.top = `${region.rect.y * scale}px`;
  container.style.width = `${region.rect.width * scale}px`;
  container.style.height = `${region.rect.height * scale}px`;
}

/**
 * Apply common styles for scrollbars (consistent terminal theme)
 *
 * @param element - Element to apply scrollbar styling to
 */
export function applyScrollbarStyling(element: HTMLElement): void {
  element.style.cssText += `
    scrollbar-width: thin;
    scrollbar-color: rgba(136, 255, 136, 0.3) transparent;
  `;
}
