/**
 * Shape Overlay Renderer - renders visual shapes (rectangles, polygons)
 */

import type { RegionRenderer } from "./types";

export const shapeOverlayRenderer: RegionRenderer = {
  mount(element: HTMLElement, region, dataSource): () => void {
    if (!region.shape) {
      return () => {};
    }

    const shape = region.shape;
    const fillColor = shape.fillColor || "#ff0000";
    const strokeColor = shape.strokeColor || "#000000";
    const strokeWidth = shape.strokeWidth || 2;
    const opacity = shape.opacity !== undefined ? shape.opacity : 0.5;

    if (shape.type === "rectangle") {
      // Rectangle shape - set individual style properties to preserve positioning
      element.style.background = fillColor;
      element.style.border = `${strokeWidth}px solid ${strokeColor}`;
      element.style.opacity = opacity.toString();
      element.style.boxSizing = "border-box";
    } else if (shape.type === "polygon" && shape.points && shape.points.length > 0) {
      // Polygon shape using SVG
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.style.position = "absolute";
      svg.style.top = "0";
      svg.style.left = "0";

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const points = shape.points.map(p => `${p.x},${p.y}`).join(" ");
      polygon.setAttribute("points", points);
      polygon.setAttribute("fill", fillColor);
      polygon.setAttribute("stroke", strokeColor);
      polygon.setAttribute("stroke-width", strokeWidth.toString());
      polygon.setAttribute("opacity", opacity.toString());

      svg.appendChild(polygon);
      element.appendChild(svg);
    }

    return () => {
      // Cleanup if needed
    };
  },
};
