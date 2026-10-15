import { getMapMarkerLayouts, type MapMarker, type MarkerPosition } from "./locationMarker";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type Rect = Point & Size;

export const MAP_SIZE = { width: 6807, height: 10577 };
export const RESULT_TAG_SIZE = { width: 62, height: 37 };
type NumberedTarget = Point & { id: string; number: number; candidates?: [Point, Point] };

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

/** Current location and shop numbers share one collision and tracking layout. */
export function getResultMapMarkerLayouts(markers: NumberedTarget[], viewport: Size, top: number, bottom: number, reserved: Rect[] = [], selectedId?: string, currentLocation?: MapMarker, previous: Record<string, MarkerPosition> = {}) {
  const visibleMarkers = markers.filter(marker => marker.id !== selectedId);
  const requests: MapMarker[] = visibleMarkers.map(marker => ({ id: marker.id, targets: marker.candidates ?? [marker], ...RESULT_TAG_SIZE, tail: 12, previous: previous[marker.id] }));
  if (currentLocation) requests.unshift({ ...currentLocation, previous: previous[currentLocation.id] });
  const layouts = getMapMarkerLayouts(requests, viewport, top, bottom, reserved);
  const numberedLayouts = layouts.slice(currentLocation ? 1 : 0).map((position, index) => ({
    ...position, key: position.id, number: visibleMarkers[index].number, anchor: position.projected, tip: position.arrowTip,
  }));
  return { location: currentLocation ? layouts[0] : undefined, numbered: numberedLayouts, positions: Object.fromEntries(layouts.map(position => [position.id, position])) };
}

/** Shop numbers retain one compact marker each, including during edge tracking. */
export function getNumberedMarkerLayouts(markers: NumberedTarget[], viewport: Size, top: number, bottom: number, reserved: Rect[] = [], selectedId?: string) {
  return getResultMapMarkerLayouts(markers, viewport, top, bottom, reserved, selectedId).numbered;
}
