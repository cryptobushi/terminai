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
  private resizeTimeout?: number;
  private isResizing: boolean = false;

  constructor(sessionId: string, containerElement: HTMLElement, _scale: number = 1.0) {
    this.sessionId = sessionId;

    // Terminal is outside scaled wrapper, so use base font size for crisp 1:1 rendering
    const scaledFontSize = this.baseFontSize;

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

    // Set up resize observer with debouncing to prevent artifacts
    this.setupResizeObserver(containerElement);
  }

  /**
   * Set up debounced resize observer to prevent text artifacts
   */
  private setupResizeObserver(container: HTMLElement): void {
    // Clean up existing observer if any
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(() => {
      // Debounce resize operations to prevent artifacts and race conditions
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }

      this.resizeTimeout = window.setTimeout(() => {
        this.performResize();
      }, 100); // 100ms debounce - balances responsiveness with stability
    });

    this.resizeObserver.observe(container);
    console.log("[Terminal] ResizeObserver set up with debouncing");
  }

  /**
   * Perform the actual resize operation with defensive checks
   */
  private performResize(): void {
    // Prevent concurrent resize operations
    if (this.isResizing) {
      console.log("[Terminal] Skipping resize - already in progress");
      return;
    }

    try {
      this.isResizing = true;

      // Use requestAnimationFrame to ensure layout is stable
      requestAnimationFrame(() => {
        try {
          this.fitAddon.fit();
          const dims = this.fitAddon.proposeDimensions();

          if (dims && dims.cols > 0 && dims.rows > 0) {
            console.log(`[Terminal] Resizing PTY to ${dims.cols}x${dims.rows}`);
            // Fire and forget - don't await
            this.resize(dims.rows, dims.cols).catch((err) => {
              console.error("[Terminal] Resize failed:", err);
            });
          } else {
            console.warn("[Terminal] Invalid dimensions, skipping resize");
          }
        } finally {
          this.isResizing = false;
        }
      });
    } catch (err) {
      console.error("[Terminal] Resize error:", err);
      this.isResizing = false;
    }
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
   * Terminal is outside wrapper, font stays constant, just refit
   */
  updateFontSize(_scale: number): void {
    // No font size change needed - terminal renders at 1:1 pixels
    // Just refit to the new container dimensions
    setTimeout(() => {
      this.performResize();
    }, 0);
  }

  /**
   * Reattach terminal to a new container (for skin changes)
   * Preserves the terminal session and history
   */
  reattachToContainer(newContainer: HTMLElement): void {
    console.log("[Terminal] Reattaching terminal to new container");

    // Disconnect old resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Clear any pending resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = undefined;
    }

    // Detach from old container by getting the terminal element
    const terminalElement = this.terminal.element;
    if (terminalElement && terminalElement.parentElement) {
      terminalElement.parentElement.removeChild(terminalElement);
    }

    // Clear the container and attach terminal
    newContainer.innerHTML = "";
    newContainer.appendChild(this.terminal.element!);

    // Set up resize observer on new container
    this.setupResizeObserver(newContainer);

    // Trigger a resize to fit the new container
    setTimeout(() => {
      this.performResize();
    }, 50);

    console.log("[Terminal] Terminal reattached successfully");
  }

  /**
   * Detach from current container (for cleanup without destroying session)
   */
  detachFromContainer(): void {
    console.log("[Terminal] Detaching terminal from container");

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Clear any pending resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = undefined;
    }
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    console.log("[Terminal] Closing session");

    // Clear any pending timeouts
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = undefined;
    }

    // Stop listening for output
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = undefined;
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Close PTY session
    try {
      await invoke("close_pty_session", { sessionId: this.sessionId });
    } catch (err) {
      console.error("[Terminal] Failed to close PTY session:", err);
    }

    // Dispose terminal
    this.terminal.dispose();
    console.log("[Terminal] Session closed");
  }

  /**
   * Handle output from PTY - write to xterm which will parse ANSI codes
   */
  private handleOutput(data: string): void {
    this.terminal.write(data);
  }
}
