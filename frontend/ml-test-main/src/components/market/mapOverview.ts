import { getCandidateMarkerPosition, getLocationMarkerPosition } from "./locationMarker";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Rect = Point & Size;

export const MAP_SIZE = { width: 6807, height: 10577 };
export const RESULT_TAG_SIZE = { width: 62, height: 37 };

/** Keep visible tips on their targets while placing labels on cardinal axes. */
function fixNumberedPointer(position: ReturnType<typeof getLocationMarkerPosition>, targets: Point[], viewport: Size, top: number, bottom: number, reserved: Rect[]) {
  const { width, height } = RESULT_TAG_SIZE;
  const tail = 12, gap = 8;
  const clear = (rect: Point) => reserved.every(other => rect.x + width + gap <= other.x || rect.x >= other.x + other.width + gap || rect.y + height + gap <= other.y || rect.y >= other.y + other.height + gap);
  const fits = (rect: Point) => rect.x >= gap + tail && rect.x + width <= viewport.width - gap - tail && rect.y >= top + gap + tail && rect.y + height <= viewport.height - bottom - gap - tail;
  const layouts = (steps: number) => targets.flatMap(target => {
    if (target.x < 0 || target.x > viewport.width || target.y < top || target.y > viewport.height - bottom) return [];
    return Array.from({ length: steps }, (_, step) => [
      { x: target.x + tail + step * (width + gap), y: target.y - height / 2, angle: 180, target },
      { x: target.x - tail - width - step * (width + gap), y: target.y - height / 2, angle: 0, target },
      { x: target.x - width / 2, y: target.y + tail + step * (height + gap), angle: -90, target },
      { x: target.x - width / 2, y: target.y - tail - height - step * (height + gap), angle: 90, target },
    ]).flat().filter(rect => {
      const center = { x: rect.x + width / 2, y: rect.y + height / 2 };
      const distance = (point: Point) => Math.hypot(point.x - center.x, point.y - center.y);
      return fits(rect) && clear(rect) && distance(target) <= Math.min(...targets.map(distance)) + 1e-8;
    });
  });
  let fixed = position;
  if (!position.offscreen) {
    let available = layouts(1);
    // Crowded shops can share an axis without moving either pointer's target.
    // A straight connector spans the extra space between the label and tip.
    if (!available.length) available = layouts(Math.ceil(Math.max(viewport.width / (width + gap), viewport.height / (height + gap))));
    available.sort((a, b) => Math.hypot(a.x - position.x, a.y - position.y) - Math.hypot(b.x - position.x, b.y - position.y));
    if (available[0]) fixed = { ...position, x: available[0].x, y: available[0].y, angle: available[0].angle, projected: { x: available[0].target.x, y: available[0].target.y } };
  }
  const angle = Math.round(fixed.angle / 90) * 90;
  const side = angle === 0 ? "right" : angle === 90 ? "bottom" : angle === -90 ? "top" : "left";
  const direction = { x: side === "left" ? -1 : side === "right" ? 1 : 0, y: side === "top" ? -1 : side === "bottom" ? 1 : 0 };
  const leaderStart = { x: fixed.x + width / 2 + direction.x * width / 2, y: fixed.y + height / 2 + direction.y * height / 2 };
  const tip = fixed.offscreen
    ? { x: leaderStart.x + direction.x * tail, y: leaderStart.y + direction.y * tail }
    : fixed.projected;
  return { ...fixed, side, angle, tip, leaderStart };
}

/** Cover the visible map area without stretching the source or leaving gutters. */
export function getMapOverviewCamera(viewport: Size, top: number, bottom: number) {
  const availableHeight = Math.max(1, viewport.height - top - bottom);
  const scale = Math.max(viewport.width / MAP_SIZE.width, availableHeight / MAP_SIZE.height);
  return { scale, center: { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 + (bottom - top) / (2 * scale) } };
}

/** Keep the map covering the viewport while panning or changing zoom. */
export function constrainCoveredMapCenter(center: Point, scale: number, viewport: Size, top: number, bottom: number) {
  const halfWidth = Math.min(MAP_SIZE.width / 2, viewport.width / (2 * scale));
  const halfHeight = Math.min(MAP_SIZE.height / 2, Math.max(1, viewport.height - top - bottom) / (2 * scale));
  const offset = (bottom - top) / (2 * scale);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  return { x: clamp(center.x, halfWidth, MAP_SIZE.width - halfWidth), y: clamp(center.y - offset, halfHeight, MAP_SIZE.height - halfHeight) + offset };
}

/** Shop numbers use the same projection and edge tracking as the current location. */
export function getNumberedMarkerLayouts(markers: Array<Point & { id: string; number: number; candidates?: [Point, Point] }>, viewport: Size, top: number, bottom: number, reserved: Rect[] = [], selectedId?: string) {
  const visibleMarkers = markers.filter(marker => marker.id !== selectedId);
  // A readable number must not hide another shop's exact pointer endpoint.
  const tipAreas = visibleMarkers.flatMap(marker => (marker.candidates ?? [marker]).map(point => ({ x: point.x - 2, y: point.y - 2, width: 4, height: 4 })));
  const pointerClearance = (rect: Rect) => ({ x: rect.x - 4, y: rect.y - 4, width: rect.width + 8, height: rect.height + 8 });
  const placed = [...reserved.map(pointerClearance), ...tipAreas];
  return visibleMarkers.map(marker => {
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const position = marker.candidates
      ? getCandidateMarkerPosition(marker.candidates, center, 1, viewport, RESULT_TAG_SIZE, bottom, top, 12 / 16, placed)
      : getLocationMarkerPosition(marker, center, 1, viewport, RESULT_TAG_SIZE, bottom, top, 12 / 16, placed);
    const fixed = fixNumberedPointer(position, marker.candidates ?? [marker], viewport, top, bottom, placed);
    const rect = { x: fixed.x, y: fixed.y, ...RESULT_TAG_SIZE };
    placed.push(pointerClearance(rect));
    return { ...rect, id: marker.id, key: marker.id, number: marker.number, side: fixed.side, angle: fixed.angle, offscreen: fixed.offscreen, anchor: fixed.projected, tip: fixed.tip, leaderStart: fixed.leaderStart };
  });
}
