/**
 * Terminai - Main application entry point
 *
 * Day 2: Fixed ANSI escape rendering, removed separate input field,
 * xterm.js now handles all terminal I/O
 */

import { placeholderSkin } from "./skins/placeholder";
import { TerminalSession } from "./terminal";
import type { SkinManifest } from "./types";
import "./style.css";

class TerminaiApp {
  private skin: SkinManifest;
  private terminal?: TerminalSession;

  constructor(skin: SkinManifest) {
    this.skin = skin;
  }

  /**
   * Initialize and render the application
   */
  async init(): Promise<void> {
    console.log("[Terminai] Initializing with skin:", this.skin.name);

    // Render the skin
    this.renderSkin();

    // Initialize terminal session
    const terminalContainer = document.getElementById(
      "terminal-container"
    ) as HTMLElement;

    if (!terminalContainer) {
      throw new Error("Terminal container not found");
    }

    // xterm.js will take over the container completely
    this.terminal = new TerminalSession("main", terminalContainer);
    await this.terminal.init();

    console.log("[Terminai] Ready");
  }

  /**
   * Render the skin visually
   */
  private renderSkin(): void {
    const app = document.getElementById("app") as HTMLElement;

    // Apply skin dimensions
    app.style.width = `${this.skin.visual.width}px`;
    app.style.height = `${this.skin.visual.height}px`;

    // For now, use rounded corners instead of clip-path for better transparency
    // TODO: Implement true shaped windows via Tauri APIs
    app.style.borderRadius = "40px";
    app.style.background = this.skin.visual.background;

    // Add shadow for better visibility
    app.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.3)";

    // Create terminal viewport region
    const terminalContainer = document.createElement("div");
    terminalContainer.id = "terminal-container";
    terminalContainer.style.position = "absolute";
    terminalContainer.style.left = `${this.skin.terminalRegion.x}px`;
    terminalContainer.style.top = `${this.skin.terminalRegion.y}px`;
    terminalContainer.style.width = `${this.skin.terminalRegion.width}px`;
    terminalContainer.style.height = `${this.skin.terminalRegion.height}px`;

    // Render action buttons (placeholder for now)
    this.skin.actions.forEach((action) => {
      const button = document.createElement("button");
      button.className = "action-button";
      button.textContent = action.label;
      button.style.position = "absolute";
      button.style.left = `${action.position.x}px`;
      button.style.top = `${action.position.y}px`;
      button.onclick = () => this.handleAction(action.id);
      app.appendChild(button);
    });

    app.appendChild(terminalContainer);
  }

  /**
   * Handle action button clicks
   */
  private handleAction(actionId: string): void {
    console.log(`[Action] ${actionId}`);
    // TODO: Implement action handlers
    // For now, just log
  }
}

// Initialize the app when DOM is ready
window.addEventListener("DOMContentLoaded", async () => {
  const app = new TerminaiApp(placeholderSkin);
  await app.init();
});
