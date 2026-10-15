type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Rect = Point & Size;
export type LocationTail = "bottom" | "left" | "top" | "right";
export type MarkerPosition = Rect & {
  id: string;
  side: LocationTail;
  angle: number;
  projected: Point;
  arrowTip: Point;
  candidateIndex: number;
  offscreen: boolean;
  tracking: boolean;
};
export type MapMarker = Size & {
  id: string;
  targets: Point[];
  tail: number;
  previous?: MarkerPosition;
};

export function reflectPointAcrossCenter(point: Point, center: Point): Point {
  return { x: 2 * center.x - point.x, y: 2 * center.y - point.y };
}

export const CURRENT_LOCATION_ICON_CENTER = { x: 4961 + 52 / 2, y: 4255 + 76 / 2 };
export const ORIGINAL_LOCATION_TIP = { x: 5036, y: 4253 + 26 + 18 / Math.SQRT2 };
// The original and reflected tips are alternative targets for a single label.
export const CURRENT_LOCATION = reflectPointAcrossCenter(ORIGINAL_LOCATION_TIP, CURRENT_LOCATION_ICON_CENTER);
export const LOCATION_LABEL = { width: 173, height: 78, tailLength: 16, tipY: 26 + 18 / Math.SQRT2 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
const sides: LocationTail[] = ["left", "right", "top", "bottom"];
const isHorizontal = (side: LocationTail) => side === "left" || side === "right";
const directions = { left: { x: -1, y: 0, angle: 180 }, right: { x: 1, y: 0, angle: 0 }, top: { x: 0, y: -1, angle: -90 }, bottom: { x: 0, y: 1, angle: 90 } };
const trackingOverlap = 0.15;
const overlaps = (a: Rect, b: Rect, gap = 4) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const coversTip = (rect: Rect, tip: Point) => tip.x > rect.x - 2 && tip.x < rect.x + rect.width + 2 && tip.y > rect.y - 2 && tip.y < rect.y + rect.height + 2;
const compatible = (a: MarkerPosition, b: MarkerPosition) => !overlaps(a, b) && !coversTip(a, b.arrowTip) && !coversTip(b, a.arrowTip);

function nearestTarget(marker: MapMarker, position: Point) {
  const distance = (point: Point) => Math.hypot(point.x - position.x - marker.width / 2, point.y - position.y - marker.height / 2);
  return marker.targets.reduce((best, target, index) => distance(target) < distance(marker.targets[best]) ? index : best, 0);
}

/** Shared placement keeps arrows short and cardinal, with exact labels taking priority. */
export function getMapMarkerLayouts(markers: MapMarker[], viewport: Size, topOverlayHeight: number, bottomOverlayHeight: number, reserved: Rect[] = []): MarkerPosition[] {
  const top = clamp(topOverlayHeight, 0, viewport.height);
  const bottom = Math.max(top, viewport.height - bottomOverlayHeight);
  const visible = (point: Point) => point.x >= 0 && point.x <= viewport.width && point.y >= top && point.y <= bottom;
  const makePosition = (marker: MapMarker, position: Point, side: LocationTail, candidateIndex: number, tracking: boolean): MarkerPosition => {
    const direction = directions[side];
    return { ...position, width: marker.width, height: marker.height, id: marker.id, side, angle: direction.angle, candidateIndex,
      projected: marker.targets[candidateIndex], offscreen: !visible(marker.targets[candidateIndex]), tracking,
      arrowTip: tracking ? { x: position.x + marker.width / 2 + direction.x * (marker.width / 2 + marker.tail), y: position.y + marker.height / 2 + direction.y * (marker.height / 2 + marker.tail) } : marker.targets[candidateIndex] };
  };
  const fits = (position: MarkerPosition) => position.x >= 8 && position.x + position.width <= viewport.width - 8 && position.y >= top + 8 && position.y + position.height <= bottom - 8 && visible(position.arrowTip);
  const clearControls = (position: MarkerPosition) => reserved.every(rect => !overlaps(position, rect) && !coversTip(rect, position.arrowTip));
  const options = markers.map(marker => marker.targets.flatMap((target, candidateIndex) => !visible(target) ? [] : sides.map(side => {
    const direction = directions[side];
    const position = { x: target.x - marker.width / 2 - direction.x * (marker.width / 2 + marker.tail), y: target.y - marker.height / 2 - direction.y * (marker.height / 2 + marker.tail) };
    return makePosition(marker, position, side, candidateIndex, false);
  }).filter(position => fits(position) && clearControls(position) && nearestTarget(marker, position) === candidateIndex)).sort((a, b) => {
    const preference = (position: MarkerPosition) => (marker.previous?.side === position.side ? -10 : 0) + (marker.previous?.candidateIndex === position.candidateIndex ? -1 : 0) + sides.indexOf(position.side) + position.candidateIndex / 10;
    // Side placement outranks keeping a previous top/bottom arrow.
    return Number(isHorizontal(b.side)) - Number(isHorizontal(a.side)) || preference(a) - preference(b);
  }));

  // Keep as many labels exact as possible, then prefer the layout with the most
  // horizontal arrows. One label can switch sides to make room for its neighbour.
  const order = markers.map((_, index) => index).sort((a, b) => options[a].length - options[b].length);
  const remainingExact = Array<number>(order.length + 1).fill(0);
  const remainingHorizontal = Array<number>(order.length + 1).fill(0);
  for (let depth = order.length - 1; depth >= 0; depth--) {
    remainingExact[depth] = remainingExact[depth + 1] + Number(options[order[depth]].length > 0);
    remainingHorizontal[depth] = remainingHorizontal[depth + 1] + Number(options[order[depth]].some(option => isHorizontal(option.side)));
  }
  let best: Array<MarkerPosition | undefined> = [];
  let bestCount = -1;
  let bestHorizontalCount = -1;
  let visits = 0;
  const chosen: Array<MarkerPosition | undefined> = Array(markers.length);
  const search = (depth: number, count: number, horizontalCount: number) => {
    const possibleCount = count + remainingExact[depth];
    if (++visits > 6000 || possibleCount < bestCount || (possibleCount === bestCount && horizontalCount + remainingHorizontal[depth] <= bestHorizontalCount)) return;
    if (depth === order.length) { best = [...chosen]; bestCount = count; bestHorizontalCount = horizontalCount; return; }
    const index = order[depth];
    for (const option of options[index]) {
      if (chosen.some(other => other && !compatible(option, other))) continue;
      chosen[index] = option;
      search(depth + 1, count + 1, horizontalCount + Number(isHorizontal(option.side)));
      chosen[index] = undefined;
    }
    search(depth + 1, count, horizontalCount);
  };
  search(0, 0, 0);
  const exact = best.filter((position): position is MarkerPosition => !!position);
  const tracked: MarkerPosition[] = [];

  return markers.map((marker, index) => {
    if (best[index]) return best[index];
    const halfWidth = marker.width / 2, halfHeight = marker.height / 2;
    const minX = 8 + marker.tail, maxX = Math.max(minX, viewport.width - 8 - marker.tail - marker.width);
    const minY = top + 8 + marker.tail, maxY = Math.max(minY, bottom - 8 - marker.tail - marker.height);
    const focus = { x: viewport.width / 2, y: (top + bottom) / 2 };
    const target = marker.targets[nearestTarget(marker, { x: focus.x - halfWidth, y: focus.y - halfHeight })];
    const dx = target.x - focus.x, dy = target.y - focus.y;
    const tx = dx === 0 ? Infinity : ((dx > 0 ? maxX : minX) + halfWidth - focus.x) / dx;
    const ty = dy === 0 ? Infinity : ((dy > 0 ? maxY : minY) + halfHeight - focus.y) / dy;
    const progress = Math.max(0, Math.min(1, tx, ty));
    const initial = { x: clamp(focus.x + dx * progress - halfWidth, minX, maxX), y: clamp(focus.y + dy * progress - halfHeight, minY, maxY) };
    const obstacles = [...reserved, ...exact];
    const xs = [initial.x, ...obstacles.flatMap(rect => [rect.x - marker.width - 6, rect.x + rect.width + 6])];
    const ys = [initial.y, ...obstacles.flatMap(rect => [rect.y - marker.height - 6, rect.y + rect.height + 6])];
    // Local sliding allows a small overlap between trackers. Exact labels
    // and controls remain protected; no long connectors are ever needed.
    for (let step = 1; step <= markers.length; step++) for (const sign of [-1, 1]) {
      xs.push(initial.x + sign * step * marker.width * (1 - trackingOverlap));
      ys.push(initial.y + sign * step * marker.height * (1 - trackingOverlap));
    }
    const candidates = [...new Set(xs.map(x => clamp(x, minX, maxX)))].flatMap(x => [...new Set(ys.map(y => clamp(y, minY, maxY)))].map(y => {
      const candidateIndex = nearestTarget(marker, { x, y });
      const point = marker.targets[candidateIndex];
      const horizontal = (point.x - x - halfWidth) / halfWidth;
      const vertical = (point.y - y - halfHeight) / halfHeight;
      let side: LocationTail = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal < 0 ? "left" : "right" : vertical < 0 ? "top" : "bottom";
      const previousSide = marker.previous?.side;
      if (previousSide) {
        const previousDirection = directions[previousSide];
        // Keep the previous side near diagonal boundaries to avoid flicker.
        const previousComponent = previousDirection.x * horizontal + previousDirection.y * vertical;
        if (previousComponent > 0 && previousComponent >= Math.max(Math.abs(horizontal), Math.abs(vertical)) * 0.85) side = previousSide;
      }
      return makePosition(marker, { x, y }, side, candidateIndex, true);
    }));
    const overlapFraction = (position: Rect, other: Rect) => Math.max(0, Math.min(position.x + position.width, other.x + other.width) - Math.max(position.x, other.x)) * Math.max(0, Math.min(position.y + position.height, other.y + other.height) - Math.max(position.y, other.y)) / Math.min(position.width * position.height, other.width * other.height);
    const clear = candidates.filter(position => clearControls(position) && exact.every(other => compatible(position, other)));
    const readable = clear.filter(position => tracked.every(other => overlapFraction(position, other) <= trackingOverlap + 1e-8));
    const available = readable.length ? readable : clear.length ? clear : candidates;
    const edgeCandidates = visible(target) ? [] : available.filter(position => Math.abs(tx < ty ? position.x - initial.x : position.y - initial.y) < 1e-8);
    // Offscreen indicators slide along the same edge before moving inward.
    const displacement = (position: Point) => Math.hypot(position.x - initial.x, position.y - initial.y)
      + (visible(target) ? 0 : 4 * Math.abs(tx < ty ? position.x - initial.x : position.y - initial.y));
    const preferred = edgeCandidates.length ? edgeCandidates : available;
    preferred.sort((a, b) => displacement(a) - displacement(b));
    const position = preferred[0];
    tracked.push(position);
    return position;
  });
}

/** Render one label using one of the two symmetric targets. */
export function getCandidateMarkerPosition(origins: [Point, Point], center: Point, scale: number, viewport: Size, bubble: Size, bottomOverlayHeight: number, topOverlayHeight = 0, markerScale = scale, reserved: Rect[] = []) {
  const targets = origins.map(origin => ({ x: viewport.width / 2 + (origin.x - center.x) * scale, y: viewport.height / 2 + (origin.y - center.y) * scale }));
  return getMapMarkerLayouts([{ id: "location", targets, ...bubble, tail: LOCATION_LABEL.tailLength * markerScale }], viewport, topOverlayHeight, bottomOverlayHeight, reserved)[0];
}

// Pointer events use physical screen pixels; SVG and overlays use layout pixels.
export function getLocalMapPoint(point: Point, rect: { left: number; top: number; width: number; height: number }, viewport: Size): Point {
  return { x: (point.x - rect.left) * viewport.width / Math.max(rect.width, 1), y: (point.y - rect.top) * viewport.height / Math.max(rect.height, 1) };
}

export function getLocationMarkerPosition(origin: Point, center: Point, scale: number, viewport: Size, bubble: Size, bottomOverlayHeight: number, topOverlayHeight = 0, markerScale = scale, reserved: Rect[] = []) {
  return getCandidateMarkerPosition([origin, origin], center, scale, viewport, bubble, bottomOverlayHeight, topOverlayHeight, markerScale, reserved);
}
