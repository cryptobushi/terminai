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
import { SkinBundleLoader } from "./skins/bundle-loader";
import { getTerminalSession } from "./regions/terminal";
import "./style.css";

class TerminaiApp {
  private skin: SkinManifest;
  private dataSource: DataSource;
  private regionCleanups: Array<() => void> = [];
  private currentScale: number = 1.0;

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

    // Make app fill entire window
    app.style.width = "100vw";
    app.style.height = "100vh";
    app.style.position = "relative";
    app.style.overflow = "hidden";

    console.log("[Terminai] App container size:", app.offsetWidth, "x", app.offsetHeight);

    // Create a content wrapper to hold the skin - will scale to fill window while maintaining aspect ratio
    const contentWrapper = document.createElement("div");
    contentWrapper.id = "content-wrapper";
    contentWrapper.style.position = "absolute";

    // Store the skin's native aspect ratio
    const aspectRatio = this.skin.visual.width / this.skin.visual.height;

    // Calculate scale to fit window while maintaining aspect ratio
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspect = windowWidth / windowHeight;

    if (windowAspect > aspectRatio) {
      // Window is wider than skin - fit to height
      this.currentScale = windowHeight / this.skin.visual.height;
    } else {
      // Window is taller than skin - fit to width
      this.currentScale = windowWidth / this.skin.visual.width;
    }

    // Apply scaling transform with transform-origin at top-left
    contentWrapper.style.transformOrigin = "top left";
    contentWrapper.style.transform = `scale(${this.currentScale})`;
    contentWrapper.style.width = `${this.skin.visual.width}px`;
    contentWrapper.style.height = `${this.skin.visual.height}px`;

    // Center the scaled content
    const scaledWidth = this.skin.visual.width * this.currentScale;
    const scaledHeight = this.skin.visual.height * this.currentScale;
    contentWrapper.style.left = `${(windowWidth - scaledWidth) / 2}px`;
    contentWrapper.style.top = `${(windowHeight - scaledHeight) / 2}px`;

    console.log(`[Terminai] Scale: ${this.currentScale}, Scaled size: ${scaledWidth}x${scaledHeight}, Window: ${windowWidth}x${windowHeight}`);

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
      chromeImg.style.maxWidth = "none";
      chromeImg.style.maxHeight = "none";
      chromeImg.style.pointerEvents = "none";
      chromeImg.style.userSelect = "none";
      // Chrome is typically the base layer, default to 0 if not specified
      chromeImg.style.zIndex = (this.skin.visual.chromeZIndex ?? 0).toString();

      // Debug: Log when image loads or fails
      chromeImg.onload = () => {
        console.log("[Terminai] Chrome image loaded successfully:", this.skin.visual.chromeImage);
      };
      chromeImg.onerror = (e) => {
        console.error("[Terminai] Chrome image failed to load:", this.skin.visual.chromeImage, e);
      };

