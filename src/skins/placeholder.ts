/**
 * Placeholder skin - a lumpy, non-rectangular blob shape.
 * This demonstrates the SkinManifest interface with a hardcoded implementation.
 * Future skins will be loaded from .wmz files, but this proves the architecture.
 *
 * The irregular shape tests whether macOS honors non-rectangular transparent windows
 * for both rendering and input events - critical for WMP skin support.
 */

import type { SkinManifest } from "../types";

export const placeholderSkin: SkinManifest = {
  id: "placeholder-blob",
  name: "Placeholder Blob",
  version: "0.1.0",

  visual: {
    width: 600,
    height: 400,
    // Lumpy organic blob with 8 irregular points - obviously non-rectangular
    shape: `polygon(
      5% 15%,
      15% 2%,
      35% 0%,
      60% 5%,
      85% 8%,
      98% 25%,
      100% 50%,
      95% 75%,
      88% 92%,
      70% 100%,
      40% 98%,
      18% 95%,
      3% 80%,
      0% 50%,
      2% 30%
    )`,
    // Gradient background
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    backgroundImage: undefined,
  },

  terminalRegion: {
    x: 50,
    y: 80,
    width: 500,
    height: 260,
  },

  actions: [
    {
      id: "minimize",
      label: "−",
      position: { x: 520, y: 30 },
    },
    {
      id: "close",
      label: "×",
      position: { x: 560, y: 30 },
    },
  ],
};
