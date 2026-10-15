type Point = { x: number; y: number };
type Size = { width: number; height: number };
export type LocationTail = "bottom" | "left" | "top" | "right";

export function reflectPointAcrossCenter(point: Point, center: Point): Point {
  return { x: 2 * center.x - point.x, y: 2 * center.y - point.y };
}

export const CURRENT_LOCATION_ICON_CENTER = { x: 4961 + 52 / 2, y: 4255 + 76 / 2 };
export const ORIGINAL_LOCATION_TIP = { x: 5036, y: 4253 + 26 + 18 / Math.SQRT2 };
// The original and reflected tips are alternative targets for a single label.
export const CURRENT_LOCATION = reflectPointAcrossCenter(ORIGINAL_LOCATION_TIP, CURRENT_LOCATION_ICON_CENTER);
export const LOCATION_LABEL = { width: 173, height: 78, tailLength: 16, tipY: 26 + 18 / Math.SQRT2 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Render one label, pointing at the nearer of the two symmetric targets. */
export function getCandidateMarkerPosition(origins: [Point, Point], center: Point, scale: number, viewport: Size, bubble: Size, bottomOverlayHeight: number, topOverlayHeight = 0, markerScale = scale, reserved: Array<Point & Size> = []) {
  const midpoint = { x: (origins[0].x + origins[1].x) / 2, y: (origins[0].y + origins[1].y) / 2 };
  const targets = origins.map(origin => ({ x: viewport.width / 2 + (origin.x - center.x) * scale, y: viewport.height / 2 + (origin.y - center.y) * scale }));
  const nearest = (position: Point) => {
    const labelCenter = { x: position.x + bubble.width / 2, y: position.y + bubble.height / 2 };
    return Math.hypot(targets[0].x - labelCenter.x, targets[0].y - labelCenter.y) <= Math.hypot(targets[1].x - labelCenter.x, targets[1].y - labelCenter.y) ? 0 : 1;
  };
  const initial = getLocationMarkerPosition(midpoint, center, scale, viewport, bubble, bottomOverlayHeight, topOverlayHeight, markerScale, reserved);
  const candidateIndex = nearest(initial);
  const anchored = getLocationMarkerPosition(origins[candidateIndex], center, scale, viewport, bubble, bottomOverlayHeight, topOverlayHeight, markerScale, reserved);
  if (nearest(anchored) === candidateIndex) return { ...anchored, candidateIndex };

  // If attaching directly would switch sides, keep the collision-free position
  // and rotate its pointer toward the nearer target without duplicating labels.
  const projected = targets[candidateIndex];
  const labelCenter = { x: initial.x + bubble.width / 2, y: initial.y + bubble.height / 2 };
  const angle = Math.atan2(projected.y - labelCenter.y, projected.x - labelCenter.x);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const horizontalRadius = bubble.width / 2 / Math.max(Math.abs(cos), 1e-8);
  const verticalRadius = bubble.height / 2 / Math.max(Math.abs(sin), 1e-8);
  const radius = Math.min(horizontalRadius, verticalRadius) + LOCATION_LABEL.tailLength * markerScale;
  const side: LocationTail = horizontalRadius < verticalRadius ? cos < 0 ? "left" : "right" : sin < 0 ? "top" : "bottom";
  return { ...initial, side, angle: angle * 180 / Math.PI, projected, candidateIndex,
    offscreen: projected.x < 0 || projected.x > viewport.width || projected.y < topOverlayHeight || projected.y > viewport.height - bottomOverlayHeight,
    arrowTip: { x: labelCenter.x + cos * radius, y: labelCenter.y + sin * radius } };
}

// Pointer events use physical screen pixels; SVG and overlays use layout pixels.
export function getLocalMapPoint(point: Point, rect: { left: number; top: number; width: number; height: number }, viewport: Size): Point {
  return {
    x: (point.x - rect.left) * viewport.width / Math.max(rect.width, 1),
    y: (point.y - rect.top) * viewport.height / Math.max(rect.height, 1),
  };
}

export function getLocationMarkerPosition(origin: Point, center: Point, scale: number, viewport: Size, bubble: Size, bottomOverlayHeight: number, topOverlayHeight = 0, markerScale = scale, reserved: Array<Point & Size> = []) {
  const gap = 8;
  const tail = LOCATION_LABEL.tailLength * markerScale;
  const projected = {
    x: viewport.width / 2 + (origin.x - center.x) * scale,
    y: viewport.height / 2 + (origin.y - center.y) * scale,
  };
  const top = clamp(topOverlayHeight, 0, viewport.height);
  const bottom = Math.max(top, viewport.height - bottomOverlayHeight);
  const offscreen = projected.x < 0 || projected.x > viewport.width || projected.y < top || projected.y > bottom;
  const clear = (p: Point) => reserved.every(rect => p.x + bubble.width + gap <= rect.x || p.x >= rect.x + rect.width + gap || p.y + bubble.height + gap <= rect.y || p.y >= rect.y + rect.height + gap);
  const fits = (p: Point) => p.x >= gap + tail && p.x + bubble.width <= viewport.width - gap - tail && p.y >= top + gap + tail && p.y + bubble.height <= bottom - gap - tail;

  if (!offscreen) {
    // Every pointer attaches to the centre of one of the four label edges.
    // Choose a side that fits while keeping the tip on the same map point.
    const candidates = [
      { x: projected.x + tail, y: projected.y - bubble.height / 2, side: "left" as const, angle: 180 },
      { x: projected.x - tail - bubble.width, y: projected.y - bubble.height / 2, side: "right" as const, angle: 0 },
      { x: projected.x - bubble.width / 2, y: projected.y + tail, side: "top" as const, angle: -90 },
      { x: projected.x - bubble.width / 2, y: projected.y - tail - bubble.height, side: "bottom" as const, angle: 90 },
    ];
    const fitting = candidates.find(p => fits(p) && clear(p));
    if (fitting) return { ...fitting, offscreen, projected, arrowTip: projected };
    // At a corner, use the edge indicator instead of sliding the arrow away
    // from the label's centre or hiding the label under an overlay.
  }

  // Keep the label inside the viewport along the ray to its actual map point.
  // Rotate the pointer continuously toward that point, including at corners.
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

  // Keep the complete marker outside the zoom controls without changing its ray.
  const controlsLeft = viewport.width - 120 - halfWidth - tail - gap;
  const controlsTop = bottom - 184 - halfHeight - tail - gap;
  const enterX = dx > 0 ? Math.max(0, (controlsLeft - focus.x) / dx) : Infinity;
  const enterY = dy > 0 ? Math.max(0, (controlsTop - focus.y) / dy) : (focus.y >= controlsTop ? 0 : Infinity);
  const controlsEntry = Math.max(enterX, enterY);
  if (controlsEntry < progress && controlsEntry > 0) {
    progress = controlsEntry;
  }

  if (!Number.isFinite(progress)) progress = 0;
  const initial = offscreen
    ? { x: focus.x + dx * progress - halfWidth, y: focus.y + dy * progress - halfHeight }
    : { x: clamp(projected.x + tail, gap + tail, viewport.width - gap - tail - bubble.width), y: clamp(projected.y - halfHeight, top + gap + tail, bottom - gap - tail - bubble.height) };
  const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
  const candidates = offsets.flatMap(y => offsets.map(x => ({
    x: clamp(initial.x + x * (bubble.width + gap), gap + tail, viewport.width - gap - tail - bubble.width),
    y: clamp(initial.y + y * (bubble.height + gap), top + gap + tail, bottom - gap - tail - bubble.height),
  })));
  candidates.sort((a, b) => Math.hypot(a.x - initial.x, a.y - initial.y) - Math.hypot(b.x - initial.x, b.y - initial.y));
  const position = candidates.find(p => fits(p) && clear(p)) ?? initial;
  const markerCenter = { x: position.x + halfWidth, y: position.y + halfHeight };
  const angle = Math.atan2(projected.y - markerCenter.y, projected.x - markerCenter.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const radius = Math.min(Math.abs(cos) < 1e-8 ? Infinity : halfWidth / Math.abs(cos), Math.abs(sin) < 1e-8 ? Infinity : halfHeight / Math.abs(sin));
  const side: LocationTail = halfWidth / Math.max(Math.abs(cos), 1e-8) < halfHeight / Math.max(Math.abs(sin), 1e-8)
    ? cos < 0 ? "left" : "right" : sin < 0 ? "top" : "bottom";
  return {
    ...position,
    side,
    angle: angle * 180 / Math.PI,
    offscreen,
    projected,
    arrowTip: { x: markerCenter.x + cos * (radius + tail), y: markerCenter.y + sin * (radius + tail) },
  };
}
