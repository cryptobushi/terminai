/**
 * Terminai Skin Editor - Enhanced with drag, resize, snap-to-grid, undo/redo
 */

import type { EditorState, Region, SkinManifest, ResizeHandle } from "./types";
import { StubHermesDataSource } from "@terminai/data/stub-hermes";
import { regionRegistry, registerBuiltInRenderers } from "@terminai/regions";
import type { DataSource } from "@terminai/data/types";
import "./style.css";

class SkinEditor {
  private state: EditorState = {
    chromeImage: null,
    chromePath: null,
    regions: [],
    selectedRegion: null,
    isDrawing: false,
    drawStart: null,
    previewMode: false,
    snapToGrid: true,
    gridSize: 5,
    isDragging: false,
    dragStart: null,
    dragOffset: null,
    isResizing: false,
    resizeHandle: null,
    resizeStart: null,
    history: [[]],
    historyIndex: 0,
  };

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private chromeImg!: HTMLImageElement;
  private canvasStage!: HTMLElement;
  private readonly HANDLE_SIZE = 8;
  private regionCleanups: Array<() => void> = [];
  private dataSource: DataSource | null = null;

  constructor() {
    this.canvas = document.getElementById("editor-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.chromeImg = document.getElementById("chrome-image") as HTMLImageElement;
    this.canvasStage = document.getElementById("canvas-stage") as HTMLElement;

    // Register runtime renderers
    registerBuiltInRenderers();

    // Initialize stub data source
    this.dataSource = new StubHermesDataSource();

    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Chrome image loader
    const loadChromeInput = document.getElementById("load-chrome") as HTMLInputElement;
    loadChromeInput.addEventListener("change", (e) => this.handleChromeLoad(e));

    // Manifest loader
    const loadManifestInput = document.getElementById("load-manifest") as HTMLInputElement;
    loadManifestInput.addEventListener("change", (e) => this.handleManifestLoad(e));

    // Export button
    const exportBtn = document.getElementById("export-manifest");
    exportBtn?.addEventListener("click", () => this.exportManifest());

    // Preview toggle
    const previewBtn = document.getElementById("toggle-preview");
    previewBtn?.addEventListener("click", () => this.togglePreview());

    // Snap to grid toggle
    const snapBtn = document.getElementById("toggle-snap");
    snapBtn?.addEventListener("click", () => this.toggleSnap());

    // Canvas interaction
    this.canvas.addEventListener("mousedown", (e) => this.handleCanvasMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener("mouseup", (e) => this.handleCanvasMouseUp(e));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Region properties
    document.getElementById("prop-id")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-type")?.addEventListener("change", () => this.updateSelectedRegion());
    document.getElementById("prop-x")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-y")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-width")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-height")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-zindex")?.addEventListener("input", () => this.updateSelectedRegion());

    // Delete region
    document.getElementById("delete-region")?.addEventListener("click", () => this.deleteSelectedRegion());

    // Help button
    document.getElementById("help-button")?.addEventListener("click", () => this.toggleHelp());

    // Exit preview button
    document.getElementById("exit-preview-button")?.addEventListener("click", () => this.togglePreview());
  }

  private toggleHelp(): void {
    const overlay = document.getElementById("help-overlay");
    if (overlay) {
      overlay.style.display = overlay.style.display === "none" ? "flex" : "none";
    }
  }

  private snap(value: number): number {
    if (!this.state.snapToGrid) return Math.round(value);
    return Math.round(value / this.state.gridSize) * this.state.gridSize;
  }

  private saveHistory(): void {
    // Remove any history after current index
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);

    // Add current state to history
    const snapshot = JSON.parse(JSON.stringify(this.state.regions));
    this.state.history.push(snapshot);
    this.state.historyIndex++;