      contentWrapper.appendChild(chromeImg);
    } else {
      // Fallback for old placeholder skin
      if (this.skin.visual.shape) {
        contentWrapper.style.clipPath = this.skin.visual.shape;
      }
      if (this.skin.visual.background) {
        contentWrapper.style.background = this.skin.visual.background;
      }
    }

    app.appendChild(contentWrapper);

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
      const cleanup = renderer.mount(container, region, this.dataSource, this.currentScale);
      this.regionCleanups.push(cleanup);

      contentWrapper.appendChild(container);
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

    // Set up resize listener to rescale skin when window size changes
    this.setupWindowResize(contentWrapper);

    // Set up proportional resize handles on the skin edges
    this.setupProportionalResize(contentWrapper);
  }

  /**
   * Set up resize listener to scale skin content when window is resized
   */
  private setupWindowResize(contentWrapper: HTMLElement): void {
    const resizeHandler = () => {
      const aspectRatio = this.skin.visual.width / this.skin.visual.height;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const windowAspect = windowWidth / windowHeight;

      if (windowAspect > aspectRatio) {
        // Window is wider than skin - fit to height
        this.currentScale = windowHeight / this.skin.visual.height;
      } else {
        // Window is taller than skin - fit to width
        this.currentScale = windowWidth / this.skin.visual.width;
      }

      console.log(`[Resize] Window: ${windowWidth}x${windowHeight}, Scale: ${this.currentScale}, Aspect: skin=${aspectRatio.toFixed(2)}, window=${windowAspect.toFixed(2)}`);

      // Apply scaling transform
      contentWrapper.style.transform = `scale(${this.currentScale})`;

      // Center the scaled content
      const scaledWidth = this.skin.visual.width * this.currentScale;
      const scaledHeight = this.skin.visual.height * this.currentScale;
      contentWrapper.style.left = `${(windowWidth - scaledWidth) / 2}px`;
      contentWrapper.style.top = `${(windowHeight - scaledHeight) / 2}px`;

      // Update terminal font size if terminal session exists
      const terminal = getTerminalSession();
      if (terminal && terminal.updateFontSize) {
        terminal.updateFontSize(this.currentScale);
      }
    };

    window.addEventListener("resize", resizeHandler);
  }

  /**
   * Set up proportional resize handles on skin edges
   * All edge drags resize proportionally like a corner drag
   */
  private setupProportionalResize(contentWrapper: HTMLElement): void {
    const aspectRatio = this.skin.visual.width / this.skin.visual.height;
    let isResizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const handleMouseMove = async (e: MouseEvent) => {
      if (!isResizing) {
        // Update cursor when hovering over resize zones
        const rect = contentWrapper.getBoundingClientRect();
        const isNearEdge =
          (e.clientY >= rect.top && e.clientY <= rect.top + 10) ||
          (e.clientY >= rect.bottom - 10 && e.clientY <= rect.bottom) ||
          (e.clientX >= rect.left && e.clientX <= rect.left + 10) ||
          (e.clientX >= rect.right - 10 && e.clientX <= rect.right);

        if (isNearEdge) {
          document.body.style.cursor = 'nwse-resize';
        } else {
          document.body.style.cursor = 'default';
        }
        return;
      }

      // Use horizontal movement for resizing (feels more natural)
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      const newHeight = Math.round(newWidth / aspectRatio);

      console.log(`[PropResize] Delta: ${deltaX}, New: ${newWidth}x${newHeight}, Aspect: ${aspectRatio.toFixed(2)}`);

      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { LogicalSize } = await import("@tauri-apps/api/dpi");
        const currentWindow = getCurrentWindow();
        await currentWindow.setSize(new LogicalSize(newWidth, newHeight));
      } catch (error) {
        console.error("[Resize] Failed to resize window:", error);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
      }
    };

    // Store this for use in the drag handler
    (contentWrapper as any).__resizeInfo = {
      isNearEdge: (e: MouseEvent) => {
        const rect = contentWrapper.getBoundingClientRect();
        return (
          (e.clientY >= rect.top && e.clientY <= rect.top + 10) ||
          (e.clientY >= rect.bottom - 10 && e.clientY <= rect.bottom) ||
          (e.clientX >= rect.left && e.clientX <= rect.left + 10) ||
          (e.clientX >= rect.right - 10 && e.clientX <= rect.right)
        );
      },
      startResize: (e: MouseEvent) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = window.innerWidth;
        startHeight = window.innerHeight;
        document.body.style.cursor = 'nwse-resize';
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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
        target.closest(".xterm") ||
        target.closest(".action-button")
      ) {
        return;
      }

      // Check if clicking on resize handle
      const contentWrapper = document.getElementById("content-wrapper");
      if (contentWrapper && (contentWrapper as any).__resizeInfo) {
        const resizeInfo = (contentWrapper as any).__resizeInfo;
        if (resizeInfo.isNearEdge(e)) {
          // Start resize instead of drag
          e.preventDefault();
          e.stopPropagation();
          resizeInfo.startResize(e);
          return;
        }
      }

      // Don't drag if clicking near window edges (leave space for OS resize handles)
      const edgeThreshold = 10; // pixels from edge
      const rect = element.getBoundingClientRect();
      const isNearWindowEdge =
        e.clientX < rect.left + edgeThreshold ||
        e.clientX > rect.right - edgeThreshold ||
        e.clientY < rect.top + edgeThreshold ||
        e.clientY > rect.bottom - edgeThreshold;

      if (isNearWindowEdge) {
        // Let the OS handle window resizing
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
  // Check if there's a custom skin in localStorage
  let skin: SkinManifest = headspaceSkin;
  const customSkin = SkinBundleLoader.loadFromLocalStorage();

  if (customSkin) {
    console.log("[Main] Using custom skin from localStorage:", customSkin.name);
    skin = customSkin;
  } else {
    console.log("[Main] Using default headspace skin");
  }

  const app = new TerminaiApp(skin);
  await app.init();

  // Set up skin bundle import handler
  const handleImportSkin = async () => {
    const importInput = document.getElementById("import-skin-bundle") as HTMLInputElement;
    if (importInput) {
      importInput.click();
    }
  };

  // Set up file input change handler
  const importInput = document.getElementById("import-skin-bundle") as HTMLInputElement;
  if (importInput) {
    importInput.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        console.log("[Main] Importing skin bundle:", file.name);
        const manifest = await SkinBundleLoader.loadFromFile(file);

        // Save to localStorage
        SkinBundleLoader.saveToLocalStorage(manifest);

        // Reload the app with the new skin
        alert(`Skin "${manifest.name}" imported successfully! Reloading...`);
        window.location.reload();
      } catch (error) {
        console.error("[Main] Failed to import skin bundle:", error);
        alert(`Failed to import skin: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  // Listen for menu event from Tauri
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("import-skin-requested", () => {
      console.log("[Main] Import skin requested from menu");
      handleImportSkin();
    });
  } catch (error) {
    console.log("[Main] Not in Tauri environment, menu events not available");
  }
});
