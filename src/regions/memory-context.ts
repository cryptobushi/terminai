/**
 * Memory Context region renderer
 * Shows recent memory fragments as scrolling list
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";

export const memoryContextRenderer: RegionRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
    // Apply base styling
    element.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 8px 6px;
      font-family: Monaco, "Courier New", monospace;
      font-size: 8px;
      color: #aaffaa;
      background: rgba(0, 30, 0, 0.5);
      overflow-y: auto;
      overflow-x: hidden;
      gap: 6px;
      line-height: 1.4;
    `;

    // Add subtle scrollbar styling
    element.style.cssText += `
      scrollbar-width: thin;
      scrollbar-color: rgba(136, 255, 136, 0.3) transparent;
    `;

    const render = () => {
      element.innerHTML = "";

      const memories = dataSource.getMemoryFragments(12);

      memories.forEach((memory) => {
        const memDiv = document.createElement("div");
        memDiv.style.cssText = `
          padding: 3px 4px;
          background: rgba(0, 0, 0, 0.3);
          border-left: 1px solid rgba(136, 255, 136, 0.4);
          font-size: 8px;
        `;

        const timeAgo = Math.floor((Date.now() - memory.timestamp.getTime()) / 60000);
        const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;

        memDiv.innerHTML = `
          <div style="color: #667766; font-size: 7px; margin-bottom: 2px;">${timeStr}</div>
          <div style="color: #aaffaa;">${memory.content}</div>
        `;

        element.appendChild(memDiv);
      });
    };

    // Initial render
    render();

    // Update every 30 seconds
    const intervalId = setInterval(render, 30000);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
    };
  },
};
