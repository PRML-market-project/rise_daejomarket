import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Shop } from "@/types/shop";

interface Point { x: number; y: number }
interface IconCell { x: number; y: number; width: number; height: number }
interface HitArea { x: number; y: number; width: number; height: number }
interface RotatedIconCell extends IconCell { rotation: number; originX: number; originY: number }
type MapViewProps = { shops?: Shop[]; iconShops?: Shop[]; selectedShop?: Shop | null; onSelectShop?: (id: string) => void; showRoute?: boolean };

const MAP_WIDTH = 6807;
const MAP_HEIGHT = 10577;
const MAIN_AISLE_X = 4920;
const ROUTE_ORIGIN: Point = { x: MAIN_AISLE_X, y: 4291.5 };
const SOUTH_AISLE_Y = 9247.5;
const CROSSWALK_Y = 3804;
const CROSSWALK_WEST_X = 5060;
const CROSSWALK_EAST_X = 5540;
const EAST_SIDE_AISLE_X = 5540;
const CROSSWALK_SHOP_IDS = new Set(["585:28795", "585:28796", "585:28797"]);
const MARKET_BOUNDS = { minX: 1400, maxX: 6200, minY: 1350, maxY: 10050 };
const INITIAL_CENTER: Point = { x: 4950, y: 4300 };
const MIN_LABEL_PT = 15;
const MAX_LABEL_PT = 32;
const INITIAL_LABEL_PT = 18;
const DIRECTIONS_PANEL_HEIGHT = 520;
const CSS_PIXELS_PER_POINT = 4 / 3;
const SOURCE_LABEL_HEIGHT = 38;

// Distance calibration from the two measured shop-to-shop distances supplied
// for this map. The axes are calibrated separately because the source drawing
// is slightly stretched horizontally.
const DISTANCE_REFERENCE = {
  snackBar: { x: 4853, y: 9618 },
  pharmacy: { x: 4853, y: 1620.5 },
  goldButcher: { x: 1556.5, y: 9374 },
};
const Y_UNITS_PER_METER = Math.abs(DISTANCE_REFERENCE.snackBar.y - DISTANCE_REFERENCE.pharmacy.y) / 319;
const GOLD_VERTICAL_METERS = Math.abs(DISTANCE_REFERENCE.snackBar.y - DISTANCE_REFERENCE.goldButcher.y) / Y_UNITS_PER_METER;
const X_UNITS_PER_METER = Math.abs(DISTANCE_REFERENCE.snackBar.x - DISTANCE_REFERENCE.goldButcher.x)
  / Math.sqrt(138 ** 2 - GOLD_VERTICAL_METERS ** 2);
const LEFT_ICON_CELLS: IconCell[] = [[1579,83],[2307,54],[2369,83],[2460,83],[2551,84],[2643,83],[2734,54],[2796,96],[2900,77],[2985,78],[3071,87],[3210,49],[3267,54],[3329,74],[3411,73],[3492,133],[3861,82],[3951,83],[4185,68],[4261,68],[4337,49],[4394,54],[4456,84],[4548,69],[4695,54],[4757,74],[4839,60],[5048,68],[5124,61],[5193,54],[5255,69],[5409,68],[5634,66],[5708,40],[5756,71],[5835,71],[5914,72],[5994,92],[6094,74],[6176,73],[6257,71],[6495,60],[6563,142],[6713,55],[6776,94],[6919,93],[7020,93],[7121,93],[7222,85],[7315,93],[7503,62],[7573,52],[7633,52],[7693,98],[7799,98],[8133,108],[8249,85],[8342,84],[8434,78],[8520,252],[8883,231],[9541,154]].map(([y,height]) => ({ x: 4827, y, width: 52, height }));
const RIGHT_ICON_CELLS: IconCell[] = [[4255,76],[4341,76],[4425,76],[4655,76],[4739,76],[4823,76],[5064,76],[5148,76],[5232,76],[5691,76],[5775,76],[5859,76],[5943,76],[6027,76],[6111,76],[6195,76],[6718,76],[6802,76],[6886,76],[6970,76],[7054,76],[7138,76],[7222,76],[7306,76],[7573,76],[7657,76]].map(([y,height]) => ({ x: 4961, y, width: 52, height }));

