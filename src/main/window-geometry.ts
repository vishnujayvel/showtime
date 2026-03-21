/**
 * Pure geometry functions for anchor-based window positioning.
 * Extracted from index.ts for testability.
 */

export interface Point { x: number; y: number }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Dims { width: number; height: number }

/**
 * Compute the center-bottom anchor point from a window's bounds.
 */
export function computeAnchorFromBounds(bounds: Bounds): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
}

/**
 * Compute window bounds from a center-bottom anchor point and dimensions.
 */
export function computeBoundsFromAnchor(anchor: Point, dims: Dims): Bounds {
  return {
    x: Math.round(anchor.x - dims.width / 2),
    y: Math.round(anchor.y - dims.height),
    width: dims.width,
    height: dims.height,
  }
}

/**
 * Clamp bounds so the window stays within a work area.
 */
export function clampToWorkArea(bounds: Bounds, workArea: Bounds): Bounds {
  return {
    x: Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - bounds.width)),
    y: Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - bounds.height)),
    width: bounds.width,
    height: bounds.height,
  }
}
