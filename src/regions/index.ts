/**
 * Region renderers - register all built-in renderers
 */

import { regionRegistry } from "./registry";
import { terminalRenderer } from "./terminal";
import { agentStatusRenderer } from "./agent-status";
import { activityFeedRenderer } from "./activity-feed";
import { memoryContextRenderer } from "./memory-context";
import { decorativeRenderer } from "./decorative";

// Register all built-in renderers
export function registerBuiltInRenderers(): void {
  regionRegistry.register("terminal", terminalRenderer);
  regionRegistry.register("agent-status", agentStatusRenderer);
  regionRegistry.register("activity-feed", activityFeedRenderer);
  regionRegistry.register("memory-context", memoryContextRenderer);
  regionRegistry.register("decorative", decorativeRenderer);
}

export { regionRegistry } from "./registry";
export type { RegionRenderer } from "./types";