// These shops do not belong to the regular west-side icon column in the SVG.
// `null` means that the shop has a text position but no dedicated icon cell.
const SPECIAL_ICON_CELLS = new Map<string, IconCell | null>([
  ["585:28760", { x: 4826, y: 1979, width: 52, height: 320 }], // 남영상회: tall shop
  ["585:28763", { x: 4758, y: 2245, width: 52, height: 54 }],  // 황가네순대국 2층
  ["585:28764", { x: 4758, y: 2307, width: 52, height: 54 }],  // 엉터리집 2층
  ["585:30183", { x: 4758, y: 3267, width: 52, height: 54 }],  // 봉화장여관 2층
  ["585:28881", { x: 4670, y: 4565, width: 95, height: 52 }],  // 대동고추: horizontal shop
  ["585:28882", { x: 4826, y: 4548, width: 52, height: 69 }],  // 진영153수산: Figma Frame 326
  ["585:28839", { x: 4827, y: 7799, width: 52, height: 98 }],  // 엄마김치
  ["585:28880", null],                                        // 대조골목집: rotated shop
  ["585:28846", { x: 4827, y: 9541, width: 52, height: 154 }], // 맥반석주전부리
  ["585:28847", { x: 4657, y: 9094, width: 95, height: 52 }],  // 축협한우마을
  ["585:28848", { x: 4451, y: 9094, width: 95, height: 52 }],  // 불광동족발
  ["585:28849", { x: 4554, y: 9094, width: 95, height: 52 }],  // 남도술상
  ["585:28850", { x: 4348, y: 9094, width: 95, height: 52 }],  // 왕십리곱창
  ["585:28851", { x: 4087, y: 9094, width: 95, height: 52 }],  // 해남건어물
  ["585:30204", { x: 3984, y: 9094, width: 95, height: 52 }],  // 일심상회
  ["585:30205", { x: 3881, y: 9094, width: 95, height: 52 }],  // 수산물직판장
  ["585:28852", { x: 3735, y: 9094, width: 95, height: 52 }],  // 바로굼빵터
  ["585:28854", { x: 3632, y: 9094, width: 95, height: 52 }],  // 종로복떡집
  ["585:28867", { x: 3492, y: 9349, width: 68, height: 52 }],  // 소문난반찬
  ["585:28868", { x: 3764, y: 9349, width: 109, height: 52 }], // 갤러리 명품 빈티지
  ["585:28869", { x: 4184, y: 9349, width: 132, height: 52 }], // 계단집
  ["585:28870", { x: 4464, y: 9349, width: 133, height: 52 }], // 행복통닭
  ["585:28871", { x: 4745, y: 9349, width: 132, height: 52 }], // 봉화농산물
  ["585:28872", { x: 3568, y: 9349, width: 68, height: 52 }],  // 우리농산
  ["585:28873", { x: 3881, y: 9349, width: 109, height: 52 }], // 현대육류백화점
  ["585:28874", { x: 4324, y: 9349, width: 132, height: 52 }], // 도깨비칼국수
  ["585:28875", { x: 4605, y: 9349, width: 132, height: 52 }], // 한성방앗간
  ["585:28855", { x: 3054, y: 9094, width: 74, height: 52 }],  // 시골시장참기름
  ["585:28856", { x: 2972, y: 9094, width: 74, height: 52 }],  // 남도홍어
  ["585:28857", { x: 2689, y: 9094, width: 95, height: 52 }],  // 제일상회
  ["585:30215", { x: 2586, y: 9094, width: 95, height: 52 }],  // 떡마을
  ["585:28858", { x: 2377, y: 9094, width: 95, height: 52 }],  // 우리농산물
  ["585:28859", { x: 1634, y: 9094, width: 95, height: 52 }],  // 정아네
  ["585:28876", { x: 1839, y: 9094, width: 95, height: 52 }],  // 축산물직거래도매센터
  ["585:28877", { x: 2890, y: 9094, width: 74, height: 52 }],  // 영미용실
  ["585:28878", { x: 1737, y: 9094, width: 94, height: 52 }],  // 꿉는남자
  ["585:28879", { x: 2274, y: 9094, width: 95, height: 52 }],  // 자연이준선물
  ["585:28860", { x: 1509, y: 9348, width: 95, height: 52 }],  // 골드축산
  ["585:30219", { x: 1936, y: 9349, width: 104, height: 52 }], // 메모리
  ["585:28861", { x: 2048, y: 9349, width: 102, height: 52 }], // 대명당
  ["585:28862", { x: 2158, y: 9349, width: 104, height: 52 }], // 우리수선
  ["585:28863", { x: 2462, y: 9348, width: 95, height: 52 }],  // 꽉찬소곱창
  ["585:28865", { x: 2913, y: 9349, width: 161, height: 52 }], // 고모집생선
  ["585:28866", { x: 3320, y: 9348, width: 95, height: 52 }],  // 은평청과물
  ["585:28795", { x: 5649, y: 6027, width: 52, height: 119 }], // 언니들의빈티지
  ["585:28796", { x: 5649, y: 6154, width: 52, height: 119 }], // 행복가구 3층 고객센터
  ["585:28797", null],                                        // 태성골뱅이: rotated shop
  ["585:28845", { x: 4827, y: 8883, width: 52, height: 231 }], // 강화쌀상회
]);