    // Limit history to 50 steps
    if (this.state.history.length > 50) {
      this.state.history.shift();
      this.state.historyIndex--;
    }
  }

  private undo(): void {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      this.state.regions = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
      this.state.selectedRegion = null;
      this.renderRegionList();
      this.render();
      console.log("[Editor] Undo");
    }
  }

  private redo(): void {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      this.state.regions = JSON.parse(JSON.stringify(this.state.history[this.state.historyIndex]));
      this.state.selectedRegion = null;
      this.renderRegionList();
      this.render();
      console.log("[Editor] Redo");
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Help (works in both modes)
    if (e.key === "?" && !e.shiftKey) {
      this.toggleHelp();
      return;
    }

    // Escape to close help or exit preview
    if (e.key === "Escape") {
      const helpOverlay = document.getElementById("help-overlay");
      if (helpOverlay && helpOverlay.style.display !== "none") {
        helpOverlay.style.display = "none";
        return;
      }

      if (this.state.previewMode) {
        this.togglePreview();
        return;
      }

      this.state.selectedRegion = null;
      const propsPanel = document.getElementById("region-properties") as HTMLElement;
      propsPanel.style.display = "none";
      this.render();
      return;
    }

    // 'P' to toggle preview mode (if chrome is loaded)
    if ((e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (this.state.chromeImage) {
        e.preventDefault();
        this.togglePreview();
        return;
      }
    }

    // Block all other shortcuts in preview mode
    if (this.state.previewMode) return;

    // Delete
    if ((e.key === "Delete" || e.key === "Backspace") && this.state.selectedRegion) {
      e.preventDefault();
      this.deleteSelectedRegion();
    }

    // Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }

    // Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this.redo();
    }

    // Arrow keys to move selected region
    if (this.state.selectedRegion && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? this.state.gridSize : 1;

      switch (e.key) {
        case "ArrowUp":
          this.state.selectedRegion.rect.y -= step;
          break;
        case "ArrowDown":
          this.state.selectedRegion.rect.y += step;
          break;
        case "ArrowLeft":
          this.state.selectedRegion.rect.x -= step;
          break;
        case "ArrowRight":
          this.state.selectedRegion.rect.x += step;
          break;
      }

      this.updatePropertiesPanel();
      this.render();
    }
  }

  private getResizeHandle(region: Region, x: number, y: number): ResizeHandle {
    const r = region.rect;
    const h = this.HANDLE_SIZE;

    // Corners
    if (x >= r.x - h && x <= r.x + h && y >= r.y - h && y <= r.y + h) return "nw";
    if (x >= r.x + r.width - h && x <= r.x + r.width + h && y >= r.y - h && y <= r.y + h) return "ne";
    if (x >= r.x - h && x <= r.x + h && y >= r.y + r.height - h && y <= r.y + r.height + h) return "sw";
    if (x >= r.x + r.width - h && x <= r.x + r.width + h && y >= r.y + r.height - h && y <= r.y + r.height + h) return "se";

    // Edges
    if (x >= r.x + h && x <= r.x + r.width - h && y >= r.y - h && y <= r.y + h) return "n";
    if (x >= r.x + h && x <= r.x + r.width - h && y >= r.y + r.height - h && y <= r.y + r.height + h) return "s";
    if (x >= r.x - h && x <= r.x + h && y >= r.y + h && y <= r.y + r.height - h) return "w";
    if (x >= r.x + r.width - h && x <= r.x + r.width + h && y >= r.y + h && y <= r.y + r.height - h) return "e";

    return null;
  }

  private getCursorForHandle(handle: ResizeHandle): string {
    const cursors: Record<string, string> = {
      nw: "nw-resize",
      ne: "ne-resize",
      sw: "sw-resize",
      se: "se-resize",
      n: "n-resize",
      s: "s-resize",
      e: "e-resize",
      w: "w-resize",
    };
    return handle ? cursors[handle] : "crosshair";
  }

  private async handleChromeLoad(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.state.chromePath = file.name;

    const img = new Image();
    img.onload = () => {
      this.state.chromeImage = img;

      // Set chrome img element
      this.chromeImg.src = img.src;
      this.chromeImg.style.display = "block";

      // Size canvas to match for editor overlays
      this.canvas.width = img.width;
      this.canvas.height = img.height;

      // Size canvas-stage to contain everything
      this.canvasStage.style.width = `${img.width}px`;
      this.canvasStage.style.height = `${img.height}px`;

      this.render();

      // Hide instructions
      const instructions = document.getElementById("canvas-instructions");
      if (instructions) instructions.style.display = "none";

      // Enable buttons
      document.getElementById("export-manifest")?.removeAttribute("disabled");
      document.getElementById("toggle-preview")?.removeAttribute("disabled");
      document.getElementById("toggle-snap")?.removeAttribute("disabled");

      console.log(`[Editor] Loaded chrome: ${img.width}x${img.height}`);
    };

    img.src = URL.createObjectURL(file);
  }

  private async handleManifestLoad(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const manifest: SkinManifest = JSON.parse(text);

    this.state.regions = manifest.regions || [];
    this.saveHistory();
    this.renderRegionList();
    this.render();

    console.log(`[Editor] Loaded manifest with ${this.state.regions.length} regions`);
  }

  private handleCanvasMouseDown(e: MouseEvent): void {
    // Disable all canvas interaction in preview mode
    if (this.state.previewMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on resize handle of selected region
    if (this.state.selectedRegion) {
      const handle = this.getResizeHandle(this.state.selectedRegion, x, y);
      if (handle) {
        this.state.isResizing = true;
        this.state.resizeHandle = handle;
        this.state.resizeStart = { x, y };
        return;
      }
    }

    // Check if clicking on existing region
    const clickedRegion = this.findRegionAtPoint(x, y);
    if (clickedRegion) {
      this.selectRegion(clickedRegion);

      // Start dragging
      this.state.isDragging = true;
      this.state.dragStart = { x, y };
      this.state.dragOffset = {
        x: x - clickedRegion.rect.x,
        y: y - clickedRegion.rect.y,
      };
      return;
    }

    // Start drawing new region
    this.state.isDrawing = true;
    this.state.drawStart = { x, y };
    this.state.selectedRegion = null;
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (this.state.previewMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update mouse coords display
    const coordsDisplay = document.getElementById("mouse-coords");
    if (coordsDisplay) {
      coordsDisplay.textContent = `x: ${Math.floor(x)}, y: ${Math.floor(y)}`;
    }

    // Update cursor based on hover
    if (!this.state.isDrawing && !this.state.isDragging && !this.state.isResizing) {
      if (this.state.selectedRegion) {
        const handle = this.getResizeHandle(this.state.selectedRegion, x, y);
        this.canvas.style.cursor = this.getCursorForHandle(handle);
      } else {
        const region = this.findRegionAtPoint(x, y);
        this.canvas.style.cursor = region ? "move" : "crosshair";
      }
    }

    // Handle dragging
    if (this.state.isDragging && this.state.selectedRegion && this.state.dragOffset) {
      const newX = this.snap(x - this.state.dragOffset.x);
      const newY = this.snap(y - this.state.dragOffset.y);

      this.state.selectedRegion.rect.x = newX;
      this.state.selectedRegion.rect.y = newY;

      this.updatePropertiesPanel();
      this.render();
      this.canvas.style.cursor = "move";
      return;
    }

    // Handle resizing
    if (this.state.isResizing && this.state.selectedRegion && this.state.resizeStart) {
      const dx = x - this.state.resizeStart.x;
      const dy = y - this.state.resizeStart.y;
      const region = this.state.selectedRegion;
      const handle = this.state.resizeHandle;

      const originalRect = { ...region.rect };

      switch (handle) {
        case "nw":
          region.rect.x = this.snap(originalRect.x + dx);
          region.rect.y = this.snap(originalRect.y + dy);
          region.rect.width = originalRect.width - (region.rect.x - originalRect.x);
          region.rect.height = originalRect.height - (region.rect.y - originalRect.y);
          break;
        case "ne":
          region.rect.y = this.snap(originalRect.y + dy);
          region.rect.width = this.snap(originalRect.width + dx);
          region.rect.height = originalRect.height - (region.rect.y - originalRect.y);
          break;
        case "sw":
          region.rect.x = this.snap(originalRect.x + dx);
          region.rect.width = originalRect.width - (region.rect.x - originalRect.x);
          region.rect.height = this.snap(originalRect.height + dy);
          break;
        case "se":
          region.rect.width = this.snap(originalRect.width + dx);
          region.rect.height = this.snap(originalRect.height + dy);
          break;
        case "n":
          region.rect.y = this.snap(originalRect.y + dy);
          region.rect.height = originalRect.height - (region.rect.y - originalRect.y);
          break;
        case "s":
          region.rect.height = this.snap(originalRect.height + dy);
          break;
        case "w":
          region.rect.x = this.snap(originalRect.x + dx);
          region.rect.width = originalRect.width - (region.rect.x - originalRect.x);
          break;
        case "e":
          region.rect.width = this.snap(originalRect.width + dx);
          break;
      }

      // Ensure minimum size
      if (region.rect.width < 10) region.rect.width = 10;
      if (region.rect.height < 10) region.rect.height = 10;

      this.state.resizeStart = { x, y };
      this.updatePropertiesPanel();
      this.render();
      this.canvas.style.cursor = this.getCursorForHandle(handle);
      return;
    }

    // Show drawing dimensions if currently drawing
    if (this.state.isDrawing && this.state.drawStart) {
      const width = Math.abs(x - this.state.drawStart.x);
      const height = Math.abs(y - this.state.drawStart.y);
      const drawingDisplay = document.getElementById("drawing-coords");
      if (drawingDisplay) {
        drawingDisplay.textContent = `Drawing: ${Math.floor(width)}x${Math.floor(height)}`;
      }

      // Draw preview rectangle while dragging
      this.render();

      // Draw preview rectangle
      this.ctx.strokeStyle = "#00ff00";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      const drawWidth = x - this.state.drawStart.x;
      const drawHeight = y - this.state.drawStart.y;
      this.ctx.strokeRect(this.state.drawStart.x, this.state.drawStart.y, drawWidth, drawHeight);
      this.ctx.setLineDash([]);
    }
  }

  private handleCanvasMouseUp(e: MouseEvent): void {
    if (this.state.previewMode) return;

    // End dragging
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.state.dragStart = null;
      this.state.dragOffset = null;
      this.saveHistory();
      this.canvas.style.cursor = "crosshair";
    }

    // End resizing
    if (this.state.isResizing) {
      this.state.isResizing = false;
      this.state.resizeHandle = null;
      this.state.resizeStart = null;
      this.saveHistory();
      this.canvas.style.cursor = "crosshair";
    }

    // End drawing
    if (this.state.isDrawing && this.state.drawStart) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const minX = Math.min(this.state.drawStart.x, x);
      const minY = Math.min(this.state.drawStart.y, y);
      const width = Math.abs(x - this.state.drawStart.x);
      const height = Math.abs(y - this.state.drawStart.y);

      // Only create region if it has some size
      if (width > 10 && height > 10) {
        const newRegion: Region = {
          id: `region-${this.state.regions.length + 1}`,
          type: "terminal",
          rect: {
            x: this.snap(minX),
            y: this.snap(minY),
            width: this.snap(width),
            height: this.snap(height),
          },
          zIndex: 10,
        };

        this.state.regions.push(newRegion);
        this.selectRegion(newRegion);
        this.saveHistory();
        this.renderRegionList();
        console.log(`[Editor] Created region:`, newRegion);
      }

      this.state.isDrawing = false;
      this.state.drawStart = null;

      // Clear drawing coords
      const drawingDisplay = document.getElementById("drawing-coords");
      if (drawingDisplay) {
        drawingDisplay.textContent = "";
      }

      this.render();
    }
  }

  private findRegionAtPoint(x: number, y: number): Region | null {
    // Search in reverse order (top z-index first)
    for (let i = this.state.regions.length - 1; i >= 0; i--) {
      const region = this.state.regions[i];
      const r = region.rect;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        return region;
      }
    }
    return null;
  }

  private selectRegion(region: Region): void {
    this.state.selectedRegion = region;

    // Update properties panel
    const propsPanel = document.getElementById("region-properties") as HTMLElement;
    propsPanel.style.display = "block";

    this.updatePropertiesPanel();
    this.render();
  }

  private updatePropertiesPanel(): void {
    if (!this.state.selectedRegion) return;

    const region = this.state.selectedRegion;
    (document.getElementById("prop-id") as HTMLInputElement).value = region.id;
    (document.getElementById("prop-type") as HTMLSelectElement).value = region.type;
    (document.getElementById("prop-x") as HTMLInputElement).value = region.rect.x.toString();
    (document.getElementById("prop-y") as HTMLInputElement).value = region.rect.y.toString();
    (document.getElementById("prop-width") as HTMLInputElement).value = region.rect.width.toString();
    (document.getElementById("prop-height") as HTMLInputElement).value = region.rect.height.toString();
    (document.getElementById("prop-zindex") as HTMLInputElement).value = (region.zIndex || 10).toString();
  }

  private updateSelectedRegion(): void {
    if (!this.state.selectedRegion) return;

    this.state.selectedRegion.id = (document.getElementById("prop-id") as HTMLInputElement).value;
    this.state.selectedRegion.type = (document.getElementById("prop-type") as HTMLSelectElement).value as any;
    this.state.selectedRegion.rect.x = parseInt((document.getElementById("prop-x") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.y = parseInt((document.getElementById("prop-y") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.width = parseInt((document.getElementById("prop-width") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.height = parseInt((document.getElementById("prop-height") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.zIndex = parseInt((document.getElementById("prop-zindex") as HTMLInputElement).value) || 10;

    this.renderRegionList();
    this.render();
  }

  private deleteSelectedRegion(): void {
    if (!this.state.selectedRegion) return;

    this.state.regions = this.state.regions.filter(r => r !== this.state.selectedRegion);
    this.state.selectedRegion = null;
    this.saveHistory();

    const propsPanel = document.getElementById("region-properties") as HTMLElement;
    propsPanel.style.display = "none";

    this.renderRegionList();
    this.render();
  }

  private renderRegionList(): void {
    const listEl = document.getElementById("region-list")!;

    if (this.state.regions.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No regions yet. Click and drag on the canvas to create one.</div>';
      return;
    }

    listEl.innerHTML = this.state.regions
      .map((region, idx) => {
        const isSelected = region === this.state.selectedRegion;
        return `
          <div class="region-item ${isSelected ? 'selected' : ''}" data-idx="${idx}">
            <span class="region-icon">□</span>
            <span class="region-name">${region.id}</span>
            <span class="region-type">${region.type}</span>
          </div>
        `;
      })
      .join("");

    // Add click handlers
    listEl.querySelectorAll(".region-item").forEach((item, idx) => {
      item.addEventListener("click", () => {
        this.selectRegion(this.state.regions[idx]);
      });
    });
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render actual region DOMs (BOTH edit and preview modes)
    this.renderRegionDOMs();

    // Skip all editor decorations in preview mode
    if (this.state.previewMode) {
      return;
    }

    // Draw grid if snap is enabled (EDIT MODE ONLY)
    if (this.state.snapToGrid && this.state.chromeImage) {
      this.ctx.strokeStyle = "rgba(100, 100, 100, 0.2)";
      this.ctx.lineWidth = 1;
      for (let x = 0; x < this.canvas.width; x += this.state.gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
      }
      for (let y = 0; y < this.canvas.height; y += this.state.gridSize) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.canvas.width, y);
        this.ctx.stroke();
      }
    }

    // Draw region overlays (EDIT MODE ONLY)
    this.state.regions.forEach((region) => {
      const isSelected = region === this.state.selectedRegion;

      // Region overlay
      this.ctx.fillStyle = isSelected ? "rgba(0, 255, 0, 0.2)" : "rgba(0, 100, 255, 0.15)";
      this.ctx.fillRect(region.rect.x, region.rect.y, region.rect.width, region.rect.height);

      // Border
      this.ctx.strokeStyle = isSelected ? "#00ff00" : "#0064ff";
      this.ctx.lineWidth = isSelected ? 3 : 1;
      this.ctx.strokeRect(region.rect.x, region.rect.y, region.rect.width, region.rect.height);

      // Label
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "12px monospace";
      this.ctx.fillText(region.id, region.rect.x + 4, region.rect.y + 16);
      this.ctx.font = "10px monospace";
      this.ctx.fillStyle = "#aaaaaa";
      this.ctx.fillText(region.type, region.rect.x + 4, region.rect.y + 30);

      // Draw resize handles for selected region
      if (isSelected) {
        this.drawResizeHandles(region);
      }
    });
  }

  private renderRegionDOMs(): void {
    // Clean up existing region renderers
    this.regionCleanups.forEach(cleanup => cleanup());
    this.regionCleanups = [];

    // Remove all region elements from canvas-stage (keep chrome and canvas)
    const children = Array.from(this.canvasStage.children);
    children.forEach(child => {
      if (child !== this.chromeImg && child !== this.canvas) {
        child.remove();
      }
    });

    // Mount all regions using runtime renderer registry
    this.state.regions.forEach((region) => {
      const renderer = regionRegistry.get(region.type);
      if (!renderer || !this.dataSource) {
        console.warn(`[Editor] No renderer found for region type: ${region.type}`);
        return;
      }

      const container = document.createElement("div");
      container.className = "region-layer";
      container.dataset.regionId = region.id;
      container.style.position = "absolute";
      container.style.left = `${region.rect.x}px`;
      container.style.top = `${region.rect.y}px`;
      container.style.width = `${region.rect.width}px`;
      container.style.height = `${region.rect.height}px`;
      container.style.overflow = "hidden";
      container.style.boxSizing = "border-box";
      container.style.pointerEvents = "auto";
      container.style.zIndex = (region.zIndex !== undefined ? region.zIndex : 5).toString();

      const cleanup = renderer.mount(container, region, this.dataSource);
      this.regionCleanups.push(cleanup);

      this.canvasStage.appendChild(container);
    });
  }

  private drawResizeHandles(region: Region): void {
    const r = region.rect;
    const h = this.HANDLE_SIZE;

    this.ctx.fillStyle = "#00ff00";
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;

    // Corner handles
    const corners = [
      { x: r.x, y: r.y }, // nw
      { x: r.x + r.width, y: r.y }, // ne
      { x: r.x, y: r.y + r.height }, // sw
      { x: r.x + r.width, y: r.y + r.height }, // se
    ];

    corners.forEach(corner => {
      this.ctx.fillRect(corner.x - h / 2, corner.y - h / 2, h, h);
      this.ctx.strokeRect(corner.x - h / 2, corner.y - h / 2, h, h);
    });

    // Edge handles
    const edges = [
      { x: r.x + r.width / 2, y: r.y }, // n
      { x: r.x + r.width / 2, y: r.y + r.height }, // s
      { x: r.x, y: r.y + r.height / 2 }, // w
      { x: r.x + r.width, y: r.y + r.height / 2 }, // e
    ];

    edges.forEach(edge => {
      this.ctx.fillRect(edge.x - h / 2, edge.y - h / 2, h, h);
      this.ctx.strokeRect(edge.x - h / 2, edge.y - h / 2, h, h);
    });
  }

  private toggleSnap(): void {
    this.state.snapToGrid = !this.state.snapToGrid;
    const btn = document.getElementById("toggle-snap");
    if (btn) {
      btn.textContent = this.state.snapToGrid ? "Snap: ON" : "Snap: OFF";
      btn.style.background = this.state.snapToGrid ? "#00aa44" : "#333333";
    }
    this.render();
    console.log("[Editor] Snap to grid:", this.state.snapToGrid);
  }

  private togglePreview(): void {
    this.state.previewMode = !this.state.previewMode;
    const btn = document.getElementById("toggle-preview");
    if (btn) {
      btn.textContent = this.state.previewMode ? "Exit Preview" : "Preview Mode";
      btn.style.background = this.state.previewMode ? "#aa0044" : "#333333";
    }

    if (this.state.previewMode) {
      this.enterPreviewMode();
    } else {
      this.exitPreviewMode();
    }

    console.log("[Editor] Preview mode:", this.state.previewMode);
  }

  private enterPreviewMode(): void {
    // Add preview-mode class to hide editor UI via CSS
    document.body.classList.add("preview-mode");

    // Show exit preview button
    const exitBtn = document.getElementById("exit-preview-button");
    if (exitBtn) {
      exitBtn.style.display = "block";
    }

    // Deselect any selected region
    this.state.selectedRegion = null;

    // Re-render canvas without editor decorations
    this.render();

    console.log("[Editor] Preview mode: entered");
  }

  private exitPreviewMode(): void {
    // Remove preview-mode class to restore editor UI
    document.body.classList.remove("preview-mode");

    // Hide exit preview button
    const exitBtn = document.getElementById("exit-preview-button");
    if (exitBtn) {
      exitBtn.style.display = "none";
    }

    // Re-render canvas with editor decorations
    this.render();

    console.log("[Editor] Preview mode: exited");
  }

  private exportManifest(): void {
    if (!this.state.chromeImage) {
      alert("Please load a chrome image first");
      return;
    }

    const manifest: SkinManifest = {
      id: "custom-skin",
      name: "Custom Skin",
      version: "1.0.0",
      visual: {
        width: this.state.chromeImage.width,
        height: this.state.chromeImage.height,
        chromeImage: `/skins/custom-skin/${this.state.chromePath}`,
      },
      regions: this.state.regions,
      actions: [],
    };

    const json = JSON.stringify(manifest, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "manifest.json";
    a.click();

    URL.revokeObjectURL(url);

    console.log("[Editor] Exported manifest:", manifest);
  }
}

// Initialize editor when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  new SkinEditor();
  console.log("[Editor] Skin Editor initialized with advanced features");
});
