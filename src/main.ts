/**
 * Terminai - Main application entry point
 *
 * Day 5: Multi-region rendering with plugin-style dispatch
 */

import { headspaceSkin } from "./skins/headspace";
import type { SkinManifest } from "./types";
import { registerBuiltInRenderers, regionRegistry } from "./regions";
import { StubHermesDataSource } from "./data/stub-hermes";
import type { DataSource } from "./data/types";
import "./style.css";

class TerminaiApp {
  private skin: SkinManifest;
  private dataSource: DataSource;
  private regionCleanups: Array<() => void> = [];

  constructor(skin: SkinManifest) {
    this.skin = skin;
    this.dataSource = new StubHermesDataSource();
  }

  /**
   * Initialize and render the application
   */
  async init(): Promise<void> {
    console.log("[Terminai] Initializing with skin:", this.skin.name);

    // Register built-in region renderers
    registerBuiltInRenderers();

    // Render the skin (this will mount all regions including terminal)
    this.renderSkin();

    console.log("[Terminai] Ready");
  }

  /**
   * Render the skin visually
   */
  private renderSkin(): void {
    const app = document.getElementById("app") as HTMLElement;

    console.log("[Terminai] Rendering skin:", this.skin.name);
    console.log("[Terminai] Skin dimensions:", this.skin.visual.width, "x", this.skin.visual.height);
    console.log("[Terminai] Regions to render:", this.skin.regions.length);

    // Set app dimensions to match skin
    app.style.width = `${this.skin.visual.width}px`;
    app.style.height = `${this.skin.visual.height}px`;

    // Debug: Add a border to see the app container
    app.style.border = "2px solid red";

    console.log("[Terminai] App container size:", app.offsetWidth, "x", app.offsetHeight);

    // If we have a chrome image (real WMP skin), render it
    if (this.skin.visual.chromeImage) {
      const chromeImg = document.createElement("img");
      chromeImg.id = "chrome-image";
      chromeImg.src = this.skin.visual.chromeImage;
      chromeImg.style.position = "absolute";
      chromeImg.style.top = "0";
      chromeImg.style.left = "0";
      chromeImg.style.width = "100%";
      chromeImg.style.height = "100%";
      chromeImg.style.pointerEvents = "none";
      chromeImg.style.userSelect = "none";
      chromeImg.style.zIndex = "0";

      // Debug: Log when image loads or fails
      chromeImg.onload = () => {
        console.log("[Terminai] Chrome image loaded successfully:", this.skin.visual.chromeImage);
      };
      chromeImg.onerror = (e) => {
        console.error("[Terminai] Chrome image failed to load:", this.skin.visual.chromeImage, e);
      };

      app.appendChild(chromeImg);
    } else {
      // Fallback for old placeholder skin
      if (this.skin.visual.shape) {
        app.style.clipPath = this.skin.visual.shape;
      }
      if (this.skin.visual.background) {
        app.style.background = this.skin.visual.background;
      }
    }

    // Render all regions using the registry
    const regionElements: Record<string, HTMLElement> = {};

    this.skin.regions.forEach((region) => {
      const renderer = regionRegistry.get(region.type);
      if (!renderer) {
        console.warn(`[Terminai] No renderer found for region type: ${region.type}`);
        return;
      }

      // Create container for this region
      const container = document.createElement("div");
      container.id = `region-${region.id}`;
      container.style.position = "absolute";
      container.style.left = `${region.rect.x}px`;
      container.style.top = `${region.rect.y}px`;
      container.style.width = `${region.rect.width}px`;
      container.style.height = `${region.rect.height}px`;
      if (region.zIndex !== undefined) {
        container.style.zIndex = region.zIndex.toString();
      }

      // Mount the renderer
      const cleanup = renderer.mount(container, region, this.dataSource);
      this.regionCleanups.push(cleanup);

      app.appendChild(container);
      regionElements[region.id] = container;
    });

    // Wire up speaker pulse animation
    // When activity-feed emits 'activity' event, pulse the speaker regions
    const activityRegion = regionElements["right-activity"];
    const leftSpeaker = regionElements["left-memory"];
    const rightSpeaker = regionElements["right-activity"];

    if (activityRegion && leftSpeaker && rightSpeaker) {
      activityRegion.addEventListener("activity", () => {
        // Add pulse class
        leftSpeaker.classList.add("pulse");
        rightSpeaker.classList.add("pulse");

        // Remove after animation completes (800ms)
        setTimeout(() => {
          leftSpeaker.classList.remove("pulse");
          rightSpeaker.classList.remove("pulse");
        }, 800);
      });
    }

    // Set up window dragging on the entire app (background area)
    this.setupWindowDragging(app);
  }

  /**
   * Set up window dragging for a given element
   */
  private setupWindowDragging(element: HTMLElement): void {
    element.addEventListener("mousedown", async (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't drag if clicking on terminal or buttons
      if (
        target.closest("#terminal-container") ||
        target.closest(".action-button")
      ) {
        return;
      }

      e.preventDefault();
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const currentWindow = getCurrentWindow();
        await currentWindow.startDragging();
      } catch (error) {
        console.error("[Drag] Failed to start dragging:", error);
      }
    });
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
  const app = new TerminaiApp(headspaceSkin);
  await app.init();
});
