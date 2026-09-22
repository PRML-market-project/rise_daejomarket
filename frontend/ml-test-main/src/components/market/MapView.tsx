import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Shop } from "@/types/shop";

interface Point { x: number; y: number }
interface IconCell { x: number; y: number; width: number; height: number }
type MapViewProps = { shops?: Shop[]; selectedShop?: Shop | null; onSelectShop?: (id: string) => void; showRoute?: boolean };

const MAP_WIDTH = 6807;
const MAP_HEIGHT = 10577;
const CURRENT_POSITION: Point = { x: 5090, y: 4300 };
const MARKET_BOUNDS = { minX: 4050, maxX: 5250, minY: 1350, maxY: 10050 };
const INITIAL_CENTER: Point = { x: 4950, y: 4300 };
const MIN_LABEL_PT = 15;
const MAX_LABEL_PT = 32;
const INITIAL_LABEL_PT = 18;
const CSS_PIXELS_PER_POINT = 4 / 3;
const SOURCE_LABEL_HEIGHT = 38;
const LEFT_ICON_CELLS: IconCell[] = [[1579,83],[2307,54],[2369,83],[2460,83],[2551,84],[2643,83],[2734,54],[2796,96],[2900,77],[2985,78],[3071,87],[3210,49],[3267,54],[3329,74],[3411,73],[3492,133],[3861,82],[3951,83],[4185,68],[4261,68],[4337,49],[4394,54],[4456,84],[4548,69],[4695,54],[4757,74],[4839,60],[5048,68],[5124,61],[5193,54],[5255,69],[5409,68],[5634,66],[5708,40],[5756,71],[5835,71],[5914,72],[5994,92],[6094,74],[6176,73],[6257,71],[6495,60],[6563,142],[6713,55],[6776,94],[6919,93],[7020,93],[7121,93],[7222,85],[7315,93],[7503,62],[7573,52],[7633,52],[7693,98],[7799,98],[8133,108],[8249,85],[8342,84],[8434,78],[8520,252],[8883,231],[9541,154]].map(([y,height]) => ({ x: 4827, y, width: 52, height }));
const RIGHT_ICON_CELLS: IconCell[] = [[4255,76],[4341,76],[4425,76],[4655,76],[4739,76],[4823,76],[5064,76],[5148,76],[5232,76],[5691,76],[5775,76],[5859,76],[5943,76],[6027,76],[6111,76],[6195,76],[6718,76],[6802,76],[6886,76],[6970,76],[7054,76],[7138,76],[7222,76],[7306,76],[7573,76],[7657,76]].map(([y,height]) => ({ x: 4961, y, width: 52, height }));

// The exported Figma map is not laid out on a regular grid. These are the
// actual centres of the north-aisle icon cells in the source SVG.
const NORTH_AISLE_IDS = [1, 2, 4, ...Array.from({ length: 57 }, (_, index) => index + 7)];
const NORTH_AISLE_ICON_Y = [
  2334, 2410.5, 2501.5, 2593, 2684.5, 2761, 2844, 2938.5, 3024, 3114.5,
  3234.5, 3294, 3366, 3447.5, 3558.5, 4219, 4295, 4361.5, 4421, 4498,
  4582.5, 5082, 5154.5, 5220, 5289.5, 5443, 5667, 5728, 5791.5, 5870.5,
  5950, 6040, 6131, 6212.5, 6292.5, 6525, 6634, 6740.5, 6823, 6965.5,
  7066.5, 7167.5, 7264.5, 7361.5, 7534, 7599, 7659, 7742, 7848, 8187,
  8291.5, 8384, 8473, 8646, 8998.5, 9618,
];
const NORTH_AISLE_Y_BY_ID = new Map(NORTH_AISLE_IDS.map((id, index) => [id, NORTH_AISLE_ICON_Y[index]]));

function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }
function clampCenter(point: Point): Point { return { x: clamp(point.x, MARKET_BOUNDS.minX, MARKET_BOUNDS.maxX), y: clamp(point.y, MARKET_BOUNDS.minY, MARKET_BOUNDS.maxY) }; }

function getShopIconCell(shop: Shop): IconCell | null {
  if (shop.guideY === undefined) return null;
  const cells = shop.section === "시장 동측 통로" ? RIGHT_ICON_CELLS : shop.section === "시장 서측 통로" ? LEFT_ICON_CELLS : [];
  const nearest = cells.reduce<IconCell | null>((best, cell) => !best || Math.abs(cell.y + cell.height / 2 - shop.guideY) < Math.abs(best.y + best.height / 2 - shop.guideY) ? cell : best, null);
  return nearest && Math.abs(nearest.y + nearest.height / 2 - shop.guideY) <= 48 ? nearest : null;
}