const ADMIN_ICON_ASSETS: Record<string, string> = {
  "정육청과수산": "/images/figma-wheat-icon.svg",
  "식품": "/images/figma-washoku-icon.svg",
  "식료품잡화": "/images/figma-shopping-cart-icon.svg",
  "농산물 가공": "/images/figma-milk-icon.svg",
  "식당": "/images/figma-restaurant-icon.svg",
  "식사": "/images/figma-restaurant-icon.svg",
  "의류잡화": "/images/figma-apparel-icon.svg",
  "서비스업": "/images/figma-person-icon.svg",
  "좌판": "/images/figma-store-icon.svg",
};

const CATEGORY_ICON_ASSETS: Record<string, string> = {
  "식당": "/images/figma-restaurant-icon.svg",
  "식품": "/images/figma-washoku-icon.svg",
  "정육": "/images/figma-wheat-icon.svg",
  "청과": "/images/figma-wheat-icon.svg",
  "수산": "/images/figma-wheat-icon.svg",
  "잡화": "/images/figma-shopping-cart-icon.svg",
  "서비스업": "/images/figma-person-icon.svg",
};

const SPECIAL_HIT_AREAS = new Map<string, HitArea[]>([
  ["585:28880", [{ x: 4526, y: 7798, width: 110, height: 74 }]],
  ["585:28797", [{ x: 5693, y: 6554.57, width: 105.5, height: 128.86 }]],
]);

const SPECIAL_ROTATED_ICON_CELLS = new Map<string, RotatedIconCell>([
  ["585:28880", { x: 4538.68, y: 7798, width: 95, height: 52, rotation: 12.9848, originX: 4538.68, originY: 7798 }],
  ["585:28797", { x: 5753.81, y: 6554.57, width: 52, height: 119, rotation: 30.73, originX: 5753.81, originY: 6554.57 }],
]);

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

function getRouteDistanceMeters(points: Point[]): number {
  return points.slice(1).reduce((distance, point, index) => {
    const previous = points[index];
    return distance + Math.hypot(
      (point.x - previous.x) / X_UNITS_PER_METER,
      (point.y - previous.y) / Y_UNITS_PER_METER,
    );
  }, 0);
}

function getRouteArrows(points: Point[]) {
  const arrows: Array<Point & { rotation: number }> = [];
  const spacing = 120;
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const deltaX = point.x - previous.x;
    const deltaY = point.y - previous.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length < spacing) return;
    const rotation = Math.atan2(deltaY, deltaX) * 180 / Math.PI + 90;
    for (let distance = spacing; distance < length - 30; distance += spacing) {
      arrows.push({
        x: previous.x + deltaX * distance / length,
        y: previous.y + deltaY * distance / length,
        rotation,
      });
    }
  });
  return arrows;
}

function getPointAlongRoute(points: Point[], progress: number): Point {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return { start, end: point, length: Math.hypot(point.x - start.x, point.y - start.y) };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = totalLength * clamp(progress, 0, 1);

  for (const segment of segments) {
    if (remaining <= segment.length) {
      const segmentProgress = segment.length === 0 ? 1 : remaining / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * segmentProgress,
        y: segment.start.y + (segment.end.y - segment.start.y) * segmentProgress,
      };
    }
    remaining -= segment.length;
  }

  return points[points.length - 1];
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

