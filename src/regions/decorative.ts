/**
 * Decorative region renderer
 * No-op renderer - region exists for layout but renders nothing on top
 */

import type { RegionRenderer } from "./types";

export const decorativeRenderer: RegionRenderer = {
  mount(): () => void {
    // No-op: decorative regions show only the chrome bitmap underneath
    return () => {
      // No cleanup needed
    };
  },
};
