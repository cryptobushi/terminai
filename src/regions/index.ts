/**
 * Region renderers - register all built-in renderers
 */

import { regionRegistry } from "./registry";
import { terminalRenderer } from "./terminal";
import { agentStatusRenderer } from "./agent-status";
import { activityFeedRenderer } from "./activity-feed";
import { memoryContextRenderer } from "./memory-context";
import { decorativeRenderer } from "./decorative";
import { imageRenderer } from "./image";
import { shapeOverlayRenderer } from "./shape-overlay";

// Register all built-in renderers
export function registerBuiltInRenderers(): void {
  regionRegistry.register("terminal", terminalRenderer);
  regionRegistry.register("agent-status", agentStatusRenderer);
  regionRegistry.register("activity-feed", activityFeedRenderer);
  regionRegistry.register("memory-context", memoryContextRenderer);
  regionRegistry.register("decorative", decorativeRenderer);
  regionRegistry.register("image", imageRenderer);
  regionRegistry.register("shape-overlay", shapeOverlayRenderer);
}

export { regionRegistry } from "./registry";
export type { RegionRenderer } from "./types";
