/**
 * Skin Bundle Loader
 *
 * Loads skin bundles exported from the online skin editor.
 * Bundles contain base64-encoded images embedded in the manifest.
 */

import type { SkinManifest } from "../types";

export class SkinBundleLoader {
  /**
   * Load a skin bundle from a JSON file
   */
  static async loadFromFile(file: File): Promise<SkinManifest> {
    const text = await file.text();
    const manifest = JSON.parse(text) as SkinManifest;

    console.log("[SkinBundleLoader] Loaded bundle:", manifest.name);
    console.log("[SkinBundleLoader] Dimensions:", manifest.visual.width, "x", manifest.visual.height);
    console.log("[SkinBundleLoader] Regions:", manifest.regions.length);

    // Validate the manifest
    this.validateManifest(manifest);

    return manifest;
  }

  /**
   * Load a skin bundle from a URL (for online skins)
   */
  static async loadFromURL(url: string): Promise<SkinManifest> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load skin from ${url}: ${response.statusText}`);
    }

    const manifest = await response.json() as SkinManifest;

    console.log("[SkinBundleLoader] Loaded bundle from URL:", url);
    console.log("[SkinBundleLoader] Skin:", manifest.name);

    this.validateManifest(manifest);

    return manifest;
  }

  /**
   * Validate that the manifest has all required fields
   */
  private static validateManifest(manifest: SkinManifest): void {
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error("Invalid skin bundle: missing required metadata");
    }

    if (!manifest.visual || !manifest.visual.width || !manifest.visual.height) {
      throw new Error("Invalid skin bundle: missing visual dimensions");
    }

    if (!manifest.regions || !Array.isArray(manifest.regions)) {
      throw new Error("Invalid skin bundle: missing or invalid regions array");
    }

    // Validate chrome image is a data URI if present
    if (manifest.visual.chromeImage) {
      if (!manifest.visual.chromeImage.startsWith("data:")) {
        console.warn("[SkinBundleLoader] Chrome image is not a data URI - may not work offline");
      }
    }

    // Validate image regions have embedded data
    manifest.regions.forEach((region, idx) => {
      if (region.type === "image") {
        if (!region.data || !('imageUrl' in region.data)) {
          throw new Error(`Invalid skin bundle: image region ${idx} missing imageUrl`);
        }
        if (!region.data.imageUrl.startsWith("data:")) {
          console.warn(`[SkinBundleLoader] Image region ${idx} is not a data URI - may not work offline`);
        }
      }
    });

    console.log("[SkinBundleLoader] Manifest validation passed");
  }

  /**
   * Save a skin bundle to localStorage for persistence
   */
  static saveToLocalStorage(manifest: SkinManifest, key: string = "terminai-custom-skin"): void {
    try {
      const json = JSON.stringify(manifest);
      localStorage.setItem(key, json);
      console.log("[SkinBundleLoader] Saved skin to localStorage:", key);
      console.log("[SkinBundleLoader] Bundle size:", (json.length / 1024).toFixed(2), "KB");
    } catch (e) {
      console.error("[SkinBundleLoader] Failed to save to localStorage:", e);
      throw new Error("Failed to save skin: bundle may be too large");
    }
  }

  /**
   * Load a skin bundle from localStorage
   */
  static loadFromLocalStorage(key: string = "terminai-custom-skin"): SkinManifest | null {
    try {
      const json = localStorage.getItem(key);
      if (!json) {
        return null;
      }

      const manifest = JSON.parse(json) as SkinManifest;
      console.log("[SkinBundleLoader] Loaded skin from localStorage:", manifest.name);
      return manifest;
    } catch (e) {
      console.error("[SkinBundleLoader] Failed to load from localStorage:", e);
      return null;
    }
  }
}