export function getShopMapMarker(shop: Shop): Point {
  if (shop.guideX !== undefined && shop.guideY !== undefined && shop.guideX > 1000) {
    const iconCell = getShopIconCell(shop);
    return iconCell ? { x: iconCell.x + iconCell.width / 2, y: iconCell.y + iconCell.height / 2 } : { x: shop.x + shop.width, y: shop.y + shop.height / 2 };
  }
  const number = Number.parseInt(shop.id, 10);
  if (shop.section.includes("북동측")) return { x: 5250, y: 1852 + number * 90 };
  if (shop.section.includes("북측")) return { x: 4852, y: NORTH_AISLE_Y_BY_ID.get(number) ?? 1852 + number * 90 };
  if (shop.section.includes("서측 A")) return { x: clamp(1550 + (2775 - shop.x) * 1.25, 1550, 4900), y: 9320 };
  if (shop.section.includes("서측 B")) return { x: clamp(1550 + (2775 - shop.x) * 1.25, 1550, 4900), y: 9000 };
  return { x: 4850, y: clamp(10100 - shop.y * 1.45, 4800, 10000) };
}

function FoodIcon({ x, y, size = 36 }: { x: number; y: number; size?: number }) {
  const scale = size / 24;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2M7 2v20M21 15V2c-2.8 0-5 2.2-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></g>;
}

