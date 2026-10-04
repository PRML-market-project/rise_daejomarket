type Point = { x: number; y: number };
type Size = { width: number; height: number };
export type LocationTail = "bottom" | "left" | "top" | "right";

// Figma 585:28892 / 585:28895, relative to the 6807 × 10577 map.
// This is the arrow tip, not the label centre or the camera centre.
export const CURRENT_LOCATION = { x: 5036, y: 4253 + 26 + 18 / Math.SQRT2 };
export const LOCATION_LABEL = { width: 173, height: 78, tailLength: 16, tipY: 26 + 18 / Math.SQRT2 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Pointer events use physical screen pixels; SVG and overlays use layout pixels.
export function getLocalMapPoint(point: Point, rect: { left: number; top: number; width: number; height: number }, viewport: Size): Point {
  return {
    x: (point.x - rect.left) * viewport.width / Math.max(rect.width, 1),
    y: (point.y - rect.top) * viewport.height / Math.max(rect.height, 1),
  };
}

export function getLocationMarkerPosition(origin: Point, center: Point, scale: number, viewport: Size, bubble: Size, bottomOverlayHeight: number, topOverlayHeight = 0) {
  const gap = 8;
  const tail = LOCATION_LABEL.tailLength * scale;
  const projected = {
    x: viewport.width / 2 + (origin.x - center.x) * scale,
    y: viewport.height / 2 + (origin.y - center.y) * scale,
  };
  const top = clamp(topOverlayHeight, 0, viewport.height);
  const bottom = Math.max(top, viewport.height - bottomOverlayHeight);
  const offscreen = projected.x < 0 || projected.x > viewport.width || projected.y < top || projected.y > bottom;

  if (!offscreen) {
    // Every pointer attaches to the centre of one of the four label edges.
    // Choose a side that fits while keeping the tip on the same map point.
    const candidates = [
      { x: projected.x + tail, y: projected.y - bubble.height / 2, side: "left" as const, angle: 180 },
      { x: projected.x - tail - bubble.width, y: projected.y - bubble.height / 2, side: "right" as const, angle: 0 },
      { x: projected.x - bubble.width / 2, y: projected.y + tail, side: "top" as const, angle: -90 },
      { x: projected.x - bubble.width / 2, y: projected.y - tail - bubble.height, side: "bottom" as const, angle: 90 },
    ];
    const fitting = candidates.find(p => p.x >= gap && p.x + bubble.width <= viewport.width - gap && p.y >= top + gap && p.y + bubble.height <= bottom - gap);
    if (fitting) return { ...fitting, offscreen, projected, arrowTip: projected };
    // At a corner, use the edge indicator instead of sliding the arrow away
    // from the label's centre or hiding the label under an overlay.
  }

  // Keep following the original map point, but snap the pointer to the side
  // where the ray leaves the viewport rather than rotating it continuously.
  const focus = { x: viewport.width / 2, y: (top + bottom) / 2 };
  const dx = projected.x - focus.x;
  const dy = projected.y - focus.y;
  const halfWidth = bubble.width / 2;
  const halfHeight = bubble.height / 2;
  const minX = Math.min(focus.x, gap + halfWidth + tail);
  const maxX = Math.max(focus.x, viewport.width - gap - halfWidth - tail);
  const minY = Math.min(focus.y, top + gap + halfHeight + tail);
  const maxY = Math.max(focus.y, bottom - gap - halfHeight - tail);
  const tx = dx === 0 ? Infinity : ((dx > 0 ? maxX : minX) - focus.x) / dx;
  const ty = dy === 0 ? Infinity : ((dy > 0 ? maxY : minY) - focus.y) / dy;
  let progress = Math.min(tx, ty);
  let side: LocationTail = tx < ty ? (dx > 0 ? "right" : "left") : (dy > 0 ? "bottom" : "top");

  // Keep the complete marker outside the zoom controls without changing its ray.
  const controlsLeft = viewport.width - 120 - halfWidth - tail - gap;
  const controlsTop = bottom - 184 - halfHeight - tail - gap;
  const enterX = dx > 0 ? Math.max(0, (controlsLeft - focus.x) / dx) : Infinity;
  const enterY = dy > 0 ? Math.max(0, (controlsTop - focus.y) / dy) : (focus.y >= controlsTop ? 0 : Infinity);
  const controlsEntry = Math.max(enterX, enterY);
  if (controlsEntry < progress && controlsEntry > 0) {
    progress = controlsEntry;
    side = enterX > enterY ? "right" : "bottom";
  }

  const markerCenter = { x: focus.x + dx * progress, y: focus.y + dy * progress };
  const directions = {
    left: { angle: 180, x: -halfWidth - tail, y: 0 },
    right: { angle: 0, x: halfWidth + tail, y: 0 },
    top: { angle: -90, x: 0, y: -halfHeight - tail },
    bottom: { angle: 90, x: 0, y: halfHeight + tail },
  };
  const direction = directions[side];
  return {
    x: markerCenter.x - halfWidth,
    y: markerCenter.y - halfHeight,
    side,
    angle: direction.angle,
    offscreen: true,
    projected,
    arrowTip: { x: markerCenter.x + direction.x, y: markerCenter.y + direction.y },
  };
}
