/**
 * Terminal region renderer
 * Mounts the xterm.js terminal instance
 */

import type { RegionRenderer } from "./types";
import type { Region } from "../types";
import type { DataSource } from "../data/types";
import { TerminalSession } from "../terminal";

export const terminalRenderer: RegionRenderer = {
  mount(element: HTMLElement, region: Region, dataSource: DataSource): () => void {
    // Style the container
    element.style.cssText = `
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    `;

    // Create terminal session
    const terminal = new TerminalSession("main", element);
    terminal.init();

    // Cleanup function
    return () => {
      terminal.close();
    };
  },
};
