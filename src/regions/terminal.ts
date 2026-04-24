/**
 * Terminal region renderer
 * Mounts the xterm.js terminal instance
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";
import { TerminalSession } from "../terminal";

// Global terminal session reference for resize updates
let globalTerminalSession: TerminalSession | null = null;

export function getTerminalSession(): TerminalSession | null {
  return globalTerminalSession;
}

/**
 * Detect if we're running in Tauri or browser environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Create a simple mock terminal display for browser preview
 */
function createMockTerminalDisplay(container: HTMLElement, scale: number = 1.0): void {
  // Calculate scaled font size - inversely scale to compensate for CSS transform
  const scaledFontSize = Math.max(6, Math.min(7, Math.floor(11 / scale)));

  // Style the container - DO NOT use cssText as it replaces position/size set by parent
  container.style.background = "#000000";
  container.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  container.style.borderRadius = "4px";
  container.style.overflow = "hidden";
  container.style.boxSizing = "border-box";
  container.style.padding = "8px";
  container.style.fontFamily = "'SF Mono', Monaco, 'Courier New', monospace";
  container.style.fontSize = `${scaledFontSize}px`;
  container.style.lineHeight = "1.4";
  container.style.color = "#00ff00";
  container.style.whiteSpace = "pre";

  // Simple fake terminal output
  container.textContent = `$ ls
Applications  Documents  Desktop
$ █`;
}

export const terminalRenderer: RegionRenderer = {
  mount(element: HTMLElement, _region: Region, _dataSource: DataSource, scale: number = 1.0): () => void {
    if (isTauriEnvironment()) {
      // Real terminal in Tauri
      // DO NOT use cssText as it replaces position/size set by parent
      element.style.background = "#000000";
      element.style.border = "1px solid rgba(255, 255, 255, 0.1)";
      element.style.borderRadius = "4px";
      element.style.overflow = "hidden";
      element.style.boxSizing = "border-box";

      // Reuse existing terminal session if available (for skin changes)
      if (globalTerminalSession) {
        console.log("[TerminalRenderer] Reusing existing terminal session");
        globalTerminalSession.reattachToContainer(element);

        return () => {
          // Don't close terminal on cleanup - it may be reused for skin changes
          // Only detach from container
          console.log("[TerminalRenderer] Detaching terminal (preserving session)");
          globalTerminalSession?.detachFromContainer();
        };
      } else {
        // Create new terminal session
        console.log("[TerminalRenderer] Creating new terminal session");
        const terminal = new TerminalSession("main", element, scale);
        globalTerminalSession = terminal; // Store global reference
        terminal.init();

        return () => {
          // This cleanup is called when the app is fully destroyed
          console.log("[TerminalRenderer] Closing terminal session");
          terminal.close();
          globalTerminalSession = null;
        };
      }
    } else {
      // Simple styled div in browser
      createMockTerminalDisplay(element, scale);
      return () => {
        // No cleanup needed for static div
      };
    }
  },
};
