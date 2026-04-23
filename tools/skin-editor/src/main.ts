/**
 * Terminai Skin Editor - Enhanced with drag, resize, snap-to-grid, undo/redo, and Fabric.js shape drawing
 */

import type { EditorState, Region, SkinManifest, ResizeHandle } from "./types";
import { StubHermesDataSource } from "@terminai/data/stub-hermes";
import { regionRegistry, registerBuiltInRenderers } from "@terminai/regions";
import type { DataSource } from "@terminai/data/types";
import JSZip from "jszip";
import { Canvas as FabricCanvas, Rect as FabricRect, Polygon as FabricPolygon, Object as FabricObject } from "fabric";
import { loadImage, fileToDataUri } from "@terminai/utils/file-helpers";
import "./style.css";

class SkinEditor {
  private state: EditorState = {
    chromeImage: null,
    chromePath: null,
    regions: [],
    selectedRegion: null,
    selectedRegions: [],
    hoveredRegion: null,
    isDrawing: false,
    drawStart: null,
    drawMode: null,
    polygonPoints: [],
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
    zoom: 1.0,
    panX: 0,
    panY: 0,
  };

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private fabricCanvas!: FabricCanvas;
  private chromeImg!: HTMLImageElement;
  private canvasStage!: HTMLElement;
  private readonly HANDLE_SIZE = 8;
  private regionCleanups: Array<() => void> = [];
  private dataSource: DataSource | null = null;
  private isDrawingPolygon = false;
  private polygonMode = false;
  private isPanning = false;
  private panStart: { x: number; y: number } | null = null;
  private draggedLayerIndex: number | null = null;

  constructor() {
    this.canvas = document.getElementById("editor-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.chromeImg = document.getElementById("chrome-image") as HTMLImageElement;
    this.canvasStage = document.getElementById("canvas-stage") as HTMLElement;

    // Initialize Fabric.js canvas for shape drawing
    this.fabricCanvas = new FabricCanvas("fabric-canvas", {
      selection: false, // Disable multi-select for now
      preserveObjectStacking: true,
      renderOnAddRemove: true,
    });

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

    // WMZ loader
    const loadWmzInput = document.getElementById("load-wmz") as HTMLInputElement;
    loadWmzInput.addEventListener("change", (e) => this.handleWmzLoad(e));

    // Manifest loader
    const loadManifestInput = document.getElementById("load-manifest") as HTMLInputElement;
    loadManifestInput.addEventListener("change", (e) => this.handleManifestLoad(e));

    // Image upload
    const uploadImageInput = document.getElementById("upload-image") as HTMLInputElement;
    uploadImageInput.addEventListener("change", (e) => this.handleImageUpload(e));

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
    this.canvas.addEventListener("wheel", (e) => this.handleCanvasWheel(e), { passive: false });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Region properties
    document.getElementById("prop-id")?.addEventListener("input", () => this.updateSelectedRegion());
    // Note: prop-type listener is registered separately below to handle shape properties visibility
    document.getElementById("prop-x")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-y")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-width")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-height")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-zindex")?.addEventListener("input", () => this.updateSelectedRegion());

    // Delete region
    document.getElementById("delete-region")?.addEventListener("click", () => this.deleteSelectedRegion());
    document.getElementById("duplicate-region")?.addEventListener("click", () => this.duplicateSelectedRegion());

    // Layer reordering
    document.getElementById("move-layer-up")?.addEventListener("click", () => this.moveLayerUp());
    document.getElementById("move-layer-down")?.addEventListener("click", () => this.moveLayerDown());

    // Shape drawing buttons
    document.getElementById("draw-rectangle")?.addEventListener("click", () => this.enterRectangleMode());
    document.getElementById("draw-polygon")?.addEventListener("click", () => this.enterPolygonMode());