function getShopNameLines(shop: Shop): string[] {
  if (shop.height <= SOURCE_LABEL_HEIGHT * 1.5) return [shop.name];

  const words = shop.name.trim().split(/\s+/);
  if (words.length < 2) return [shop.name];

  let bestSplit = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const firstLength = words.slice(0, index).join(" ").length;
    const secondLength = words.slice(index).join(" ").length;
    const difference = Math.abs(firstLength - secondLength);
    if (difference < smallestDifference) {
      bestSplit = index;
      smallestDifference = difference;
    }
  }
  return [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
}

function getShopLabelBubble(shop: Shop, marker: Point) {
  const lines = getShopNameLines(shop);
  const centerX = shop.x + shop.width / 2;
  const centerY = shop.y + shop.height / 2;
  // `shop.width` is the measured text bound from the source SVG. Using it as
  // the single source of truth keeps long east-side labels aligned instead of
  // letting a character-count estimate expand back over the shop icon.
  const width = Math.max(96, shop.width + 32);
  const height = Math.max(58, lines.length * 38 + 20);
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  const deltaX = marker.x - centerX;
  const deltaY = marker.y - centerY;
  const tailLength = 16;
  const tailHalfWidth = 9;
  let tailPath: string;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    const edgeX = deltaX >= 0 ? x + width : x;
    const tipX = edgeX + Math.sign(deltaX || 1) * tailLength;
    const tailY = clamp(marker.y, y + 16, y + height - 16);
    tailPath = `M ${edgeX} ${tailY - tailHalfWidth} L ${tipX} ${tailY} L ${edgeX} ${tailY + tailHalfWidth} Z`;
  } else {
    const edgeY = deltaY >= 0 ? y + height : y;
    const tipY = edgeY + Math.sign(deltaY || 1) * tailLength;
    const tailX = clamp(marker.x, x + 16, x + width - 16);
    tailPath = `M ${tailX - tailHalfWidth} ${edgeY} L ${tailX} ${tipY} L ${tailX + tailHalfWidth} ${edgeY} Z`;
  }

  return { x, y, width, height, centerX, centerY, lines, tailPath };
}

function getShopIconCell(shop: Shop): IconCell | null {
  if (SPECIAL_ICON_CELLS.has(shop.id)) return SPECIAL_ICON_CELLS.get(shop.id) ?? null;
  if (shop.guideY === undefined) return null;
  const cells = shop.section === "시장 동측 통로" ? RIGHT_ICON_CELLS : shop.section === "시장 서측 통로" ? LEFT_ICON_CELLS : [];
  const nearest = cells.reduce<IconCell | null>((best, cell) => !best || Math.abs(cell.y + cell.height / 2 - shop.guideY) < Math.abs(best.y + best.height / 2 - shop.guideY) ? cell : best, null);
  return nearest && Math.abs(nearest.y + nearest.height / 2 - shop.guideY) <= 48 ? nearest : null;
}

// The Figma export already contains the exact label bounds for every shop.
// Keep the label and its map icon as separate hit areas: joining them into one
// large rectangle makes neighbouring shops overlap (especially on the south
// horizontal rows and on the east side of the market).
function getShopHitAreas(shop: Shop): HitArea[] {
  const labelPaddingX = 12;
  const labelPaddingY = shop.section === "시장 남측" ? 18 : 8;
  const areas: HitArea[] = [{
    x: shop.x - labelPaddingX,
    y: shop.y - labelPaddingY,
    width: shop.width + labelPaddingX * 2,
    height: shop.height + labelPaddingY * 2,
  }];
  const iconCell = getShopIconCell(shop);
  if (iconCell) areas.push(iconCell);
  const specialAreas = SPECIAL_HIT_AREAS.get(shop.id);
  if (specialAreas) areas.push(...specialAreas);
  return areas;
}

function getShopIconAsset(shop: Shop): string {
  const configuredIcon = shop.icon?.trim();
  if (configuredIcon) {
    const configuredAsset = ADMIN_ICON_ASSETS[configuredIcon];
    if (configuredAsset) return configuredAsset;
    if (/^(https?:|data:|\/)/.test(configuredIcon)) return configuredIcon;
  }
  return CATEGORY_ICON_ASSETS[shop.category] ?? "/images/figma-store-icon.svg";
}

