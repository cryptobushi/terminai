/**
 * Preview mode renderers - simplified versions for skin editor preview
 */

import type { Region } from "../types";
import type { DataSource, ActivityEvent } from "./data-types";

export interface PreviewRenderer {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void;
}

// Agent Status Renderer
export const agentStatusRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
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

    const modelSpan = document.createElement("span");
    const skillSpan = document.createElement("span");
    const tokensSpan = document.createElement("span");

    skillSpan.style.fontStyle = "italic";
    skillSpan.style.color = "#66dd66";

    element.appendChild(modelSpan);
    element.appendChild(skillSpan);
    element.appendChild(tokensSpan);

    const update = () => {
      const status = dataSource.getAgentStatus();
      modelSpan.textContent = `${status.model}`;
      skillSpan.textContent = status.currentSkill || "idle";
      tokensSpan.textContent = `${status.tokensUsed.toLocaleString()} tok`;
    };

    update();
    const intervalId = setInterval(update, 1000);

    return () => {
      clearInterval(intervalId);
    };
  },
};

// Activity Feed Renderer
const EVENT_COLORS: Record<ActivityEvent["type"], string> = {
  "tool-call": "#ffaa44",
  "skill-load": "#44aaff",
  "memory-write": "#ff44aa",
  "task-complete": "#44ffaa",
  "message": "#aaaaaa",
};

export const activityFeedRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
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

      element.insertBefore(eventDiv, element.firstChild);

      while (element.children.length > 20) {
        element.removeChild(element.lastChild!);
      }
    };

    const unsubscribe = dataSource.subscribeToActivity(addEvent);

    return () => {
      unsubscribe();
    };
  },
};

// Memory Context Renderer
export const memoryContextRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
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

    render();
    const intervalId = setInterval(render, 30000);

    return () => {
      clearInterval(intervalId);
    };
  },
};

// Terminal Renderer (simplified - no actual terminal)
export const terminalRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
    element.style.cssText = `
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Monaco, "Courier New", monospace;
      font-size: 12px;
      color: #00ff00;
    `;

    element.innerHTML = `
      <div style="text-align: center; opacity: 0.5;">
        <div style="margin-bottom: 8px;">Terminal Display</div>
        <div style="font-size: 10px; color: #888;">
          (Live terminal in actual app)
        </div>
      </div>
    `;

    return () => {};
  },
};

// Decorative Renderer (no-op)
export const decorativeRenderer: PreviewRenderer = {
  mount(): () => void {
    return () => {};
  },
};

// Renderer registry
export const previewRenderers: Record<string, PreviewRenderer> = {
  "terminal": terminalRenderer,
  "agent-status": agentStatusRenderer,
  "activity-feed": activityFeedRenderer,
  "memory-context": memoryContextRenderer,
  "decorative": decorativeRenderer,
};
