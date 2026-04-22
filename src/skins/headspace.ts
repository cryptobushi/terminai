/**
 * Headspace skin - loaded from converted .wmz format
 * Day 5: Extended with multi-region layout
 */

import type { SkinManifest } from "../types";

// Hardcoded manifest data for Headspace
export const headspaceSkin: SkinManifest = {
  id: "headspace",
  name: "Headspace Beta",
  version: "1.0.0",

  visual: {
    width: 760,
    height: 394,
    chromeImage: "/skins/headspace/chrome.png",
  },

  regions: [
    // Main terminal in the display area (forehead)
    {
      id: "main-terminal",
      type: "terminal",
      rect: {
        x: 275,
        y: 72,
        width: 208,
        height: 132,
      },
      zIndex: 10,
    },

    // Left speakers - memory context
    {
      id: "left-memory",
      type: "memory-context",
      rect: {
        x: 215,
        y: 100,
        width: 50,
        height: 210,
      },
      zIndex: 5,
    },

    // Right speakers - activity feed
    {
      id: "right-activity",
      type: "activity-feed",
      rect: {
        x: 495,
        y: 100,
        width: 50,
        height: 210,
      },
      zIndex: 5,
    },

    // Status bar below display
    {
      id: "status-bar",
      type: "agent-status",
      rect: {
        x: 270,
        y: 210,
        width: 220,
        height: 18,
      },
      zIndex: 10,
    },

    // Transport buttons area (decorative for now)
    {
      id: "transport",
      type: "decorative",
      rect: {
        x: 261,
        y: 31,
        width: 160,
        height: 25,
      },
    },
  ],

  actions: [
    {
      id: "minimize",
      label: "Minimize",
      position: { x: 362, y: 4 },
    },
    {
      id: "close",
      label: "Close",
      position: { x: 382, y: 4 },
    },
  ],
};