export function MapView({ shops = [], selectedShop = null, onSelectShop, showRoute = false }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ midpoint: Point; distance: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [center, setCenter] = useState<Point>(INITIAL_CENTER);
  const [labelPt, setLabelPt] = useState(INITIAL_LABEL_PT);
  const [isDragging, setIsDragging] = useState(false);
  const selectedMarker = useMemo(() => selectedShop ? getShopMapMarker(selectedShop) : null, [selectedShop]);
  const mapScale = (labelPt * CSS_PIXELS_PER_POINT) / SOURCE_LABEL_HEIGHT;
  const viewWidth = containerSize.width / mapScale;
  const viewHeight = containerSize.height / mapScale;
  const constrainedCenter = useMemo(() => clampCenter(center), [center]);
  const viewBox = `${constrainedCenter.x - viewWidth / 2} ${constrainedCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => { const rect = container.getBoundingClientRect(); setContainerSize({ width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) }); };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedMarker) return;
    setCenter(clampCenter(showRoute ? { x: 4970, y: (selectedMarker.y + CURRENT_POSITION.y) / 2 } : { x: selectedMarker.x - 120, y: selectedMarker.y }));
    setLabelPt(INITIAL_LABEL_PT);
  }, [selectedMarker, showRoute]);

  const changeZoom = useCallback((nextLabelPt: number) => setLabelPt(clamp(nextLabelPt, MIN_LABEL_PT, MAX_LABEL_PT)), []);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => { event.preventDefault(); setLabelPt((current) => clamp(current * Math.exp(-event.deltaY * 0.0015), MIN_LABEL_PT, MAX_LABEL_PT)); };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  const panBy = useCallback((deltaX: number, deltaY: number) => setCenter((current) => clampCenter({ x: current.x - deltaX / mapScale, y: current.y - deltaY / mapScale })), [mapScale]);
  const updateGesture = useCallback(() => {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length < 2) { gestureRef.current = pointers[0] ? { midpoint: pointers[0], distance: 0 } : null; return; }
    const [first, second] = pointers;
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const previous = gestureRef.current;
    if (previous) { panBy(midpoint.x - previous.midpoint.x, midpoint.y - previous.midpoint.y); if (previous.distance > 0) setLabelPt((current) => clamp(current * (distance / previous.distance), MIN_LABEL_PT, MAX_LABEL_PT)); }
    gestureRef.current = { midpoint, distance };
  }, [panBy]);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); setIsDragging(true); updateGesture(); };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => { const previous = pointersRef.current.get(event.pointerId); if (!previous) return; pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointersRef.current.size === 1) { panBy(event.clientX - previous.x, event.clientY - previous.y); gestureRef.current = { midpoint: { x: event.clientX, y: event.clientY }, distance: 0 }; } else updateGesture(); };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => { pointersRef.current.delete(event.pointerId); setIsDragging(pointersRef.current.size > 0); updateGesture(); };

  const selectedLabelWidth = selectedShop ? Math.max(300, selectedShop.name.length * 42 + 70) : 0;
  const selectedIconCell = selectedShop ? getShopIconCell(selectedShop) : null;
  const selectedLabelRight = selectedMarker ? selectedIconCell ? selectedIconCell.x - 14 : selectedMarker.x : 0;
  const routeTarget = selectedMarker ? { x: CURRENT_POSITION.x, y: selectedMarker.y } : null;
  const routeTop = routeTarget ? Math.min(routeTarget.y, CURRENT_POSITION.y) : 0;
  const routeBottom = routeTarget ? Math.max(routeTarget.y, CURRENT_POSITION.y) : 0;
  const routeArrows = routeTarget ? Array.from({ length: Math.max(0, Math.floor((routeBottom - routeTop) / 90) - 1) }, (_, index) => routeTop + 90 + index * 90) : [];

  return <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-[#f7f7f7] touch-none select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={selectedShop ? `${selectedShop.name}이 선택된 대조시장 지도` : "대조시장 안내 지도"}>
      <image href="/images/daejomarket-map.svg" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" pointerEvents="none" />
      {shops.map((shop) => { const marker = getShopMapMarker(shop); const hitWidth = Math.max(300, shop.name.length * 30 + 90); return <g key={shop.id} role="button" tabIndex={0} aria-label={`${shop.name} 선택`} className="cursor-pointer outline-none" onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelectShop?.(shop.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectShop?.(shop.id); } }}><title>{shop.name}</title><rect x={marker.x - hitWidth - 34} y={marker.y - 41} width={hitWidth + 68} height="82" rx="18" fill="transparent" pointerEvents="all" /></g>; })}
      {showRoute && routeTarget && <g pointerEvents="none">
        <line x1={CURRENT_POSITION.x} y1={CURRENT_POSITION.y} x2={routeTarget.x} y2={routeTarget.y} stroke="#19bf69" strokeWidth="24" strokeLinecap="round" />
        {routeArrows.map((y) => <path key={y} d={`M ${CURRENT_POSITION.x - 9} ${y + 11} L ${CURRENT_POSITION.x} ${y - 7} L ${CURRENT_POSITION.x + 9} ${y + 11} Z`} fill="#d8f5e7" />)}
        <circle cx={routeTarget.x} cy={routeTarget.y} r="38" fill="#b7ead0" /><circle cx={routeTarget.x} cy={routeTarget.y} r="24" fill="#19bf69" />
        <rect x={routeTarget.x + 68} y={routeTarget.y - 35} width="132" height="70" rx="14" fill="#19bf69" /><text x={routeTarget.x + 134} y={routeTarget.y + 12} textAnchor="middle" fill="white" fontSize="38" fontWeight="700">30m</text>
        <circle cx={CURRENT_POSITION.x} cy={CURRENT_POSITION.y} r="38" fill="#b7ead0" /><circle cx={CURRENT_POSITION.x} cy={CURRENT_POSITION.y} r="24" fill="#19bf69" />
      </g>}
      {selectedShop && selectedMarker && <g pointerEvents="none">
        <rect x={selectedLabelRight - selectedLabelWidth} y={selectedMarker.y - 34} width={selectedLabelWidth} height="68" rx="18" fill="#19bf69" /><path d={`M ${selectedLabelRight - 1} ${selectedMarker.y - 17} L ${selectedLabelRight + 24} ${selectedMarker.y} L ${selectedLabelRight - 1} ${selectedMarker.y + 17} Z`} fill="#19bf69" />
        {selectedIconCell && <><rect x={selectedIconCell.x} y={selectedIconCell.y} width={selectedIconCell.width} height={selectedIconCell.height} rx="8" fill="#09a956" /><FoodIcon x={selectedMarker.x - 16} y={selectedMarker.y - 16} size={32} /></>}
        <text x={selectedLabelRight - selectedLabelWidth + 22} y={selectedMarker.y + 12} fill="white" fontSize="36" fontWeight="700" fontFamily="Noto Sans KR, sans-serif">{selectedShop.name}</text>
      </g>}
    </svg>
    <div className="absolute right-5 top-[210px] z-20 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-lg backdrop-blur" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="h-16 w-16 text-4xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200" aria-label="지도 확대" onClick={() => changeZoom(labelPt * 1.2)}>+</button><div className="h-px bg-black/10" /><button type="button" className="h-16 w-16 text-4xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200" aria-label="지도 축소" onClick={() => changeZoom(labelPt / 1.2)}>−</button>
    </div>
  </div>;
}
