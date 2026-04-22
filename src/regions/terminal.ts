/**
 * Terminal region renderer
 * Mounts the xterm.js terminal instance
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";
import { TerminalSession } from "../terminal";

/**
 * Detect if we're running in Tauri or browser environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Create a simple mock terminal display for browser preview
 */
function createMockTerminalDisplay(container: HTMLElement): void {
  // Style the container - DO NOT use cssText as it replaces position/size set by parent
  container.style.background = "#000000";
  container.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  container.style.borderRadius = "4px";
  container.style.overflow = "hidden";
  container.style.boxSizing = "border-box";
  container.style.padding = "8px";
  container.style.fontFamily = "'SF Mono', Monaco, 'Courier New', monospace";
  container.style.fontSize = "11px";
  container.style.lineHeight = "1.4";
  container.style.color = "#00ff00";
  container.style.whiteSpace = "pre";

  // Simple fake terminal output
  container.textContent = `$ ls
Applications  Documents  Desktop
$ █`;
}

export const terminalRenderer: RegionRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
    if (isTauriEnvironment()) {
      // Real terminal in Tauri
      element.style.cssText = `
        background: #000000;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        box-sizing: border-box;
      `;

      const terminal = new TerminalSession("main", element);
      terminal.init();

      return () => {
        terminal.close();
      };
    } else {
      // Simple styled div in browser
      createMockTerminalDisplay(element);
      return () => {
        // No cleanup needed for static div
      };
    }
  },
};