export function getShopMapMarker(shop: Shop): Point {
  if (shop.guideX !== undefined && shop.guideY !== undefined && shop.guideX > 1000) {
    const iconCell = getShopIconCell(shop);
    return iconCell
      ? { x: iconCell.x + iconCell.width / 2, y: iconCell.y + iconCell.height / 2 }
      : { x: shop.guideX, y: shop.guideY };
  }
  const number = Number.parseInt(shop.id, 10);
  if (shop.section.includes("북동측")) return { x: 5250, y: 1852 + number * 90 };
  if (shop.section.includes("북측")) return { x: 4852, y: NORTH_AISLE_Y_BY_ID.get(number) ?? 1852 + number * 90 };
  if (shop.section.includes("서측 A")) return { x: clamp(1550 + (2775 - shop.x) * 1.25, 1550, 4900), y: 9320 };
  if (shop.section.includes("서측 B")) return { x: clamp(1550 + (2775 - shop.x) * 1.25, 1550, 4900), y: 9000 };
  return { x: 4850, y: clamp(10100 - shop.y * 1.45, 4800, 10000) };
}

function getRoutePointsForShop(shop: Shop): Point[] {
  const marker = getShopMapMarker(shop);
  const iconCell = getShopIconCell(shop);
  const isSouthHorizontalShop = shop.section === "시장 남측" && !!iconCell && iconCell.width > 52;

  if (CROSSWALK_SHOP_IDS.has(shop.id)) {
    return [
      ROUTE_ORIGIN,
      { x: MAIN_AISLE_X, y: CROSSWALK_Y },
      { x: CROSSWALK_WEST_X, y: CROSSWALK_Y },
      { x: CROSSWALK_EAST_X, y: CROSSWALK_Y },
      { x: EAST_SIDE_AISLE_X, y: marker.y },
    ];
  }

  return isSouthHorizontalShop
    ? [ROUTE_ORIGIN, { x: MAIN_AISLE_X, y: SOUTH_AISLE_Y }, { x: marker.x, y: SOUTH_AISLE_Y }]
    : [ROUTE_ORIGIN, { x: MAIN_AISLE_X, y: marker.y }];
}

export function getRouteDistanceForShop(shop: Shop): number {
  return Math.max(1, Math.round(getRouteDistanceMeters(getRoutePointsForShop(shop))));
}

