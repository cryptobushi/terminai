/**
 * Terminai - Main application entry point
 *
 * Day 1 goal: Working plumbing with transparent frameless window,
 * real shell (zsh), and hardcoded placeholder skin.
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
    const terminalOutput = document.getElementById(
      "terminal-output"
    ) as HTMLElement;
    const terminalInput = document.getElementById(
      "terminal-input"
    ) as HTMLInputElement;

    if (!terminalOutput || !terminalInput) {
      throw new Error("Terminal elements not found");
    }

    this.terminal = new TerminalSession("main", terminalOutput);
    await this.terminal.init();

    // Set up input handling
    this.setupInputHandling(terminalInput);

    console.log("[Terminai] Ready");
  }

  /**
   * Render the skin visually
   */
  private renderSkin(): void {
    const app = document.getElementById("app") as HTMLElement;

    // Apply skin dimensions and shape
    app.style.width = `${this.skin.visual.width}px`;
    app.style.height = `${this.skin.visual.height}px`;
    app.style.clipPath = this.skin.visual.shape;
    app.style.background = this.skin.visual.background;

    // Create terminal viewport region
    const terminalContainer = document.createElement("div");
    terminalContainer.id = "terminal-container";
    terminalContainer.style.position = "absolute";
    terminalContainer.style.left = `${this.skin.terminalRegion.x}px`;
    terminalContainer.style.top = `${this.skin.terminalRegion.y}px`;
    terminalContainer.style.width = `${this.skin.terminalRegion.width}px`;
    terminalContainer.style.height = `${this.skin.terminalRegion.height}px`;

    // Terminal output area
    const terminalOutput = document.createElement("div");
    terminalOutput.id = "terminal-output";
    terminalContainer.appendChild(terminalOutput);

    // Terminal input area
    const terminalInput = document.createElement("input");
    terminalInput.id = "terminal-input";
    terminalInput.type = "text";
    terminalInput.placeholder = "Type commands here...";
    terminalContainer.appendChild(terminalInput);

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
   * Set up terminal input handling
   */
  private setupInputHandling(input: HTMLInputElement): void {
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const command = input.value;
        if (command && this.terminal) {
          // Write command + newline to PTY
          await this.terminal.write(command + "\n");
          input.value = "";
        }
      } else if (e.key === "Backspace" || e.key === "Delete") {
        // Let the input element handle these naturally
        return;
      }
    });

    // Focus input by default
    input.focus();
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
