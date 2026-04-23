/**
 * Agent Status region renderer
 * Shows model, current skill, token count in a compact horizontal line
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";

export const agentStatusRenderer: RegionRenderer = {
  mount(element: HTMLElement, _region: Region, dataSource: DataSource, _scale?: number): () => void {
    // Apply base styling
    element.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 4px 8px;
      font-family: Monaco, "Courier New", monospace;
      font-size: 9px;
      color: #88ff88;
      background: rgba(0, 20, 0, 0.7);
      border-top: 1px solid rgba(136, 255, 136, 0.3);
      text-shadow: 0 0 3px rgba(136, 255, 136, 0.5);
      overflow: hidden;
      white-space: nowrap;
    `;

    // Create status elements
    const modelSpan = document.createElement("span");
    const skillSpan = document.createElement("span");
    const tokensSpan = document.createElement("span");

    skillSpan.style.fontStyle = "italic";
    skillSpan.style.color = "#66dd66";

    element.appendChild(modelSpan);
    element.appendChild(skillSpan);
    element.appendChild(tokensSpan);

    // Update function
    const update = () => {
      const status = dataSource.getAgentStatus();
      modelSpan.textContent = `${status.model}`;
      skillSpan.textContent = status.currentSkill || "idle";
      tokensSpan.textContent = `${status.tokensUsed.toLocaleString()} tok`;
    };

    // Initial render
    update();

    // Update every second
    const intervalId = setInterval(update, 1000);

    // Cleanup function
    return () => {
      clearInterval(intervalId);
    };
  },
};