export function MapView({ shops = [], iconShops = shops, selectedShop = null, onSelectShop, showRoute = false }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraAnimationRef = useRef<number | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ midpoint: Point; distance: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [center, setCenter] = useState<Point>(INITIAL_CENTER);
  const [labelPt, setLabelPt] = useState(INITIAL_LABEL_PT);
  const [isDragging, setIsDragging] = useState(false);
  const selectedMarker = useMemo(() => selectedShop ? getShopMapMarker(selectedShop) : null, [selectedShop]);
  const selectedIconCell = selectedShop ? getShopIconCell(selectedShop) : null;
  const routePoints = useMemo<Point[] | null>(() => {
    return showRoute && selectedShop ? getRoutePointsForShop(selectedShop) : null;
  }, [selectedShop, showRoute]);
  const mapScale = (labelPt * CSS_PIXELS_PER_POINT) / SOURCE_LABEL_HEIGHT;
  const mapScaleRef = useRef(mapScale);
  mapScaleRef.current = mapScale;
  const viewWidth = containerSize.width / mapScale;
  const viewHeight = containerSize.height / mapScale;
  const constrainedCenter = useMemo(() => clampCenter(center), [center]);
  const viewBox = `${constrainedCenter.x - viewWidth / 2} ${constrainedCenter.y - viewHeight / 2} ${viewWidth} ${viewHeight}`;

  const cancelCameraAnimation = useCallback(() => {
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
  }, []);

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
    cancelCameraAnimation();

    if (!showRoute || !routePoints || containerSize.width <= 1 || containerSize.height <= 1) {
      setCenter(clampCenter({ x: selectedMarker.x - 120, y: selectedMarker.y }));
      setLabelPt(INITIAL_LABEL_PT);
      return;
    }

    const routeLength = routePoints.slice(1).reduce((sum, point, index) => {
      const previous = routePoints[index];
      return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0);
    const duration = clamp(2200 + routeLength * 0.45, 2600, 6200);
    const panelOffsetY = DIRECTIONS_PANEL_HEIGHT / (2 * mapScaleRef.current);
    const cameraCenterFor = (point: Point) => clampCenter({ x: point.x, y: point.y + panelOffsetY });
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setCenter(cameraCenterFor(routePoints[routePoints.length - 1]));
      return;
    }

    setCenter(cameraCenterFor(routePoints[0]));
    const startedAt = performance.now();
    const animateCamera = (now: number) => {
      const elapsedProgress = clamp((now - startedAt) / duration, 0, 1);
      const routeProgress = easeInOutCubic(elapsedProgress);
      setCenter(cameraCenterFor(getPointAlongRoute(routePoints, routeProgress)));

      if (elapsedProgress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animateCamera);
      } else {
        cameraAnimationRef.current = null;
      }
    };
    cameraAnimationRef.current = requestAnimationFrame(animateCamera);

    return cancelCameraAnimation;
  }, [cancelCameraAnimation, containerSize.height, containerSize.width, routePoints, selectedMarker, showRoute]);

  const changeZoom = useCallback((nextLabelPt: number) => {
    cancelCameraAnimation();
    setLabelPt(clamp(nextLabelPt, MIN_LABEL_PT, MAX_LABEL_PT));
  }, [cancelCameraAnimation]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => { event.preventDefault(); cancelCameraAnimation(); setLabelPt((current) => clamp(current * Math.exp(-event.deltaY * 0.0015), MIN_LABEL_PT, MAX_LABEL_PT)); };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [cancelCameraAnimation]);

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
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => { cancelCameraAnimation(); event.currentTarget.setPointerCapture(event.pointerId); pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); setIsDragging(true); updateGesture(); };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => { const previous = pointersRef.current.get(event.pointerId); if (!previous) return; pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointersRef.current.size === 1) { panBy(event.clientX - previous.x, event.clientY - previous.y); gestureRef.current = { midpoint: { x: event.clientX, y: event.clientY }, distance: 0 }; } else updateGesture(); };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => { pointersRef.current.delete(event.pointerId); setIsDragging(pointersRef.current.size > 0); updateGesture(); };

  const selectedLabelBubble = selectedShop && selectedMarker ? getShopLabelBubble(selectedShop, selectedMarker) : null;
  const selectedIconAsset = selectedShop ? getShopIconAsset(selectedShop) : undefined;
  const selectedRotatedIcon = selectedShop ? SPECIAL_ROTATED_ICON_CELLS.get(selectedShop.id) : undefined;
  const routeTarget = routePoints?.[routePoints.length - 1] ?? null;
  const routeArrows = routePoints ? getRouteArrows(routePoints) : [];
  const routeDistance = selectedShop && routePoints ? getRouteDistanceForShop(selectedShop) : 0;
  const routeDistanceLabel = `${routeDistance}m`;
  const routeDistanceWidth = Math.max(132, routeDistanceLabel.length * 28 + 36);

  return <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-[#f7f7f7] touch-none select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" className="block h-full w-full" role="img" aria-label={selectedShop ? `${selectedShop.name}이 선택된 대조시장 지도` : "대조시장 안내 지도"}>
      <style>{`@keyframes routeDashFlow{to{stroke-dashoffset:-104}}@keyframes routeArrowPulse{0%,100%{opacity:.25}45%{opacity:1}}.route-flow-dash{animation:routeDashFlow 1.1s linear infinite}.route-flow-arrow{animation:routeArrowPulse 1.15s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.route-flow-dash,.route-flow-arrow{animation:none}}`}</style>
      <image href="/images/daejomarket-map.svg" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" pointerEvents="none" />
      {iconShops.map((shop) => {
        const cell = SPECIAL_ROTATED_ICON_CELLS.get(shop.id) ?? getShopIconCell(shop);
        if (!cell) return null;
        const rotated = SPECIAL_ROTATED_ICON_CELLS.get(shop.id);
        return <g key={shop.id} pointerEvents="none" transform={rotated ? `rotate(${rotated.rotation} ${rotated.originX} ${rotated.originY})` : undefined}>
          <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx="8" fill="#7a7a7a" />
          <image href={getShopIconAsset(shop)} x={cell.x + cell.width / 2 - 17} y={cell.y + cell.height / 2 - 17} width="34" height="34" />
        </g>;
      })}
      {shops.map((shop) => <g key={shop.id} role="button" tabIndex={0} aria-label={`${shop.name} 선택`} className="cursor-pointer outline-none" onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelectShop?.(shop.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectShop?.(shop.id); } }}><title>{shop.name}</title>{getShopHitAreas(shop).map((area, index) => <rect key={index} x={area.x} y={area.y} width={area.width} height={area.height} rx="8" fill="transparent" pointerEvents="all" />)}</g>)}
      {showRoute && routeTarget && routePoints && <g pointerEvents="none">
        <polyline points={routePoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#19bf69" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
        <polyline className="route-flow-dash" points={routePoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#d8f5e7" strokeWidth="5" strokeDasharray="18 34" strokeLinecap="round" strokeLinejoin="round" />
        {routeArrows.map((arrow, index) => <path className="route-flow-arrow" style={{ animationDelay: `${-(index % 12) * 0.075}s` }} key={`${index}-${arrow.x}-${arrow.y}`} d={`M ${arrow.x - 9} ${arrow.y + 11} L ${arrow.x} ${arrow.y - 7} L ${arrow.x + 9} ${arrow.y + 11} Z`} fill="#d8f5e7" transform={`rotate(${arrow.rotation} ${arrow.x} ${arrow.y})`} />)}
        <circle cx={routeTarget.x} cy={routeTarget.y} r="38" fill="#b7ead0" /><circle cx={routeTarget.x} cy={routeTarget.y} r="24" fill="#19bf69" />
        <rect x={routeTarget.x + 68} y={routeTarget.y - 35} width={routeDistanceWidth} height="70" rx="14" fill="#19bf69" /><text x={routeTarget.x + 68 + routeDistanceWidth / 2} y={routeTarget.y + 12} textAnchor="middle" fill="white" fontSize="38" fontWeight="700">{routeDistanceLabel}</text>
        <circle cx={ROUTE_ORIGIN.x} cy={ROUTE_ORIGIN.y} r="38" fill="#b7ead0" /><circle cx={ROUTE_ORIGIN.x} cy={ROUTE_ORIGIN.y} r="24" fill="#19bf69" />
      </g>}
      {selectedShop && selectedMarker && selectedLabelBubble && <g pointerEvents="none">
        <path d={selectedLabelBubble.tailPath} fill="#19bf69" />
        <rect x={selectedLabelBubble.x} y={selectedLabelBubble.y} width={selectedLabelBubble.width} height={selectedLabelBubble.height} rx="16" fill="#19bf69" />
        <text x={selectedLabelBubble.centerX} y={selectedLabelBubble.centerY} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="28" fontWeight="700" fontFamily="Noto Sans KR, sans-serif">
          {selectedLabelBubble.lines.map((line, index) => (
            <tspan key={`${index}-${line}`} x={selectedLabelBubble.centerX} dy={index === 0 ? `${-(selectedLabelBubble.lines.length - 1) * 19}px` : "38px"}>{line}</tspan>
          ))}
        </text>
        {selectedIconCell && selectedIconAsset && <><rect x={selectedIconCell.x} y={selectedIconCell.y} width={selectedIconCell.width} height={selectedIconCell.height} rx="8" fill="#09a956" /><image href={selectedIconAsset} x={selectedMarker.x - 17} y={selectedMarker.y - 17} width="34" height="34" /></>}
        {selectedRotatedIcon && selectedIconAsset && <g transform={`rotate(${selectedRotatedIcon.rotation} ${selectedRotatedIcon.originX} ${selectedRotatedIcon.originY})`}><rect x={selectedRotatedIcon.x} y={selectedRotatedIcon.y} width={selectedRotatedIcon.width} height={selectedRotatedIcon.height} rx="8" fill="#09a956" /><image href={selectedIconAsset} x={selectedRotatedIcon.x + selectedRotatedIcon.width / 2 - 17} y={selectedRotatedIcon.y + selectedRotatedIcon.height / 2 - 17} width="34" height="34" /></g>}
      </g>}
    </svg>
    <div className="absolute right-5 top-[210px] z-20 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-lg backdrop-blur" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="h-16 w-16 text-4xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200" aria-label="지도 확대" onClick={() => changeZoom(labelPt * 1.2)}>+</button><div className="h-px bg-black/10" /><button type="button" className="h-16 w-16 text-4xl font-semibold text-gray-800 hover:bg-gray-100 active:bg-gray-200" aria-label="지도 축소" onClick={() => changeZoom(labelPt / 1.2)}>−</button>
    </div>
  </div>;
}
