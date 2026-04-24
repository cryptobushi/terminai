import { headspaceSkin } from "./skins/headspace";
import type { SkinManifest } from "./types";
import { registerBuiltInRenderers, regionRegistry } from "./regions";
import { StubHermesDataSource } from "./data/stub-hermes";
import type { DataSource } from "./data/types";
import { SkinBundleLoader } from "./skins/bundle-loader";
import "./style.css";

/**
 * Resize information attached to content wrapper element
 */
interface ResizeInfo {
  isNearEdge: (e: MouseEvent) => boolean;
  startResize: (e: MouseEvent) => void;
}

/**
 * HTMLElement extended with resize metadata
 */
interface HTMLElementWithResize extends HTMLElement {
  __resizeInfo?: ResizeInfo;
}

class TerminaiApp {
  private skin: SkinManifest;
  private dataSource: DataSource;
  private regionCleanups: Array<() => void> = [];
  private currentScale: number = 1.0;
  private windowResizeHandler?: () => void;

  constructor(skin: SkinManifest) {
    this.skin = skin;
    this.dataSource = new StubHermesDataSource();
  }

  async init(): Promise<void> {
    console.log("[Terminai] Initializing with skin:", this.skin.name);

    registerBuiltInRenderers();
    this.renderSkin();
    console.log("[Terminai] Ready");
  }

  /**
   * Reload the app with a new skin without destroying terminal session
   */
  async reloadSkin(newSkin: SkinManifest): Promise<void> {
    console.log("[Terminai] Reloading skin:", newSkin.name);

    // Clean up old skin (but preserve terminal session)
    this.cleanup();

    // Update skin reference
    this.skin = newSkin;

    // Render new skin
    this.renderSkin();

    console.log("[Terminai] Skin reloaded successfully");
  }

