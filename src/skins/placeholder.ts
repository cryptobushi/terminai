/**
 * Placeholder skin - a colored blob shape.
 * This demonstrates the SkinManifest interface with a hardcoded implementation.
 * Future skins will be loaded from .wmz files, but this proves the architecture.
 */

import type { SkinManifest } from "../types";

export const placeholderSkin: SkinManifest = {
  id: "placeholder-blob",
  name: "Placeholder Blob",
  version: "0.1.0",

  visual: {
    width: 600,
    height: 400,
    // Rounded blob shape using CSS clip-path
    shape: `polygon(
      10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%
    )`,
    // Gradient background
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    backgroundImage: undefined,
  },

  terminalRegion: {
    x: 40,
    y: 80,
    width: 520,
    height: 280,
  },

  actions: [
    {
      id: "minimize",
      label: "Minimize",
      position: { x: 520, y: 20 },
    },
    {
      id: "close",
      label: "Close",
      position: { x: 560, y: 20 },
    },
  ],
};
