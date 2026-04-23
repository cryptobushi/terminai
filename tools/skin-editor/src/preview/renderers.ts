/**
 * Preview mode renderers - simplified versions for skin editor preview
 */

import type { Region } from "../types";
import type { DataSource, ActivityEvent } from "@terminai/data/types";

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

// Terminal Renderer (simplified - just black fill)
export const terminalRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
    element.style.cssText = `
      background: #000000;
      overflow: hidden;
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

// Shape Overlay Renderer - renders visual shapes in preview mode
export const shapeOverlayRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region): () => void {
    if (!region.shape) {
      return () => {};
    }

    const shape = region.shape;
    const fillColor = shape.fillColor || "#ff0000";
    const strokeColor = shape.strokeColor || "#000000";
    const strokeWidth = shape.strokeWidth || 2;
    const opacity = shape.opacity !== undefined ? shape.opacity : 0.5;

    if (shape.type === "rectangle") {
      // Rectangle shape
      element.style.cssText = `
        background: ${fillColor};
        border: ${strokeWidth}px solid ${strokeColor};
        opacity: ${opacity};
        box-sizing: border-box;
      `;
    } else if (shape.type === "polygon" && shape.points && shape.points.length > 0) {
      // Polygon shape using SVG
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const points = shape.points.map(p => `${p.x},${p.y}`).join(" ");
      polygon.setAttribute("points", points);
      polygon.setAttribute("fill", fillColor);
      polygon.setAttribute("stroke", strokeColor);
      polygon.setAttribute("stroke-width", strokeWidth.toString());
      polygon.setAttribute("opacity", opacity.toString());

      svg.appendChild(polygon);
      element.appendChild(svg);
    }

    return () => {};
  },
};

// Image Renderer - renders uploaded images in preview mode
export const imageRenderer: PreviewRenderer = {
  mount(element: HTMLElement, region: Region): () => void {
    if (!region.data?.imageUrl) {
      return () => {};
    }

    const img = document.createElement("img");
    img.src = region.data.imageUrl;
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
    `;

    element.appendChild(img);

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
  "shape-overlay": shapeOverlayRenderer,
  "image": imageRenderer,
};
