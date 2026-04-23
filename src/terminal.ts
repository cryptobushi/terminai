/**
 * Terminal manager - handles PTY session lifecycle and I/O using xterm.js
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export class TerminalSession {
  private sessionId: string;
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private unlisten?: () => void;
  private resizeObserver?: ResizeObserver;
  private baseFontSize: number = 14;

  constructor(sessionId: string, containerElement: HTMLElement, scale: number = 1.0) {
    this.sessionId = sessionId;

    // Calculate scaled font size - inversely scale to compensate for CSS transform scale
    // When scale is small (0.5), font should be 2x larger (14 / 0.5 = 28)
    // When scale is 1.0, font should be normal (14 / 1.0 = 14)
    const scaledFontSize = Math.max(6, Math.min(7, Math.floor(this.baseFontSize / scale)));

    // Create xterm.js terminal instance
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: scaledFontSize,
      fontFamily: '"SF Mono", Monaco, "Courier New", monospace',
      theme: {
        background: "#000000",
        foreground: "#00ff00",
      },
      allowProposedApi: true,
    });

    // Create fit addon for automatic sizing
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // Open terminal in the container
    this.terminal.open(containerElement);

    // Fit to container size
    this.fitAddon.fit();

    console.log("[Terminal] xterm.js opened in container");

    // Set up resize observer to reflow terminal when window resizes
    this.resizeObserver = new ResizeObserver(() => {
      try {
        this.fitAddon.fit();
        const dims = this.fitAddon.proposeDimensions();
        if (dims) {
          console.log(`[Terminal] Resizing PTY to ${dims.cols}x${dims.rows}`);
          // Fire and forget - don't await
          this.resize(dims.rows, dims.cols).catch((err) => {
            console.error("[Terminal] Resize failed:", err);
          });
        }
      } catch (err) {
        console.error("[Terminal] Resize observer error:", err);
      }
    });
    this.resizeObserver.observe(containerElement);
  }

  /**
   * Initialize the PTY session and start listening for output
   */
  async init(): Promise<void> {
    console.log(`[Terminal] Initializing session: ${this.sessionId}`);

    // Wire up terminal input to PTY
    this.terminal.onData((data) => {
      console.log(`[Terminal] onData: ${data.length} bytes`);
      this.write(data).catch((err) => {
        console.error("[Terminal] Write failed:", err);
      });
    });

    // CRITICAL: Listen for output events BEFORE creating PTY session
    // to avoid race condition where initial shell output is lost
    console.log(`[Terminal] Setting up listener for pty-output:${this.sessionId}`);
    this.unlisten = await listen<string>(
      `pty-output:${this.sessionId}`,
      (event) => {
        console.log(`[Terminal] Received output: ${event.payload.length} bytes`);
        this.handleOutput(event.payload);
      }
    );

    console.log("[Terminal] Creating PTY session...");

    // Create PTY session on backend
    await invoke("create_pty_session", { sessionId: this.sessionId });

    console.log("[Terminal] PTY session created");

    // Get initial terminal dimensions and resize PTY
    const dims = this.fitAddon.proposeDimensions();
    if (dims) {
      console.log(`[Terminal] Initial dimensions: ${dims.cols}x${dims.rows}`);
      await this.resize(dims.rows, dims.cols);
    } else {
      console.warn("[Terminal] Could not get dimensions, using default 24x80");
      await this.resize(24, 80);
    }

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
   * Update font size based on new scale factor
   */
  updateFontSize(scale: number): void {
    // Inversely scale to compensate for CSS transform scale
    const scaledFontSize = Math.max(6, Math.min(7, Math.floor(this.baseFontSize / scale)));
    this.terminal.options.fontSize = scaledFontSize;

    // Use setTimeout to ensure the font change is applied before fitting
    setTimeout(() => {
      this.fitAddon.fit();
      const dims = this.fitAddon.proposeDimensions();
      if (dims) {
        this.resize(dims.rows, dims.cols).catch((err) => {
          console.error("[Terminal] Resize after font change failed:", err);
        });
      }
    }, 0);
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.unlisten) {
      this.unlisten();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    await invoke("close_pty_session", { sessionId: this.sessionId });
    this.terminal.dispose();
  }

  /**
   * Handle output from PTY - write to xterm which will parse ANSI codes
   */
  private handleOutput(data: string): void {
    this.terminal.write(data);
  }
}
