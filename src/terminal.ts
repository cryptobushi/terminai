/**
 * Terminal manager - handles PTY session lifecycle and I/O
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export class TerminalSession {
  private sessionId: string;
  private outputElement: HTMLElement;
  private unlisten?: () => void;

  constructor(sessionId: string, outputElement: HTMLElement) {
    this.sessionId = sessionId;
    this.outputElement = outputElement;
  }

  /**
   * Initialize the PTY session and start listening for output
   */
  async init(): Promise<void> {
    console.log(`[Terminal] Initializing session: ${this.sessionId}`);

    // Create PTY session on backend
    await invoke("create_pty_session", { sessionId: this.sessionId });

    // Listen for output events
    this.unlisten = await listen<string>(
      `pty-output:${this.sessionId}`,
      (event) => {
        this.handleOutput(event.payload);
      }
    );

    console.log(`[Terminal] Session initialized: ${this.sessionId}`);
  }

  /**
   * Write input to the PTY
   */
  async write(data: string): Promise<void> {
    await invoke("write_to_pty", {
      sessionId: this.sessionId,
      data,
    });
  }

  /**
   * Resize the PTY
   */
  async resize(rows: number, cols: number): Promise<void> {
    await invoke("resize_pty", {
      sessionId: this.sessionId,
      rows,
      cols,
    });
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.unlisten) {
      this.unlisten();
    }
    await invoke("close_pty_session", { sessionId: this.sessionId });
  }

  /**
   * Handle output from PTY
   */
  private handleOutput(data: string): void {
    // Simple output rendering - just append text
    // In a production app, this would use a proper terminal emulator like xterm.js
    const span = document.createElement("span");
    span.textContent = data;
    this.outputElement.appendChild(span);

    // Auto-scroll to bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }
}
