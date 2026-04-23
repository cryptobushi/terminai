/**
 * Activity Feed region renderer
 * Shows live stream of agent events, newest at top
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource, ActivityEvent } from "../data/types";

const EVENT_COLORS: Record<ActivityEvent["type"], string> = {
  "tool-call": "#ffaa44",
  "skill-load": "#44aaff",
  "memory-write": "#ff44aa",
  "task-complete": "#44ffaa",
  "message": "#aaaaaa",
};

export const activityFeedRenderer: RegionRenderer = {
  mount(element: HTMLElement, _region: Region, dataSource: DataSource, _scale?: number): () => void {
    // Apply base styling
    element.style.cssText = `
      display: flex;
      flex-direction: column-reverse;
      padding: 6px;
      font-family: Monaco, "Courier New", monospace;
      font-size: 9px;
      color: #cccccc;
      background: rgba(0, 0, 0, 0.6);
      overflow-y: auto;
      overflow-x: hidden;
      gap: 3px;
    `;

    // Add subtle scrollbar styling
    element.style.cssText += `
      scrollbar-width: thin;
      scrollbar-color: rgba(136, 255, 136, 0.3) transparent;
    `;

    const addEvent = (event: ActivityEvent) => {
      const eventDiv = document.createElement("div");
      eventDiv.style.cssText = `
        padding: 2px 4px;
        background: rgba(0, 0, 0, 0.3);
        border-left: 2px solid ${EVENT_COLORS[event.type]};
        font-size: 8px;
        line-height: 1.3;
        animation: fadeIn 0.3s ease-out;
      `;

      const timeStr = event.timestamp.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      eventDiv.innerHTML = `
        <span style="color: #666; font-size: 7px;">${timeStr}</span>
        <span style="color: ${EVENT_COLORS[event.type]}; margin-left: 4px;">${event.message}</span>
      `;

      // Add to top (because we're column-reverse)
      element.insertBefore(eventDiv, element.firstChild);

      // Limit to 20 events
      while (element.children.length > 20) {
        element.removeChild(element.lastChild!);
      }

      // Trigger animation on parent element (for speaker pulse)
      element.dispatchEvent(new CustomEvent("activity"));
    };

    // Subscribe to activity events
    const unsubscribe = dataSource.subscribeToActivity(addEvent);

    // Cleanup function
    return () => {
      unsubscribe();
    };
  },
};