  /**
   * Clean up current skin rendering (except terminal session)
   */
  private cleanup(): void {
    console.log("[Terminai] Cleaning up old skin");

    // Call all region cleanup functions
    // Terminal cleanup will only detach, not destroy the session
    this.regionCleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (err) {
        console.error("[Terminai] Cleanup error:", err);
      }
    });
    this.regionCleanups = [];

    // Remove window resize handler
    if (this.windowResizeHandler) {
      window.removeEventListener("resize", this.windowResizeHandler);
      this.windowResizeHandler = undefined;
    }

    // Clear the app container
    const app = document.getElementById("app");
    if (app) {
      app.innerHTML = "";
    }

    console.log("[Terminai] Cleanup complete");
  }

  private renderSkin(): void {
    const app = document.getElementById("app") as HTMLElement;

    console.log("[Terminai] Rendering skin:", this.skin.name);
    console.log("[Terminai] Skin dimensions:", this.skin.visual.width, "x", this.skin.visual.height);
    console.log("[Terminai] Regions to render:", this.skin.regions.length);

    app.style.width = "100vw";
    app.style.height = "100vh";
    app.style.position = "relative";
    app.style.overflow = "hidden";

    console.log("[Terminai] App container size:", app.offsetWidth, "x", app.offsetHeight);

    const contentWrapper = document.createElement("div");
    contentWrapper.id = "content-wrapper";
    contentWrapper.style.position = "absolute";

    const aspectRatio = this.skin.visual.width / this.skin.visual.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowAspect = windowWidth / windowHeight;

    if (windowAspect > aspectRatio) {
      this.currentScale = windowHeight / this.skin.visual.height;
    } else {
      this.currentScale = windowWidth / this.skin.visual.width;
    }

    contentWrapper.style.width = `${this.skin.visual.width}px`;
    contentWrapper.style.height = `${this.skin.visual.height}px`;
    contentWrapper.style.transform = `scale(${this.currentScale})`;
    contentWrapper.style.transformOrigin = "top left";
    contentWrapper.style.left = "0";
    contentWrapper.style.top = "0";

    console.log(`[Terminai] Window: ${windowWidth}x${windowHeight}, Scale: ${this.currentScale}`);

    app.appendChild(contentWrapper);

    // Chrome image rendered as sibling to contentWrapper and terminal
    // so z-index properly stacks with terminal
    if (this.skin.visual.chromeImage) {
      const chromeImg = document.createElement("img");
      chromeImg.id = "chrome-image";
      chromeImg.src = this.skin.visual.chromeImage;
      chromeImg.style.position = "absolute";
      chromeImg.style.top = "0";
      chromeImg.style.left = "0";
      chromeImg.style.width = `${this.skin.visual.width * this.currentScale}px`;
      chromeImg.style.height = `${this.skin.visual.height * this.currentScale}px`;
      chromeImg.style.maxWidth = "none";
      chromeImg.style.maxHeight = "none";
      chromeImg.style.pointerEvents = "none";
      chromeImg.style.userSelect = "none";
      chromeImg.style.transformOrigin = "top left";
      chromeImg.style.zIndex = (this.skin.visual.chromeZIndex ?? 100).toString();

      chromeImg.onload = () => {
        console.log("[Terminai] Chrome image loaded successfully:", this.skin.visual.chromeImage);
      };
      chromeImg.onerror = (e) => {
        console.error("[Terminai] Chrome image failed to load:", this.skin.visual.chromeImage, e);
      };

      app.appendChild(chromeImg);
    }

    const regionElements: Record<string, HTMLElement> = {};

    this.skin.regions.forEach((region) => {
      const renderer = regionRegistry.get(region.type);
      if (!renderer) {
        console.warn(`[Terminai] No renderer found for region type: ${region.type}`);
        return;
      }

      const container = document.createElement("div");
      container.id = `region-${region.id}`;
      container.style.position = "absolute";

      if (region.type === "terminal") {
        // Terminal rendered outside scaled wrapper for crisp text at 1:1 pixel ratio
        container.style.left = `${region.rect.x * this.currentScale}px`;
        container.style.top = `${region.rect.y * this.currentScale}px`;
        container.style.width = `${region.rect.width * this.currentScale}px`;
        container.style.height = `${region.rect.height * this.currentScale}px`;
        if (region.zIndex !== undefined) {
          container.style.zIndex = region.zIndex.toString();
        }

        const cleanup = renderer.mount(container, region, this.dataSource, 1.0);
        this.regionCleanups.push(cleanup);

        app.appendChild(container);
        regionElements[region.id] = container;
      } else {
        container.style.left = `${region.rect.x}px`;
        container.style.top = `${region.rect.y}px`;
        container.style.width = `${region.rect.width}px`;
        container.style.height = `${region.rect.height}px`;
        if (region.zIndex !== undefined) {
          container.style.zIndex = region.zIndex.toString();
        }

        const cleanup = renderer.mount(container, region, this.dataSource, this.currentScale);
        this.regionCleanups.push(cleanup);

        contentWrapper.appendChild(container);
        regionElements[region.id] = container;
      }
    });

    // Pulse speaker regions when activity-feed emits events
    const activityRegion = regionElements["right-activity"];
    const leftSpeaker = regionElements["left-memory"];
    const rightSpeaker = regionElements["right-activity"];

    if (activityRegion && leftSpeaker && rightSpeaker) {
      activityRegion.addEventListener("activity", () => {
        leftSpeaker.classList.add("pulse");
        rightSpeaker.classList.add("pulse");

        setTimeout(() => {
          leftSpeaker.classList.remove("pulse");
          rightSpeaker.classList.remove("pulse");
        }, 800);
      });
    }

    this.setupWindowDragging(app);
    this.setupWindowResize(contentWrapper);
    this.setupProportionalResize(contentWrapper);
  }

  private setupWindowResize(contentWrapper: HTMLElement): void {
    // Remove old handler if it exists
    if (this.windowResizeHandler) {
      window.removeEventListener("resize", this.windowResizeHandler);
    }

    this.windowResizeHandler = () => {
      const aspectRatio = this.skin.visual.width / this.skin.visual.height;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const windowAspect = windowWidth / windowHeight;

      if (windowAspect > aspectRatio) {
        this.currentScale = windowHeight / this.skin.visual.height;
      } else {
        this.currentScale = windowWidth / this.skin.visual.width;
      }

      console.log(`[Resize] Window: ${windowWidth}x${windowHeight}, Scale: ${this.currentScale}, Aspect: skin=${aspectRatio.toFixed(2)}, window=${windowAspect.toFixed(2)}`);

      // Use requestAnimationFrame to batch DOM updates and prevent artifacts
      requestAnimationFrame(() => {
        contentWrapper.style.transform = `scale(${this.currentScale})`;

        // Resize chrome image (sibling to wrapper)
        const chromeImg = document.getElementById("chrome-image") as HTMLImageElement;
        if (chromeImg) {
          chromeImg.style.width = `${this.skin.visual.width * this.currentScale}px`;
          chromeImg.style.height = `${this.skin.visual.height * this.currentScale}px`;
        }

        // Update terminal container positions
        this.skin.regions.forEach((region) => {
          if (region.type === "terminal") {
            const container = document.getElementById(`region-${region.id}`) as HTMLElement;
            if (container) {
              container.style.left = `${region.rect.x * this.currentScale}px`;
              container.style.top = `${region.rect.y * this.currentScale}px`;
              container.style.width = `${region.rect.width * this.currentScale}px`;
              container.style.height = `${region.rect.height * this.currentScale}px`;
            }
          }
        });
      });
    };

    window.addEventListener("resize", this.windowResizeHandler);
  }

  /**
   * Set up proportional resize handles on skin edges
   * All edge drags resize proportionally like a corner drag
   */
  private setupProportionalResize(contentWrapper: HTMLElement): void {
    const aspectRatio = this.skin.visual.width / this.skin.visual.height;
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

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
      let newWidth = startWidth + deltaX;
      let newHeight = Math.round(newWidth / aspectRatio);

      // Enforce minimum size (native skin dimensions)
      const minWidth = this.skin.visual.width;
      const minHeight = this.skin.visual.height;

      if (newWidth < minWidth) {
        newWidth = minWidth;
        newHeight = minHeight;
      }

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
    (contentWrapper as HTMLElementWithResize).__resizeInfo = {
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
        startWidth = window.innerWidth;
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
      if (contentWrapper && (contentWrapper as HTMLElementWithResize).__resizeInfo) {
        const resizeInfo = (contentWrapper as HTMLElementWithResize).__resizeInfo;
        if (resizeInfo && resizeInfo.isNearEdge(e)) {
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

        // Reload the app with the new skin WITHOUT page reload
        // This preserves the terminal session
        console.log("[Main] Reloading skin without page refresh");
        await app.reloadSkin(manifest);

        alert(`Skin "${manifest.name}" loaded successfully! Terminal session preserved.`);

        // Reset the file input so the same file can be selected again
        (e.target as HTMLInputElement).value = "";
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
