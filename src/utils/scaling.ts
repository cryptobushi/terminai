/**
 * Utility functions for aspect ratio and scaling calculations
 */

/**
 * Calculate the scale factor to fit content with a given aspect ratio into a window
 * while maintaining the aspect ratio
 *
 * @param contentWidth - Native width of the content
 * @param contentHeight - Native height of the content
 * @param windowWidth - Width of the window to fit into
 * @param windowHeight - Height of the window to fit into
 * @returns Scale factor to apply to the content
 */
export function calculateFitScale(
  contentWidth: number,
  contentHeight: number,
  windowWidth: number = window.innerWidth,
  windowHeight: number = window.innerHeight
): number {
  const contentAspect = contentWidth / contentHeight;
  const windowAspect = windowWidth / windowHeight;

  if (windowAspect > contentAspect) {
    // Window is wider than content - fit to height
    return windowHeight / contentHeight;
  } else {
    // Window is taller than content - fit to width
    return windowWidth / contentWidth;
  }
}