    // Shape property listeners
    document.getElementById("prop-shape-type")?.addEventListener("change", () => this.updateSelectedRegion());
    document.getElementById("prop-stroke-width")?.addEventListener("input", () => this.updateSelectedRegion());
    document.getElementById("prop-opacity")?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      const valueSpan = document.getElementById("opacity-value");
      if (valueSpan) valueSpan.textContent = `${value}%`;
      this.updateSelectedRegion();
    });

    // Sync color picker with hex input (fill color)
    document.getElementById("prop-fill-color")?.addEventListener("input", (e) => {
      const colorValue = (e.target as HTMLInputElement).value;
      const hexInput = document.getElementById("prop-fill-color-hex") as HTMLInputElement;
      if (hexInput) hexInput.value = colorValue.toUpperCase();
      this.updateSelectedRegion();
    });

    document.getElementById("prop-fill-color-hex")?.addEventListener("input", (e) => {
      const hexValue = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
        const colorPicker = document.getElementById("prop-fill-color") as HTMLInputElement;
        if (colorPicker) colorPicker.value = hexValue;
        this.updateSelectedRegion();
      }
    });

    // Sync color picker with hex input (stroke color)
    document.getElementById("prop-stroke-color")?.addEventListener("input", (e) => {
      const colorValue = (e.target as HTMLInputElement).value;
      const hexInput = document.getElementById("prop-stroke-color-hex") as HTMLInputElement;
      if (hexInput) hexInput.value = colorValue.toUpperCase();
      this.updateSelectedRegion();
    });

    document.getElementById("prop-stroke-color-hex")?.addEventListener("input", (e) => {
      const hexValue = (e.target as HTMLInputElement).value;
      if (/^#[0-9A-Fa-f]{6}$/.test(hexValue)) {
        const colorPicker = document.getElementById("prop-stroke-color") as HTMLInputElement;
        if (colorPicker) colorPicker.value = hexValue;
        this.updateSelectedRegion();
      }
    });

    // Type change listener to show/hide shape properties
    document.getElementById("prop-type")?.addEventListener("change", (e) => {
      const type = (e.target as HTMLSelectElement).value;
      const shapeProps = document.getElementById("shape-properties");
      if (shapeProps) {
        shapeProps.style.display = type === "shape-overlay" ? "block" : "none";
      }
      this.updateSelectedRegion();
      // Refresh the properties panel to show newly initialized shape values
      this.updatePropertiesPanel();
    });

    // Help button
    document.getElementById("help-button")?.addEventListener("click", () => this.toggleHelp());

    // Exit preview button
    document.getElementById("exit-preview-button")?.addEventListener("click", () => this.togglePreview());

    // Alignment tools
    document.getElementById("align-left")?.addEventListener("click", () => this.alignSelectedRegions("left"));
    document.getElementById("align-right")?.addEventListener("click", () => this.alignSelectedRegions("right"));
    document.getElementById("align-top")?.addEventListener("click", () => this.alignSelectedRegions("top"));
    document.getElementById("align-bottom")?.addEventListener("click", () => this.alignSelectedRegions("bottom"));
    document.getElementById("align-center-h")?.addEventListener("click", () => this.alignSelectedRegions("center-h"));
    document.getElementById("align-center-v")?.addEventListener("click", () => this.alignSelectedRegions("center-v"));
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
      this.state.selectedRegions = [];
      this.updateAlignmentToolbar();
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
      this.state.selectedRegions = [];
      this.updateAlignmentToolbar();
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

    // Escape to close help, exit preview, exit drawing mode, or deselect
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

      // If in drawing mode, exit it
      if (this.state.drawMode !== null) {
        this.exitDrawMode();
        console.log("[Editor] ESC pressed - exited drawing mode");
        return;
      }

      // Otherwise deselect current selection
      this.state.selectedRegion = null;
      this.state.selectedRegions = [];
      this.updateAlignmentToolbar();
      const propsPanel = document.getElementById("region-properties") as HTMLElement;
      propsPanel.style.display = "none";
      this.renderRegionList();
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

    // Duplicate (Cmd/Ctrl + D)
    if ((e.ctrlKey || e.metaKey) && e.key === "d" && this.state.selectedRegion) {
      e.preventDefault();
      this.duplicateSelectedRegion();
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

    // Arrow keys to move selected regions
    if (this.state.selectedRegion && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? this.state.gridSize : 1;

      // Move all selected regions
      const regionsToMove = this.state.selectedRegions.length > 0
        ? this.state.selectedRegions
        : [this.state.selectedRegion];

      regionsToMove.forEach(region => {
        switch (e.key) {
          case "ArrowUp":
            region.rect.y -= step;
            break;
          case "ArrowDown":
            region.rect.y += step;
            break;
          case "ArrowLeft":
            region.rect.x -= step;
            break;
          case "ArrowRight":
            region.rect.x += step;
            break;
        }
      });

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
      document.getElementById("draw-rectangle")?.removeAttribute("disabled");
      document.getElementById("draw-polygon")?.removeAttribute("disabled");
      const uploadBtn = document.querySelector('.btn-image') as HTMLElement;
      if (uploadBtn) uploadBtn.style.opacity = '1';

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
    // Initialize visibility for loaded regions
    this.state.regions.forEach(r => {
      if (r.visible === undefined) r.visible = true;
    });
    this.saveHistory();
    this.renderRegionList();
    this.render();

    console.log(`[Editor] Loaded manifest with ${this.state.regions.length} regions`);
  }

  private async handleImageUpload(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!this.state.chromeImage) {
      alert("Please load a chrome image first to set canvas dimensions");
      return;
    }

    try {
      // Read file as data URI
      const dataUri = await fileToDataUri(file);

      // Load image to get dimensions
      const img = await loadImage(dataUri);

      // Create image layer region
      const region: Region = {
        id: `image-${Date.now()}`,
        type: "image",
        rect: {
          x: 50, // Default position
          y: 50,
          width: img.width,
          height: img.height,
        },
        zIndex: this.state.regions.length + 1,
        visible: true,
        locked: false,
        data: {
          imageUrl: dataUri,
          originalFileName: file.name,
        },
      };

      this.state.regions.push(region);
      this.saveHistory();
      this.renderRegionList();
      this.selectRegion(region);
      this.render();

      console.log(`[Editor] Uploaded image: ${file.name} (${img.width}x${img.height})`);
    } catch (error) {
      console.error("[Editor] Failed to upload image:", error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset input so same file can be uploaded again
    input.value = '';
  }


  private async handleWmzLoad(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    console.log("[Editor] Loading WMZ file...");

    try {
      // Load and unzip the WMZ file
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Find the .wms XML file
      const wmsFile = Object.keys(zip.files).find(name => name.endsWith('.wms'));
      if (!wmsFile) {
        alert("No .wms file found in WMZ archive");
        return;
      }

      // Parse XML to get skin metadata
      // Read as array buffer first to detect encoding
      const xmlBuffer = await zip.files[wmsFile].async('arraybuffer');
      const xmlBytes = new Uint8Array(xmlBuffer);

      // Detect UTF-16 by checking for BOM or null bytes pattern
      let xmlText: string;
      if (xmlBytes[0] === 0xFF && xmlBytes[1] === 0xFE) {
        // UTF-16LE BOM
        console.log("[Editor] Detected UTF-16LE encoding");
        xmlText = new TextDecoder('utf-16le').decode(xmlBuffer);
      } else if (xmlBytes[0] === 0xFE && xmlBytes[1] === 0xFF) {
        // UTF-16BE BOM
        console.log("[Editor] Detected UTF-16BE encoding");
        xmlText = new TextDecoder('utf-16be').decode(xmlBuffer);
      } else if (xmlBytes[1] === 0 || xmlBytes[3] === 0) {
        // Likely UTF-16 without BOM (every other byte is null)
        console.log("[Editor] Detected UTF-16 (no BOM, guessing LE)");
        xmlText = new TextDecoder('utf-16le').decode(xmlBuffer);
      } else {
        // Default to UTF-8
        console.log("[Editor] Using UTF-8 encoding");
        xmlText = new TextDecoder('utf-8').decode(xmlBuffer);
      }

      console.log("[Editor] XML content preview:", xmlText.substring(0, 300));

      const parser = new DOMParser();
      // Parse as HTML for more lenient parsing (WMP XML is often not strictly well-formed)
      const xmlDoc = parser.parseFromString(xmlText, 'text/html');

      // Log the XML structure for debugging
      console.log("[Editor] Parsed document");

      // Get window dimensions from the view element
      // WMP XML is case-insensitive, so we need to search case-insensitively
      const allElements = xmlDoc.getElementsByTagName('*');
      let viewElement: Element | null = null;

      for (let i = 0; i < allElements.length; i++) {
        const elem = allElements[i];
        if (elem.tagName.toLowerCase() === 'view') {
          viewElement = elem;
          break;
        }
      }

      if (!viewElement) {
        const preview = xmlText.substring(0, 500);
        alert(`No VIEW element found in skin XML.\n\nRoot element: ${xmlDoc.documentElement.tagName}\n\nXML preview:\n${preview}`);
        console.error("[Editor] Full XML:", xmlText);
        return;
      }

      const width = parseInt(viewElement.getAttribute('width') || '0');
      const height = parseInt(viewElement.getAttribute('height') || '0');

      console.log(`[Editor] Skin dimensions: ${width}x${height}`);

      // Parse SUBVIEW elements to get bitmap positions (case-insensitive)
      const subviews: Element[] = [];
      for (let i = 0; i < allElements.length; i++) {
        const elem = allElements[i];
        if (elem.tagName.toLowerCase() === 'subview' && elem.hasAttribute('image')) {
          subviews.push(elem);
        }
      }
      console.log(`[Editor] Found ${subviews.length} subview elements with images`);
      console.log(`[Editor] Total elements in document: ${allElements.length}`);

      // If we found no subviews, try parsing from raw text instead
      // (HTML parser may have dropped custom XML elements)
      if (subviews.length === 0) {
        console.log("[Editor] No subviews found via DOM, trying tree-based XML parsing...");

        // Parse the entire XML tree to find nested subviews and calculate absolute positions
        const subviewData = this.parseSubviewTree(xmlText);

        console.log(`[Editor] Found ${subviewData.length} unique subviews via tree parsing`);

        // Process subviews from regex data
        const bitmapRegions: Region[] = [];
        let zIndex = 1;

        for (const data of subviewData) {
          const filename = data.imagePath.split('/').pop();
          if (!filename) continue;

          console.log(`[Editor] Processing ${filename} at (${data.x}, ${data.y})`);

          const bitmapFile = zip.files[filename];
          if (!bitmapFile) {
            console.warn(`[Editor] Bitmap file not found: ${filename}`);
            continue;
          }

          const bitmapBlob = await bitmapFile.async('blob');
          const imageUrl = await this.processBitmap(bitmapBlob);
          const img = await loadImage(imageUrl);

          // Create unique ID - if there's already a region with this filename, append coordinates
          let regionId = filename.replace('.bmp', '');
          const existingWithSameId = bitmapRegions.find(r => r.id === regionId);
          if (existingWithSameId) {
            regionId = `${regionId}_${data.x}_${data.y}`;
          }

          const region: Region = {
            id: regionId,
            type: 'image',
            rect: {
              x: data.x,
              y: data.y,
              width: img.width,
              height: img.height,
            },
            zIndex,
            data: {
              imageUrl,
            },
          };

          console.log(`[Editor] Created region ${region.id}: x=${region.rect.x}, y=${region.rect.y}, w=${region.rect.width}, h=${region.rect.height}, z=${zIndex}`);

          bitmapRegions.push(region);
          zIndex++;
        }

        console.log(`[Editor] Created ${bitmapRegions.length} bitmap regions from regex parsing`);

        // Create a transparent chrome placeholder (don't composite - layers are individual regions)
        const chromeCanvas = document.createElement('canvas');
        chromeCanvas.width = width;
        chromeCanvas.height = height;
        // Leave it transparent - the bitmap layers will be visible individually

        const chromeBlob = await new Promise<Blob>((resolve) => {
          chromeCanvas.toBlob((blob) => resolve(blob!), 'image/png');
        });
        const chromeUrl = URL.createObjectURL(chromeBlob);

        const chromeImg = new Image();
        chromeImg.onload = () => {
          this.state.chromeImage = chromeImg;
          this.chromeImg.src = chromeImg.src;
          this.chromeImg.style.display = "block";

          this.canvas.width = chromeImg.width;
          this.canvas.height = chromeImg.height;

          this.canvasStage.style.width = `${chromeImg.width}px`;
          this.canvasStage.style.height = `${chromeImg.height}px`;

          // Clear any existing region DOMs before setting new regions
          this.canvasStage.querySelectorAll('.region-layer').forEach(el => el.remove());
          this.regionCleanups.forEach(cleanup => cleanup());
          this.regionCleanups = [];

          this.state.regions = bitmapRegions;
          this.saveHistory();
          this.renderRegionList();
          this.render();

          const instructions = document.getElementById("canvas-instructions");
          if (instructions) instructions.style.display = "none";

          document.getElementById("export-manifest")?.removeAttribute("disabled");
          document.getElementById("toggle-preview")?.removeAttribute("disabled");
          document.getElementById("toggle-snap")?.removeAttribute("disabled");

          console.log(`[Editor] WMZ loaded: ${chromeImg.width}x${chromeImg.height} with ${this.state.regions.length} bitmap layers`);
        };

        chromeImg.src = chromeUrl;
        return;
      }

      // Extract bitmaps and create regions
      const bitmapRegions: Region[] = [];
      let zIndex = 1; // Start with z-index 1 (under chrome at z-index 10)

      for (const subview of Array.from(subviews)) {
        const imagePath = subview.getAttribute('image');
        const x = parseInt(subview.getAttribute('x') || '0');
        const y = parseInt(subview.getAttribute('y') || '0');

        if (!imagePath) continue;

        // Extract bitmap filename from path (e.g., "head.bmp" from "../head.bmp")
        const filename = imagePath.split('/').pop();
        if (!filename) continue;

        console.log(`[Editor] Processing ${filename} at (${x}, ${y})`);

        // Get bitmap file from ZIP
        const bitmapFile = zip.files[filename];
        if (!bitmapFile) {
          console.warn(`[Editor] Bitmap file not found: ${filename}`);
          continue;
        }

        // Load bitmap and convert to image with transparent magenta
        const bitmapBlob = await bitmapFile.async('blob');
        const imageUrl = await this.processBitmap(bitmapBlob);

        // Get bitmap dimensions by loading the image
        const img = await loadImage(imageUrl);

        // Create region for this bitmap layer
        const region: Region = {
          id: filename.replace('.bmp', ''),
          type: 'image',
          rect: {
            x,
            y,
            width: img.width,
            height: img.height,
          },
          zIndex,
          data: {
            imageUrl,
          },
        };

        bitmapRegions.push(region);
        zIndex++;
      }

      console.log(`[Editor] Created ${bitmapRegions.length} bitmap regions`);

      // Create composite chrome.png by rendering all bitmaps
      const chromeCanvas = document.createElement('canvas');
      chromeCanvas.width = width;
      chromeCanvas.height = height;
      const ctx = chromeCanvas.getContext('2d')!;

      // Composite all bitmap layers in z-index order
      for (const region of bitmapRegions) {
        if (region.data?.imageUrl) {
          const img = await loadImage(region.data.imageUrl);
          ctx.drawImage(img, region.rect.x, region.rect.y);
        }
      }

      // Convert canvas to blob and create object URL
      const chromeBlob = await new Promise<Blob>((resolve) => {
        chromeCanvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      const chromeUrl = URL.createObjectURL(chromeBlob);

      // Load the chrome image
      const chromeImg = new Image();
      chromeImg.onload = () => {
        this.state.chromeImage = chromeImg;
        this.chromeImg.src = chromeImg.src;
        this.chromeImg.style.display = "block";

        // Size canvas to match
        this.canvas.width = chromeImg.width;
        this.canvas.height = chromeImg.height;

        // Size canvas-stage
        this.canvasStage.style.width = `${chromeImg.width}px`;
        this.canvasStage.style.height = `${chromeImg.height}px`;

        // Clear any existing region DOMs before setting new regions
        this.canvasStage.querySelectorAll('.region-layer').forEach(el => el.remove());
        this.regionCleanups.forEach(cleanup => cleanup());
        this.regionCleanups = [];

        // Set regions
        this.state.regions = bitmapRegions;
        this.saveHistory();
        this.renderRegionList();
        this.render();

        // Hide instructions
        const instructions = document.getElementById("canvas-instructions");
        if (instructions) instructions.style.display = "none";

        // Enable buttons
        document.getElementById("export-manifest")?.removeAttribute("disabled");
        document.getElementById("toggle-preview")?.removeAttribute("disabled");
        document.getElementById("toggle-snap")?.removeAttribute("disabled");
        document.getElementById("draw-rectangle")?.removeAttribute("disabled");
        document.getElementById("draw-polygon")?.removeAttribute("disabled");

        console.log(`[Editor] WMZ loaded: ${chromeImg.width}x${chromeImg.height} with ${this.state.regions.length} bitmap layers`);
      };

      chromeImg.src = chromeUrl;

    } catch (error) {
      console.error("[Editor] Failed to load WMZ:", error);
      alert(`Failed to load WMZ file: ${error}`);
    }
  }

  private parseSubviewTree(xmlText: string): Array<{imagePath: string, x: number, y: number}> {
    const subviewData: Array<{imagePath: string, x: number, y: number}> = [];
    const seen = new Set<string>();

    // Recursive function to parse subviews and calculate absolute positions
    const parseSubview = (xml: string, parentX: number = 0, parentY: number = 0, depth: number = 0): number => {
      let pos = 0;

      while (pos < xml.length) {
        // Find next <subview opening tag
        const subviewStart = xml.indexOf('<subview', pos);
        if (subviewStart === -1) break;

        // Find the end of the opening tag
        const tagEnd = xml.indexOf('>', subviewStart);
        if (tagEnd === -1) break;

        // Extract the opening tag and attributes
        const openingTag = xml.substring(subviewStart, tagEnd + 1);
        const attributes = openingTag.match(/<subview\s+([^>]+)>/is)?.[1] || '';

        // Extract position (can be x/y or left/top)
        let xMatch = attributes.match(/\bx\s*=\s*"(\d+)"/i);
        if (!xMatch) xMatch = attributes.match(/\bleft\s*=\s*"(\d+)"/i);

        let yMatch = attributes.match(/\by\s*=\s*"(\d+)"/i);
        if (!yMatch) yMatch = attributes.match(/\btop\s*=\s*"(\d+)"/i);

        const relativeX = xMatch ? parseInt(xMatch[1]) : 0;
        const relativeY = yMatch ? parseInt(yMatch[1]) : 0;

        // Calculate absolute position
        const absoluteX = parentX + relativeX;
        const absoluteY = parentY + relativeY;

        // Extract image attribute (can be 'image' or 'backgroundImage')
        let imageMatch = attributes.match(/\bimage\s*=\s*"([^"]+)"/i);
        if (!imageMatch) {
          imageMatch = attributes.match(/\bbackgroundImage\s*=\s*"([^"]+)"/i);
        }

        // If this subview has an image, add it to the list
        if (imageMatch) {
          const imagePath = imageMatch[1];
          const key = `${imagePath}:${absoluteX}:${absoluteY}`;

          if (!seen.has(key)) {
            seen.add(key);
            subviewData.push({ imagePath, x: absoluteX, y: absoluteY });
            console.log(`[Editor] Found subview ${imagePath} at absolute position (${absoluteX}, ${absoluteY}) [depth ${depth}]`);
          }
        }

        // Find the matching closing tag
        let closeTagPos = tagEnd + 1;
        let openCount = 1;

        while (closeTagPos < xml.length && openCount > 0) {
          const nextOpen = xml.indexOf('<subview', closeTagPos);
          const nextClose = xml.indexOf('</subview>', closeTagPos);

          if (nextClose === -1) break;

          if (nextOpen !== -1 && nextOpen < nextClose) {
            openCount++;
            closeTagPos = nextOpen + 1;
          } else {
            openCount--;
            if (openCount === 0) {
              // Found the matching close tag
              const content = xml.substring(tagEnd + 1, nextClose);

              // Recursively parse the content for nested subviews
              parseSubview(content, absoluteX, absoluteY, depth + 1);

              pos = nextClose + 10; // Skip past </subview>
              break;
            }
            closeTagPos = nextClose + 10;
          }
        }

        if (openCount > 0) {
          // No matching close tag found, skip to next
          pos = tagEnd + 1;
        }
      }

      return pos;
    };

    // Parse from the root
    parseSubview(xmlText, 0, 0, 0);

    return subviewData;
  }

  private async processBitmap(bitmapBlob: Blob): Promise<string> {
    // Load BMP into an image element
    const bmpUrl = URL.createObjectURL(bitmapBlob);
    const img = await loadImage(bmpUrl);

    // Create canvas to process the image
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;

    // Draw image to canvas
    ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Make magenta (#FF00FF) pixels transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r === 255 && g === 0 && b === 255) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);

    // Convert to blob and create object URL
    const processedBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });

    // Clean up original blob URL
    URL.revokeObjectURL(bmpUrl);

    return URL.createObjectURL(processedBlob);
  }


  private handleCanvasMouseDown(e: MouseEvent): void {
    // Disable all canvas interaction in preview mode
    if (this.state.previewMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check for Space key panning
    if (e.button === 1 || (e.button === 0 && e.code === "Space")) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }

    // Transform coordinates for zoom/pan
    const transformedX = (x - this.state.panX) / this.state.zoom;
    const transformedY = (y - this.state.panY) / this.state.zoom;

    // Check if clicking on resize handle of selected region
    if (this.state.selectedRegion) {
      const handle = this.getResizeHandle(this.state.selectedRegion, transformedX, transformedY);
      if (handle) {
        this.state.isResizing = true;
        this.state.resizeHandle = handle;
        this.state.resizeStart = { x: transformedX, y: transformedY };
        return;
      }
    }

    // Check if clicking on existing region
    const clickedRegion = this.findRegionAtPoint(transformedX, transformedY);
    if (clickedRegion) {
      // Multi-select handling
      if (e.shiftKey) {
        // Shift+Click: Add to selection
        if (!this.state.selectedRegions.includes(clickedRegion)) {
          this.state.selectedRegions.push(clickedRegion);
          this.state.selectedRegion = clickedRegion; // Make it primary
          console.log(`[Editor] Shift+Click: Added region to selection (${this.state.selectedRegions.length} selected)`);
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: Toggle selection
        const index = this.state.selectedRegions.indexOf(clickedRegion);
        if (index !== -1) {
          this.state.selectedRegions.splice(index, 1);
          // Update primary selection
          if (this.state.selectedRegion === clickedRegion) {
            this.state.selectedRegion = this.state.selectedRegions[0] || null;
          }
          console.log(`[Editor] Ctrl+Click: Removed region from selection (${this.state.selectedRegions.length} selected)`);
        } else {
          this.state.selectedRegions.push(clickedRegion);
          this.state.selectedRegion = clickedRegion;
          console.log(`[Editor] Ctrl+Click: Added region to selection (${this.state.selectedRegions.length} selected)`);
        }
      } else {
        // Normal click: Single select
        this.selectRegion(clickedRegion);
      }

      this.updateAlignmentToolbar();
      this.renderRegionList();
      this.render();

      // Start dragging all selected regions
      this.state.isDragging = true;
      this.state.dragStart = { x: transformedX, y: transformedY };
      this.state.dragOffset = {
        x: transformedX - clickedRegion.rect.x,
        y: transformedY - clickedRegion.rect.y,
      };
      return;
    }

    // Start drawing new region
    this.state.isDrawing = true;
    this.state.drawStart = { x: transformedX, y: transformedY };
    this.state.selectedRegion = null;
    this.state.selectedRegions = [];
    this.updateAlignmentToolbar();
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (this.state.previewMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Transform coordinates for zoom/pan
    const transformedX = (x - this.state.panX) / this.state.zoom;
    const transformedY = (y - this.state.panY) / this.state.zoom;

    // Update mouse coords display
    const coordsDisplay = document.getElementById("mouse-coords");
    if (coordsDisplay) {
      coordsDisplay.textContent = `x: ${Math.floor(transformedX)}, y: ${Math.floor(transformedY)}`;
    }

    // Handle panning
    if (this.isPanning && this.panStart) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.state.panX += dx;
      this.state.panY += dy;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.render();
      this.updateZoomDisplay();
      return;
    }

    // Update cursor based on hover and track hovered region
    if (!this.state.isDrawing && !this.state.isDragging && !this.state.isResizing) {
      if (this.state.selectedRegion) {
        const handle = this.getResizeHandle(this.state.selectedRegion, transformedX, transformedY);
        this.canvas.style.cursor = this.getCursorForHandle(handle);
      } else {
        const region = this.findRegionAtPoint(transformedX, transformedY);
        this.canvas.style.cursor = region ? "move" : "crosshair";

        // Track hovered region for highlighting in region list
        if (this.state.hoveredRegion !== region) {
          this.state.hoveredRegion = region;
          this.renderRegionList();
        }
      }
    }

    // Handle dragging - move all selected regions
    if (this.state.isDragging && this.state.dragStart && this.state.dragOffset) {
      const dx = transformedX - this.state.dragStart.x;
      const dy = transformedY - this.state.dragStart.y;

      // Move all selected regions
      const regionsToMove = this.state.selectedRegions.length > 0
        ? this.state.selectedRegions
        : (this.state.selectedRegion ? [this.state.selectedRegion] : []);

      regionsToMove.forEach(region => {
        region.rect.x = this.snap(region.rect.x + dx);
        region.rect.y = this.snap(region.rect.y + dy);
      });

      this.state.dragStart = { x: transformedX, y: transformedY };
      this.updatePropertiesPanel();
      this.render();
      this.canvas.style.cursor = "move";
      return;
    }

    // Handle resizing
    if (this.state.isResizing && this.state.selectedRegion && this.state.resizeStart) {
      const dx = transformedX - this.state.resizeStart.x;
      const dy = transformedY - this.state.resizeStart.y;
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

      this.state.resizeStart = { x: transformedX, y: transformedY };
      this.updatePropertiesPanel();
      this.render();
      this.canvas.style.cursor = this.getCursorForHandle(handle);
      return;
    }

    // Show drawing dimensions if currently drawing
    if (this.state.isDrawing && this.state.drawStart) {
      const width = Math.abs(transformedX - this.state.drawStart.x);
      const height = Math.abs(transformedY - this.state.drawStart.y);
      const drawingDisplay = document.getElementById("drawing-coords");
      if (drawingDisplay) {
        drawingDisplay.textContent = `Drawing: ${Math.floor(width)}x${Math.floor(height)}`;
      }

      // Draw preview rectangle while dragging
      this.render();

      // Draw preview rectangle (apply transform)
      this.ctx.save();
      this.ctx.setTransform(this.state.zoom, 0, 0, this.state.zoom, this.state.panX, this.state.panY);
      this.ctx.strokeStyle = "#00ff00";
      this.ctx.lineWidth = 2 / this.state.zoom;
      this.ctx.setLineDash([5 / this.state.zoom, 5 / this.state.zoom]);
      const drawWidth = transformedX - this.state.drawStart.x;
      const drawHeight = transformedY - this.state.drawStart.y;
      this.ctx.strokeRect(this.state.drawStart.x, this.state.drawStart.y, drawWidth, drawHeight);
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }
  }

  private handleCanvasMouseUp(e: MouseEvent): void {
    if (this.state.previewMode) return;

    // End panning
    if (this.isPanning) {
      this.isPanning = false;
      this.panStart = null;
      this.canvas.style.cursor = "crosshair";
      return;
    }

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

      const transformedX = (x - this.state.panX) / this.state.zoom;
      const transformedY = (y - this.state.panY) / this.state.zoom;

      const minX = Math.min(this.state.drawStart.x, transformedX);
      const minY = Math.min(this.state.drawStart.y, transformedY);
      const width = Math.abs(transformedX - this.state.drawStart.x);
      const height = Math.abs(transformedY - this.state.drawStart.y);

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
          visible: true,
          locked: false,
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

  private toggleLock(region: Region): void {
    region.locked = !region.locked;
    console.log(`[Editor] ${region.locked ? 'Locked' : 'Unlocked'} region: ${region.id}`);

    // If we're locking the currently selected region, deselect it
    if (region.locked && region === this.state.selectedRegion) {
      this.state.selectedRegion = null;
      const propsPanel = document.getElementById("region-properties") as HTMLElement;
      propsPanel.style.display = "none";
    }

    this.renderRegionList();
    this.render();
  }

  private toggleVisibility(region: Region): void {
    region.visible = !region.visible;
    console.log(`[Editor] ${region.visible ? 'Shown' : 'Hidden'} region: ${region.id}`);
    this.renderRegionList();
    this.render();
  }

  private moveLayerUp(): void {
    if (!this.state.selectedRegion) return;

    const idx = this.state.regions.indexOf(this.state.selectedRegion);
    if (idx < this.state.regions.length - 1) {
      // Swap with next region (higher in visual stack)
      [this.state.regions[idx], this.state.regions[idx + 1]] =
        [this.state.regions[idx + 1], this.state.regions[idx]];

      this.saveHistory();
      this.renderRegionList();
      this.render();
      this.updateLayerButtons();
      console.log(`[Editor] Moved layer up: ${this.state.selectedRegion.id}`);
    }
  }

  private moveLayerDown(): void {
    if (!this.state.selectedRegion) return;

    const idx = this.state.regions.indexOf(this.state.selectedRegion);
    if (idx > 0) {
      // Swap with previous region (lower in visual stack)
      [this.state.regions[idx], this.state.regions[idx - 1]] =
        [this.state.regions[idx - 1], this.state.regions[idx]];

      this.saveHistory();
      this.renderRegionList();
      this.render();
      this.updateLayerButtons();
      console.log(`[Editor] Moved layer down: ${this.state.selectedRegion.id}`);
    }
  }

  private updateLayerButtons(): void {
    if (!this.state.selectedRegion) {
      document.getElementById("move-layer-up")?.setAttribute("disabled", "true");
      document.getElementById("move-layer-down")?.setAttribute("disabled", "true");
      return;
    }

    const idx = this.state.regions.indexOf(this.state.selectedRegion);
    const upBtn = document.getElementById("move-layer-up");
    const downBtn = document.getElementById("move-layer-down");

    if (upBtn) {
      if (idx < this.state.regions.length - 1) {
        upBtn.removeAttribute("disabled");
      } else {
        upBtn.setAttribute("disabled", "true");
      }
    }

    if (downBtn) {
      if (idx > 0) {
        downBtn.removeAttribute("disabled");
      } else {
        downBtn.setAttribute("disabled", "true");
      }
    }
  }

  private findRegionAtPoint(x: number, y: number): Region | null {
    // Search in reverse order (top z-index first)
    // Skip locked regions
    for (let i = this.state.regions.length - 1; i >= 0; i--) {
      const region = this.state.regions[i];
      if (region.locked) continue; // Skip locked regions

      const r = region.rect;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        return region;
      }
    }
    return null;
  }

  private selectRegion(region: Region): void {
    this.state.selectedRegion = region;
    // Sync selectedRegions array for backwards compatibility
    this.state.selectedRegions = [region];

    // Update properties panel
    const propsPanel = document.getElementById("region-properties") as HTMLElement;
    propsPanel.style.display = "block";

    this.updatePropertiesPanel();
    this.updateLayerButtons();
    this.updateAlignmentToolbar();
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

    // Show/hide shape properties based on type
    const shapeProps = document.getElementById("shape-properties");
    if (shapeProps) {
      if (region.type === "shape-overlay" && region.shape) {
        shapeProps.style.display = "block";

        const fillColor = region.shape.fillColor || "#ff0000";
        const strokeColor = region.shape.strokeColor || "#000000";

        (document.getElementById("prop-shape-type") as HTMLSelectElement).value = region.shape.type;
        (document.getElementById("prop-fill-color") as HTMLInputElement).value = fillColor;
        (document.getElementById("prop-fill-color-hex") as HTMLInputElement).value = fillColor.toUpperCase();
        (document.getElementById("prop-stroke-color") as HTMLInputElement).value = strokeColor;
        (document.getElementById("prop-stroke-color-hex") as HTMLInputElement).value = strokeColor.toUpperCase();
        (document.getElementById("prop-stroke-width") as HTMLInputElement).value = (region.shape.strokeWidth || 2).toString();

        const opacity = Math.round((region.shape.opacity || 0.5) * 100);
        (document.getElementById("prop-opacity") as HTMLInputElement).value = opacity.toString();
        const opacityValue = document.getElementById("opacity-value");
        if (opacityValue) opacityValue.textContent = `${opacity}%`;
      } else {
        shapeProps.style.display = "none";
      }
    }
  }

  private updateSelectedRegion(): void {
    if (!this.state.selectedRegion) return;

    this.state.selectedRegion.id = (document.getElementById("prop-id") as HTMLInputElement).value;
    const newType = (document.getElementById("prop-type") as HTMLSelectElement).value as any;
    this.state.selectedRegion.type = newType;
    this.state.selectedRegion.rect.x = parseInt((document.getElementById("prop-x") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.y = parseInt((document.getElementById("prop-y") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.width = parseInt((document.getElementById("prop-width") as HTMLInputElement).value) || 0;
    this.state.selectedRegion.rect.height = parseInt((document.getElementById("prop-height") as HTMLInputElement).value) || 0;

    // Enforce minimum z-index of 1 (0 is reserved for chrome layer)
    const zIndex = parseInt((document.getElementById("prop-zindex") as HTMLInputElement).value) || 10;
    this.state.selectedRegion.zIndex = Math.max(1, zIndex);

    // Update shape properties if this is a shape-overlay
    if (this.state.selectedRegion.type === "shape-overlay") {
      if (!this.state.selectedRegion.shape) {
        this.state.selectedRegion.shape = {
          type: "rectangle",
          fillColor: "#ff0000",
          strokeColor: "#000000",
          strokeWidth: 2,
          opacity: 0.5
        };
      }

      const shapeType = (document.getElementById("prop-shape-type") as HTMLSelectElement).value as ShapeType;
      const fillColor = (document.getElementById("prop-fill-color") as HTMLInputElement).value;
      const strokeColor = (document.getElementById("prop-stroke-color") as HTMLInputElement).value;
      const strokeWidth = parseInt((document.getElementById("prop-stroke-width") as HTMLInputElement).value) || 2;
      const opacity = parseInt((document.getElementById("prop-opacity") as HTMLInputElement).value) / 100;

      this.state.selectedRegion.shape.type = shapeType;
      this.state.selectedRegion.shape.fillColor = fillColor;
      this.state.selectedRegion.shape.strokeColor = strokeColor;
      this.state.selectedRegion.shape.strokeWidth = strokeWidth;
      this.state.selectedRegion.shape.opacity = opacity;

      // Update Fabric.js object if it exists
      this.updateFabricShape(this.state.selectedRegion);
    }

    this.renderRegionList();
    this.render();
  }

  private updateFabricShape(region: Region): void {
    if (!region.shape) return;

    // Find and update the corresponding Fabric object
    const fabricObjects = this.fabricCanvas.getObjects();

    // For now, we'll just render the shape properties
    // In a more complete implementation, we'd track Fabric objects per region
  }

  private deleteSelectedRegion(): void {
    if (!this.state.selectedRegion && this.state.selectedRegions.length === 0) return;

    // Delete all selected regions
    const regionsToDelete = this.state.selectedRegions.length > 0
      ? this.state.selectedRegions
      : (this.state.selectedRegion ? [this.state.selectedRegion] : []);

    console.log(`[Editor] Deleting ${regionsToDelete.length} region(s)`);

    this.state.regions = this.state.regions.filter(r => !regionsToDelete.includes(r));
    this.state.selectedRegion = null;
    this.state.selectedRegions = [];
    this.saveHistory();

    const propsPanel = document.getElementById("region-properties") as HTMLElement;
    propsPanel.style.display = "none";

    this.updateAlignmentToolbar();
    this.renderRegionList();
    this.render();
  }

  private duplicateSelectedRegion(): void {
    if (!this.state.selectedRegion) return;

    const original = this.state.selectedRegion;

    // Create a deep copy of the region
    const duplicate: Region = {
      id: this.generateUniqueId(original.id),
      type: original.type,
      rect: {
        x: original.rect.x + 20, // Offset by 20px so it's visible
        y: original.rect.y + 20,
        width: original.rect.width,
        height: original.rect.height,
      },
      zIndex: original.zIndex,
      locked: false, // Don't copy the locked state
      data: original.data ? JSON.parse(JSON.stringify(original.data)) : undefined, // Deep copy data
    };

    this.state.regions.push(duplicate);
    this.saveHistory();

    // Select the newly duplicated region
    this.selectRegion(duplicate);

    this.renderRegionList();
    this.render();

    console.log(`[Editor] Duplicated region ${original.id} as ${duplicate.id}`);
  }

  private generateUniqueId(baseId: string): string {
    // Remove any existing copy suffix
    const baseName = baseId.replace(/_copy\d*$/, '');

    // Find all regions with similar IDs
    let copyNumber = 1;
    let newId = `${baseName}_copy`;

    while (this.state.regions.some(r => r.id === newId)) {
      copyNumber++;
      newId = `${baseName}_copy${copyNumber}`;
    }

    return newId;
  }

  private renderRegionList(): void {
    const listEl = document.getElementById("region-list")!;

    if (this.state.regions.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No layers yet. Click and drag on the canvas to create one.</div>';
      return;
    }

    // Render in reverse order so topmost layers appear first
    listEl.innerHTML = this.state.regions
      .slice()
      .reverse()
      .map((region, reverseIdx) => {
        const idx = this.state.regions.length - 1 - reverseIdx;
        const isSelected = this.state.selectedRegions.includes(region);
        const isHovered = region === this.state.hoveredRegion;
        const isLocked = region.locked || false;
        const isVisible = region.visible !== false;
        const lockIcon = isLocked ? '🔒' : '🔓';
        const visibilityIcon = isVisible ? '👁' : '👁‍🗨';

        // Generate thumbnail based on layer type
        let thumbnailHtml = '';
        if (region.type === 'image' && region.data?.imageUrl) {
          thumbnailHtml = `<div class="layer-thumbnail"><img src="${region.data.imageUrl}" /></div>`;
        } else if (region.type === 'shape-overlay') {
          const shapeIcon = region.shape?.type === 'polygon' ? '▲' : '■';
          thumbnailHtml = `<div class="layer-thumbnail"><span class="layer-thumbnail-icon">${shapeIcon}</span></div>`;
        } else {
          thumbnailHtml = `<div class="layer-thumbnail"><span class="layer-thumbnail-icon">□</span></div>`;
        }

        return `
          <div class="region-item ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${isLocked ? 'locked' : ''} ${!isVisible ? 'hidden' : ''}"
               data-idx="${idx}"
               data-region-type="${region.type}"
               draggable="true">
            <span class="visibility-icon" data-idx="${idx}" title="${isVisible ? 'Hide layer' : 'Show layer'}">${visibilityIcon}</span>
            <span class="lock-icon" data-idx="${idx}" title="${isLocked ? 'Unlock' : 'Lock'}">${lockIcon}</span>
            ${thumbnailHtml}
            <span class="region-name">${region.id}</span>
            <span class="region-type" data-type-value="${region.type}">${region.type}</span>
          </div>
        `;
      })
      .join("");

    // Add click handlers for region items with multi-select support
    listEl.querySelectorAll(".region-item").forEach((item) => {
      item.addEventListener("click", (e: Event) => {
        const target = e.target as HTMLElement;
        const mouseEvent = e as MouseEvent;

        // Don't select if clicking on control icons
        if (target.classList.contains('lock-icon') || target.classList.contains('visibility-icon')) {
          return;
        }

        const idx = parseInt((item as HTMLElement).dataset.idx || '0');
        const clickedRegion = this.state.regions[idx];

        // Multi-select in layer list
        if (mouseEvent.shiftKey) {
          // Shift+Click: Add to selection
          if (!this.state.selectedRegions.includes(clickedRegion)) {
            this.state.selectedRegions.push(clickedRegion);
            this.state.selectedRegion = clickedRegion;
            console.log(`[Editor] Layer Shift+Click: Added to selection (${this.state.selectedRegions.length} selected)`);
          }
        } else if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
          // Ctrl/Cmd+Click: Toggle selection
          const index = this.state.selectedRegions.indexOf(clickedRegion);
          if (index !== -1) {
            this.state.selectedRegions.splice(index, 1);
            if (this.state.selectedRegion === clickedRegion) {
              this.state.selectedRegion = this.state.selectedRegions[0] || null;
            }
            console.log(`[Editor] Layer Ctrl+Click: Removed from selection (${this.state.selectedRegions.length} selected)`);
          } else {
            this.state.selectedRegions.push(clickedRegion);
            this.state.selectedRegion = clickedRegion;
            console.log(`[Editor] Layer Ctrl+Click: Added to selection (${this.state.selectedRegions.length} selected)`);
          }
        } else {
          // Normal click: Single select
          this.selectRegion(clickedRegion);
        }

        this.updateAlignmentToolbar();
        this.renderRegionList();
        this.render();
      });
    });

    // Add click handlers for visibility icons
    listEl.querySelectorAll(".visibility-icon").forEach((icon) => {
      icon.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt((icon as HTMLElement).dataset.idx || '0');
        this.toggleVisibility(this.state.regions[idx]);
      });
    });

    // Add click handlers for lock icons
    listEl.querySelectorAll(".lock-icon").forEach((icon) => {
      icon.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt((icon as HTMLElement).dataset.idx || '0');
        this.toggleLock(this.state.regions[idx]);
      });
    });

    // Add drag-and-drop handlers for layer reordering
    listEl.querySelectorAll(".region-item").forEach((item) => {
      const htmlItem = item as HTMLElement;

      htmlItem.addEventListener("dragstart", (e) => {
        const idx = parseInt(htmlItem.dataset.idx || '0');
        this.draggedLayerIndex = idx;
        htmlItem.classList.add("dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
        console.log(`[Editor] Drag start: layer ${idx}`);
      });

      htmlItem.addEventListener("dragend", () => {
        htmlItem.classList.remove("dragging");
        // Remove all drop indicators
        listEl.querySelectorAll(".region-item").forEach(el => {
          el.classList.remove("drop-target-above", "drop-target-below");
        });
        this.draggedLayerIndex = null;
      });

      htmlItem.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (this.draggedLayerIndex === null) return;

        const targetIdx = parseInt(htmlItem.dataset.idx || '0');
        if (targetIdx === this.draggedLayerIndex) return;

        // Remove all drop indicators
        listEl.querySelectorAll(".region-item").forEach(el => {
          el.classList.remove("drop-target-above", "drop-target-below");
        });

        // Show drop indicator
        if (targetIdx < this.draggedLayerIndex) {
          htmlItem.classList.add("drop-target-above");
        } else {
          htmlItem.classList.add("drop-target-below");
        }

        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "move";
        }
      });

      htmlItem.addEventListener("drop", (e) => {
        e.preventDefault();
        if (this.draggedLayerIndex === null) return;

        const targetIdx = parseInt(htmlItem.dataset.idx || '0');
        if (targetIdx === this.draggedLayerIndex) return;

        console.log(`[Editor] Drop: moving layer ${this.draggedLayerIndex} to ${targetIdx}`);

        // Reorder regions array
        const draggedRegion = this.state.regions[this.draggedLayerIndex];
        this.state.regions.splice(this.draggedLayerIndex, 1);

        // Adjust target index if dragging from earlier position
        const newTargetIdx = this.draggedLayerIndex < targetIdx ? targetIdx : targetIdx;
        this.state.regions.splice(newTargetIdx, 0, draggedRegion);

        this.saveHistory();
        this.renderRegionList();
        this.render();

        console.log(`[Editor] Layer reordered - new order:`, this.state.regions.map(r => r.id));
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

    // Apply zoom and pan transform for all drawing operations
    this.ctx.save();
    this.ctx.setTransform(this.state.zoom, 0, 0, this.state.zoom, this.state.panX, this.state.panY);

    // Draw grid if snap is enabled (EDIT MODE ONLY)
    if (this.state.snapToGrid && this.state.chromeImage) {
      this.ctx.strokeStyle = "rgba(100, 100, 100, 0.2)";
      this.ctx.lineWidth = 1 / this.state.zoom;
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
      // Skip locked or hidden regions - don't draw any editor decorations
      if (region.locked || region.visible === false) {
        return;
      }

      const isSelected = this.state.selectedRegions.includes(region);
      const isHovered = region === this.state.hoveredRegion;

      // Region overlay with different colors based on type
      let fillColor = "rgba(0, 100, 255, 0.15)";
      let strokeColor = "#0064ff";

      if (isSelected) {
        fillColor = "rgba(0, 255, 0, 0.2)";
        strokeColor = "#00ff00";
      } else if (isHovered) {
        fillColor = "rgba(0, 170, 255, 0.2)";
        strokeColor = "#00aaff";
      } else if (region.type === 'image') {
        fillColor = "rgba(255, 100, 0, 0.1)";
        strokeColor = "#ff6400";
      } else if (region.type === 'shape-overlay') {
        fillColor = "rgba(255, 0, 255, 0.1)";
        strokeColor = "#ff00ff";
      }

      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(region.rect.x, region.rect.y, region.rect.width, region.rect.height);

      // Border
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = (isSelected ? 3 : (isHovered ? 2 : 1)) / this.state.zoom;
      this.ctx.strokeRect(region.rect.x, region.rect.y, region.rect.width, region.rect.height);

      // Label with background for better readability
      const labelBgHeight = 36;
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(region.rect.x, region.rect.y, Math.min(region.rect.width, 200), labelBgHeight);

      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = `${12 / this.state.zoom}px monospace`;
      this.ctx.fillText(region.id, region.rect.x + 4, region.rect.y + 16);
      this.ctx.font = `${10 / this.state.zoom}px monospace`;
      this.ctx.fillStyle = "#aaaaaa";
      this.ctx.fillText(region.type, region.rect.x + 4, region.rect.y + 30);

      // Draw resize handles for primary selected region only
      if (region === this.state.selectedRegion) {
        this.drawResizeHandles(region);
      }
    });

    // Restore canvas transform
    this.ctx.restore();
  }

  private renderRegionDOMs(): void {
    // Count how many .region-layer elements exist
    const existingCount = this.canvasStage.querySelectorAll('.region-layer').length;

    // Update positions of existing region DOMs instead of recreating them
    this.state.regions.forEach((region) => {
      const container = this.canvasStage.querySelector(`[data-region-id="${region.id}"]`) as HTMLElement;
      const existingType = container?.getAttribute('data-region-type');
      const existingShapeType = container?.getAttribute('data-shape-type');

      // If type or shape type changed, remove old container and create new one
      const needsRecreate = container && (
        (existingType && existingType !== region.type) ||
        (region.type === 'shape-overlay' && existingShapeType && existingShapeType !== region.shape?.type)
      );

      if (needsRecreate) {
        container.remove();
        // Find and remove cleanup function for this region
        const regionIndex = this.regionCleanups.findIndex((_, idx) => {
          const allContainers = Array.from(this.canvasStage.querySelectorAll('.region-layer'));
          return allContainers[idx] === container;
        });
        if (regionIndex !== -1) {
          this.regionCleanups[regionIndex]();
          this.regionCleanups.splice(regionIndex, 1);
        }
      }

      const existingContainer = this.canvasStage.querySelector(`[data-region-id="${region.id}"]`) as HTMLElement;

      if (existingContainer) {
        // Update existing container position/size/visibility
        existingContainer.style.left = `${region.rect.x}px`;
        existingContainer.style.top = `${region.rect.y}px`;
        existingContainer.style.width = `${region.rect.width}px`;
        existingContainer.style.height = `${region.rect.height}px`;
        existingContainer.style.zIndex = (region.zIndex !== undefined ? region.zIndex : 5).toString();
        existingContainer.style.display = (region.visible === false) ? 'none' : 'block';
        existingContainer.setAttribute('data-region-type', region.type);

        // Update shape properties if this is a shape-overlay
        if (region.type === 'shape-overlay' && region.shape) {
          existingContainer.setAttribute('data-shape-type', region.shape.type);
          const fillColor = region.shape.fillColor || '#ff0000';
          const strokeColor = region.shape.strokeColor || 'transparent';
          const strokeWidth = region.shape.strokeWidth || 0;
          const opacity = region.shape.opacity !== undefined ? region.shape.opacity : 0.5;

          if (region.shape.type === 'rectangle') {
            existingContainer.style.background = fillColor;
            existingContainer.style.border = strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none';
            existingContainer.style.opacity = opacity.toString();
            existingContainer.style.boxSizing = 'border-box';
            existingContainer.style.borderRadius = '';
          } else if (region.shape.type === 'circle') {
            existingContainer.style.background = fillColor;
            existingContainer.style.border = strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none';
            existingContainer.style.opacity = opacity.toString();
            existingContainer.style.boxSizing = 'border-box';
            existingContainer.style.borderRadius = '50%';
          } else if (region.shape.type === 'polygon') {
            // Update SVG polygon attributes
            const svg = existingContainer.querySelector('svg');
            const polygon = svg?.querySelector('polygon');
            if (polygon) {
              polygon.setAttribute('fill', fillColor);
              polygon.setAttribute('stroke', strokeColor);
              polygon.setAttribute('stroke-width', strokeWidth.toString());
              polygon.setAttribute('opacity', opacity.toString());
            }
          }
        }
      } else {
        // Create new region DOM
        console.log(`[Editor] Creating new DOM for region: ${region.id}, type: ${region.type}`);
        const renderer = regionRegistry.get(region.type);
        console.log(`[Editor] Renderer for ${region.type}:`, renderer ? 'FOUND' : 'NOT FOUND');
        if (!renderer || !this.dataSource) {
          console.warn(`[Editor] No renderer found for region type: ${region.type} (region id: ${region.id})`);
          return;
        }

        const newContainer = document.createElement("div");
        newContainer.className = "region-layer";
        newContainer.dataset.regionId = region.id;
        newContainer.setAttribute('data-region-type', region.type);
        if (region.type === 'shape-overlay' && region.shape) {
          newContainer.setAttribute('data-shape-type', region.shape.type);
        }
        newContainer.style.position = "absolute";
        newContainer.style.left = `${region.rect.x}px`;
        newContainer.style.top = `${region.rect.y}px`;
        newContainer.style.width = `${region.rect.width}px`;
        newContainer.style.height = `${region.rect.height}px`;
        newContainer.style.overflow = "hidden";
        newContainer.style.boxSizing = "border-box";
        newContainer.style.pointerEvents = "auto";
        newContainer.style.zIndex = (region.zIndex !== undefined ? region.zIndex : 5).toString();

        const cleanup = renderer.mount(newContainer, region, this.dataSource);
        this.regionCleanups.push(cleanup);

        this.canvasStage.appendChild(newContainer);
      }
    });

    // Remove any region DOMs that no longer exist in state
    const allRegionContainers = this.canvasStage.querySelectorAll('.region-layer');
    allRegionContainers.forEach(container => {
      const regionId = (container as HTMLElement).dataset.regionId;
      const exists = this.state.regions.some(r => r.id === regionId);
      if (!exists) {
        console.log(`[Editor] Removing orphaned DOM for region: ${regionId}`);
        container.remove();
      }
    });

    const finalCount = this.canvasStage.querySelectorAll('.region-layer').length;
    if (finalCount !== this.state.regions.length) {
      console.warn(`[Editor] DOM count mismatch! Expected ${this.state.regions.length}, got ${finalCount}`);
      console.warn(`[Editor] Region IDs in state:`, this.state.regions.map(r => r.id));
      console.warn(`[Editor] Region IDs in DOM:`, Array.from(this.canvasStage.querySelectorAll('.region-layer')).map(el => (el as HTMLElement).dataset.regionId));
    }
  }

  private drawResizeHandles(region: Region): void {
    const r = region.rect;
    const h = this.HANDLE_SIZE / this.state.zoom;

    this.ctx.fillStyle = "#00ff00";
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1 / this.state.zoom;

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

  private handleCanvasWheel(e: WheelEvent): void {
    if (this.state.previewMode) return;

    // Zoom with Ctrl/Cmd + Scroll
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate mouse position in world coordinates before zoom
      const worldX = (mouseX - this.state.panX) / this.state.zoom;
      const worldY = (mouseY - this.state.panY) / this.state.zoom;

      // Update zoom
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.state.zoom * zoomDelta));

      // Adjust pan to keep mouse position fixed
      this.state.panX = mouseX - worldX * newZoom;
      this.state.panY = mouseY - worldY * newZoom;
      this.state.zoom = newZoom;

      this.render();
      this.updateZoomDisplay();

      console.log(`[Editor] Zoom: ${(this.state.zoom * 100).toFixed(0)}%`);
    }
  }

  private updateZoomDisplay(): void {
    const coordsDisplay = document.getElementById("mouse-coords");
    if (coordsDisplay) {
      const zoomPercent = Math.round(this.state.zoom * 100);
      const currentText = coordsDisplay.textContent || "";
      const coordsPart = currentText.split(" | ")[0] || currentText;
      coordsDisplay.textContent = `${coordsPart} | Zoom: ${zoomPercent}%`;
    }
  }

  private updateAlignmentToolbar(): void {
    const toolbar = document.getElementById("alignment-toolbar");
    if (toolbar) {
      if (this.state.selectedRegions.length >= 2) {
        toolbar.style.display = "flex";
      } else {
        toolbar.style.display = "none";
      }
    }
  }

  private alignSelectedRegions(alignment: string): void {
    if (this.state.selectedRegions.length < 2) {
      console.log("[Editor] Need at least 2 regions selected for alignment");
      return;
    }

    console.log(`[Editor] Aligning ${this.state.selectedRegions.length} regions: ${alignment}`);

    const regions = this.state.selectedRegions;

    switch (alignment) {
      case "left": {
        const minX = Math.min(...regions.map(r => r.rect.x));
        regions.forEach(r => r.rect.x = minX);
        break;
      }
      case "right": {
        const maxRight = Math.max(...regions.map(r => r.rect.x + r.rect.width));
        regions.forEach(r => r.rect.x = maxRight - r.rect.width);
        break;
      }
      case "top": {
        const minY = Math.min(...regions.map(r => r.rect.y));
        regions.forEach(r => r.rect.y = minY);
        break;
      }
      case "bottom": {
        const maxBottom = Math.max(...regions.map(r => r.rect.y + r.rect.height));
        regions.forEach(r => r.rect.y = maxBottom - r.rect.height);
        break;
      }
      case "center-h": {
        const allCenters = regions.map(r => r.rect.x + r.rect.width / 2);
        const avgCenter = allCenters.reduce((a, b) => a + b, 0) / allCenters.length;
        regions.forEach(r => r.rect.x = avgCenter - r.rect.width / 2);
        break;
      }
      case "center-v": {
        const allCenters = regions.map(r => r.rect.y + r.rect.height / 2);
        const avgCenter = allCenters.reduce((a, b) => a + b, 0) / allCenters.length;
        regions.forEach(r => r.rect.y = avgCenter - r.rect.height / 2);
        break;
      }
    }

    this.saveHistory();
    this.updatePropertiesPanel();
    this.render();
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

  /**
   * Convert an image URL (blob or data URI) to a base64 data URI
   */
  private async imageToDataUri(url: string): Promise<string> {
    // If already a data URI, return as-is
    if (url.startsWith('data:')) {
      return url;
    }

    // If it's a blob URL, fetch and convert to data URI
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        try {
          const dataUri = canvas.toDataURL('image/png');
          resolve(dataUri);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
    });
  }

  private async exportManifest(): Promise<void> {
    if (!this.state.chromeImage) {
      alert("Please load a chrome image first");
      return;
    }

    console.log("[Editor] Exporting skin bundle with embedded images...");

    try {
      // Convert chrome image to base64 data URI
      const chromeDataUri = await this.imageToDataUri(this.state.chromeImage.src);
      console.log("[Editor] Chrome image converted:", chromeDataUri.substring(0, 50) + '...');

      // Process regions and embed image data URIs
      const regionsWithEmbeddedImages = await Promise.all(
        this.state.regions.map(async (region) => {
          if (region.type === 'image' && region.data?.imageUrl) {
            // Convert blob URL or ensure it's a data URI
            const imageDataUri = await this.imageToDataUri(region.data.imageUrl);
            console.log(`[Editor] Region ${region.id} image converted:`, imageDataUri.substring(0, 50) + '...');

            return {
              ...region,
              data: {
                imageUrl: imageDataUri,
              },
            };
          }
          return region;
        })
      );

      const manifest: SkinManifest = {
        id: "custom-skin",
        name: "Custom Skin",
        version: "1.0.0",
        visual: {
          width: this.state.chromeImage.width,
          height: this.state.chromeImage.height,
          chromeImage: chromeDataUri,
        },
        regions: regionsWithEmbeddedImages,
        actions: [],
      };

      const json = JSON.stringify(manifest, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "skin-bundle.json";
      a.click();

      URL.revokeObjectURL(url);

      console.log("[Editor] Exported skin bundle with", this.state.regions.length, "regions");
      console.log("[Editor] Chrome image size:", chromeDataUri.length, "bytes");
      console.log("[Editor] Total bundle size:", json.length, "bytes");

      alert(`Skin bundle exported successfully!\n\nBundle size: ${(json.length / 1024).toFixed(1)} KB\nRegions: ${this.state.regions.length}`);
    } catch (error) {
      console.error("[Editor] Failed to export skin bundle:", error);
      alert(`Failed to export skin bundle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enter rectangle drawing mode
   */
  private enterRectangleMode(): void {
    this.state.drawMode = "rectangle";
    this.polygonMode = false;
    this.state.polygonPoints = [];

    // Update button states
    document.getElementById("draw-rectangle")?.classList.add("active");
    document.getElementById("draw-polygon")?.classList.remove("active");

    let isDrawingRect = false;
    let startPoint: { x: number; y: number } | null = null;
    let tempRect: FabricRect | null = null;

    // Mouse down - start rectangle
    this.fabricCanvas.on('mouse:down', (options) => {
      if (this.state.drawMode !== "rectangle") return;

      const pointer = this.fabricCanvas.getPointer(options.e);
      startPoint = {
        x: Math.round(pointer.x),
        y: Math.round(pointer.y)
      };
      isDrawingRect = true;

      // Create temporary rectangle
      tempRect = new FabricRect({
        left: startPoint.x,
        top: startPoint.y,
        width: 0,
        height: 0,
        fill: 'rgba(255, 0, 0, 0.3)',
        stroke: '#00aaff',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      this.fabricCanvas.add(tempRect);
    });

    // Mouse move - resize rectangle
    this.fabricCanvas.on('mouse:move', (options) => {
      if (!isDrawingRect || !startPoint || !tempRect) return;

      const pointer = this.fabricCanvas.getPointer(options.e);
      const currentX = Math.round(pointer.x);
      const currentY = Math.round(pointer.y);

      const width = currentX - startPoint.x;
      const height = currentY - startPoint.y;

      // Update rectangle - handle negative dimensions
      if (width >= 0) {
        tempRect.set({ left: startPoint.x, width: width });
      } else {
        tempRect.set({ left: currentX, width: Math.abs(width) });
      }

      if (height >= 0) {
        tempRect.set({ top: startPoint.y, height: height });
      } else {
        tempRect.set({ top: currentY, height: Math.abs(height) });
      }

      this.fabricCanvas.renderAll();
    });

    // Mouse up - finish rectangle
    this.fabricCanvas.on('mouse:up', () => {
      if (!isDrawingRect || !startPoint || !tempRect) return;

      isDrawingRect = false;

      // Check if rectangle has valid size
      const width = tempRect.width || 0;
      const height = tempRect.height || 0;

      if (width < 5 || height < 5) {
        // Too small, remove it
        this.fabricCanvas.remove(tempRect);
        console.log("[Editor] Rectangle too small, discarding");
        return;
      }

      // Remove temporary rectangle
      this.fabricCanvas.remove(tempRect);

      // Create final rectangle shape
      const finalRect = new FabricRect({
        left: tempRect.left,
        top: tempRect.top,
        width: width,
        height: height,
        fill: 'rgba(255, 0, 0, 0.5)',
        stroke: '#000000',
        strokeWidth: 2,
        selectable: true,
        evented: true,
      });
      this.fabricCanvas.add(finalRect);

      // Create region
      const region: Region = {
        id: `shape-${Date.now()}`,
        type: "shape-overlay",
        rect: {
          x: Math.round(tempRect.left || 0),
          y: Math.round(tempRect.top || 0),
          width: Math.round(width),
          height: Math.round(height)
        },
        zIndex: 100,
        shape: {
          type: "rectangle",
          fillColor: "#ff0000",
          strokeColor: "#000000",
          strokeWidth: 2,
          opacity: 0.5
        }
      };

      this.state.regions.push(region);
      this.saveHistory();
      this.renderRegionList();
      this.selectRegion(region);

      // DON'T exit drawing mode - stay in rectangle mode for next shape
      // User can press ESC or click another tool to exit
      // Reset drawing state for next rectangle
      startPoint = null;
      tempRect = null;

      console.log("[Editor] Created rectangle shape at", region.rect);
    });

    console.log("[Editor] Entered rectangle drawing mode - drag to create rectangles (ESC or V to exit)");
  }

  /**
   * Enter polygon drawing mode
   */
  private enterPolygonMode(): void {
    this.state.drawMode = "polygon";
    this.polygonMode = true;
    this.state.polygonPoints = [];

    // Update button states
    document.getElementById("draw-polygon")?.classList.add("active");
    document.getElementById("draw-rectangle")?.classList.remove("active");

    // Set up polygon drawing with Fabric.js
    this.fabricCanvas.on('mouse:down', (options) => {
      if (!this.polygonMode) return;

      const pointer = this.fabricCanvas.getPointer(options.e);
      const point = {
        x: Math.round(pointer.x),
        y: Math.round(pointer.y)
      };

      this.state.polygonPoints.push(point);

      // Visual feedback - add a small circle at each point
      const circle = new FabricRect({
        left: point.x - 3,
        top: point.y - 3,
        width: 6,
        height: 6,
        fill: '#00aaff',
        selectable: false,
        evented: false,
      });
      this.fabricCanvas.add(circle);

      console.log(`[Editor] Added polygon point: (${point.x}, ${point.y})`);
    });

    // Double-click to finish polygon
    this.fabricCanvas.on('mouse:dblclick', () => {
      if (this.polygonMode && this.state.polygonPoints.length >= 3) {
        this.finishPolygon();
      }
    });

    console.log("[Editor] Entered polygon drawing mode - click to add points, double-click to finish");
  }

  /**
   * Finish drawing polygon and create shape region
   */
  private finishPolygon(): void {
    if (this.state.polygonPoints.length < 3) {
      alert("A polygon needs at least 3 points");
      return;
    }

    // Calculate bounding box
    const xs = this.state.polygonPoints.map(p => p.x);
    const ys = this.state.polygonPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    // Convert points to be relative to bounding box
    const relativePoints = this.state.polygonPoints.map(p => ({
      x: p.x - minX,
      y: p.y - minY
    }));

    // Create the polygon shape
    const polygon = new FabricPolygon(this.state.polygonPoints, {
      fill: 'rgba(255, 0, 0, 0.5)',
      stroke: '#000000',
      strokeWidth: 2,
      selectable: true,
      evented: true,
    });

    this.fabricCanvas.add(polygon);

    // Clear visual feedback circles
    this.fabricCanvas.getObjects().forEach(obj => {
      if (obj.width === 6 && obj.height === 6) {
        this.fabricCanvas.remove(obj);
      }
    });

    // Create region
    const region: Region = {
      id: `shape-${Date.now()}`,
      type: "shape-overlay",
      rect: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      zIndex: 100,
      shape: {
        type: "polygon",
        fillColor: "#ff0000",
        strokeColor: "#000000",
        strokeWidth: 2,
        opacity: 0.5,
        points: relativePoints
      }
    };

    this.state.regions.push(region);
    this.saveHistory();
    this.renderRegionList();
    this.selectRegion(region);

    // DON'T exit polygon mode - stay in polygon mode for next shape
    // User can press ESC or click another tool to exit
    // Reset polygon state for next polygon
    this.state.polygonPoints = [];

    console.log("[Editor] Created polygon shape with", relativePoints.length, "points - ready for next polygon (ESC or V to exit)");
  }

  /**
   * Exit drawing mode
   */
  private exitDrawMode(): void {
    this.state.drawMode = null;
    this.polygonMode = false;
    this.state.polygonPoints = [];

    // Remove button active states
    document.getElementById("draw-rectangle")?.classList.remove("active");
    document.getElementById("draw-polygon")?.classList.remove("active");

    // Remove all Fabric event listeners
    this.fabricCanvas.off('mouse:down');
    this.fabricCanvas.off('mouse:move');
    this.fabricCanvas.off('mouse:up');
    this.fabricCanvas.off('mouse:dblclick');

    console.log("[Editor] Exited drawing mode");
  }
}

// Initialize editor when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  new SkinEditor();
  console.log("[Editor] Skin Editor initialized with advanced features");
});
