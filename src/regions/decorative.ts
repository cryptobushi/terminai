import type { RegionRenderer } from "./types";

export const decorativeRenderer: RegionRenderer = {
  mount(): () => void {
    return () => {};
  },
};
