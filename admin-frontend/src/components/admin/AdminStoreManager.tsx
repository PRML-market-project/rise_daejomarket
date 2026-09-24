/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, ComponentType, useEffect, useRef, useState } from "react";
import {
  Map as MapIcon,
  Search,
  Store,
  X,
} from "lucide-react";
import { PromotionManager, SearchTagManager } from "./AdminFeaturePanels";
import { absoluteAssetUrl, getKioskExperience, saveManagedShops, saveOperationMode, uploadPromotion } from "@/lib/kioskExperienceApi";
import { figmaMapShops, leftMapIconCells, rightMapIconCells, type FigmaMapIconCell } from "@/data/figmaMapShops";

type OperationMode = "길찾기" | "홍보";
type DialogState = "session" | "unsaved" | "invalid-move" | "saving" | "save-error" | "upload" | "upload-error" | null;
type IconOption = { label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> };
type ShopForm = { name: string; description: string; keywords: string };

const initialForm: ShopForm = {
  name: "불광돌쇠닭강정",
  description: "바삭한 닭강정과 옛날통닭을 판매하는 가게입니다.\n시장 구경 중 간편하게 포장해 갈 수 있어요.",
  keywords: "불광돌쇠닭강정, 음식점, 닭강정, 옛날통닭, 치킨",
};

type PositionedShop = (typeof figmaMapShops)[number] & { iconCell: FigmaMapIconCell | null };
const specialIconCells = new Map<string, FigmaMapIconCell>([
  ["585:28760", { x: 4826, y: 1979, width: 52, height: 320 }],
  ["585:28763", { x: 4758, y: 2245, width: 52, height: 54 }],
  ["585:28764", { x: 4758, y: 2307, width: 52, height: 54 }],
  ["585:30183", { x: 4758, y: 3267, width: 52, height: 54 }],
  ["585:28881", { x: 4670, y: 4565, width: 95, height: 52 }],
  ["585:28882", { x: 4826, y: 4548, width: 52, height: 69 }],
  ["585:28839", { x: 4827, y: 7799, width: 52, height: 98 }],
  ["585:28880", { x: 4539, y: 7798, width: 95, height: 52 }],
  ["585:28845", { x: 4827, y: 8883, width: 52, height: 231 }],
  ["585:28846", { x: 4827, y: 9541, width: 52, height: 154 }],
  ["585:28847", { x: 4657, y: 9094, width: 95, height: 52 }],
  ["585:28848", { x: 4451, y: 9094, width: 95, height: 52 }],
  ["585:28849", { x: 4554, y: 9094, width: 95, height: 52 }],
  ["585:28850", { x: 4348, y: 9094, width: 95, height: 52 }],
  ["585:28851", { x: 4087, y: 9094, width: 95, height: 52 }],
  ["585:30204", { x: 3984, y: 9094, width: 95, height: 52 }],
  ["585:30205", { x: 3881, y: 9094, width: 95, height: 52 }],
  ["585:28852", { x: 3735, y: 9094, width: 95, height: 52 }],
  ["585:28854", { x: 3632, y: 9094, width: 95, height: 52 }],
  ["585:28855", { x: 3054, y: 9094, width: 74, height: 52 }],
  ["585:28856", { x: 2972, y: 9094, width: 74, height: 52 }],
  ["585:28857", { x: 2689, y: 9094, width: 95, height: 52 }],
  ["585:30215", { x: 2586, y: 9094, width: 95, height: 52 }],
  ["585:28858", { x: 2377, y: 9094, width: 95, height: 52 }],
  ["585:28859", { x: 1634, y: 9094, width: 95, height: 52 }],
  ["585:28860", { x: 1509, y: 9348, width: 95, height: 52 }],
  ["585:30219", { x: 1936, y: 9349, width: 104, height: 52 }],
  ["585:28861", { x: 2048, y: 9349, width: 102, height: 52 }],
  ["585:28862", { x: 2158, y: 9349, width: 104, height: 52 }],
  ["585:28863", { x: 2462, y: 9348, width: 95, height: 52 }],
  ["585:28865", { x: 2913, y: 9349, width: 161, height: 52 }],
  ["585:28866", { x: 3320, y: 9348, width: 95, height: 52 }],
  ["585:28867", { x: 3492, y: 9349, width: 68, height: 52 }],
  ["585:28868", { x: 3764, y: 9349, width: 109, height: 52 }],
  ["585:28869", { x: 4184, y: 9349, width: 132, height: 52 }],
  ["585:28870", { x: 4464, y: 9349, width: 133, height: 52 }],
  ["585:28871", { x: 4745, y: 9349, width: 132, height: 52 }],
  ["585:28872", { x: 3568, y: 9349, width: 68, height: 52 }],
  ["585:28873", { x: 3881, y: 9349, width: 109, height: 52 }],
  ["585:28874", { x: 4324, y: 9349, width: 132, height: 52 }],
  ["585:28875", { x: 4605, y: 9349, width: 132, height: 52 }],
  ["585:28876", { x: 1839, y: 9094, width: 95, height: 52 }],
  ["585:28877", { x: 2890, y: 9094, width: 74, height: 52 }],
  ["585:28878", { x: 1737, y: 9094, width: 94, height: 52 }],
  ["585:28879", { x: 2274, y: 9094, width: 95, height: 52 }],
  ["585:28795", { x: 5649, y: 6027, width: 52, height: 119 }],
  ["585:28796", { x: 5649, y: 6154, width: 52, height: 119 }],
  ["585:28797", { x: 5754, y: 6555, width: 52, height: 119 }],
]);

const shops: PositionedShop[] = figmaMapShops.map((shop) => {
  const specialCell = specialIconCells.get(shop.id);
  if (specialCell) {
    return { ...shop, markerX: specialCell.x + specialCell.width / 2, markerY: specialCell.y + specialCell.height / 2, iconCell: specialCell };
  }
  const cells = shop.section === "시장 동측 통로" ? rightMapIconCells : shop.section === "시장 서측 통로" ? leftMapIconCells : [];
  const nearest = cells.reduce<FigmaMapIconCell | null>((best, cell) => !best || Math.abs(cell.y + cell.height / 2 - shop.markerY) < Math.abs(best.y + best.height / 2 - shop.markerY) ? cell : best, null);
  const iconCell = nearest && Math.abs(nearest.y + nearest.height / 2 - shop.markerY) <= 48 ? nearest : null;
  return iconCell ? { ...shop, markerX: iconCell.x + iconCell.width / 2, markerY: iconCell.y + iconCell.height / 2, iconCell } : { ...shop, iconCell: null };
});

const ADMIN_ROUTE_ORIGIN = { x: 4920, y: 4291.5 };
const ADMIN_SOUTH_AISLE_Y = 9247.5;
const ADMIN_CROSSWALK_SHOP_IDS = new Set(["585:28795", "585:28796", "585:28797"]);
const ADMIN_DISTANCE_REFERENCE = {
  snackBar: { x: 4853, y: 9618 },
  pharmacy: { x: 4853, y: 1620.5 },
  goldButcher: { x: 1556.5, y: 9374 },
};
const ADMIN_Y_UNITS_PER_METER = Math.abs(ADMIN_DISTANCE_REFERENCE.snackBar.y - ADMIN_DISTANCE_REFERENCE.pharmacy.y) / 319;
const ADMIN_GOLD_VERTICAL_METERS = Math.abs(ADMIN_DISTANCE_REFERENCE.snackBar.y - ADMIN_DISTANCE_REFERENCE.goldButcher.y) / ADMIN_Y_UNITS_PER_METER;
const ADMIN_X_UNITS_PER_METER = Math.abs(ADMIN_DISTANCE_REFERENCE.snackBar.x - ADMIN_DISTANCE_REFERENCE.goldButcher.x)
  / Math.sqrt(138 ** 2 - ADMIN_GOLD_VERTICAL_METERS ** 2);

function getAdminRouteDistanceMeters(shopId: string) {
  const shop = shops.find((item) => item.id === shopId);
  if (!shop) return 0;
  const marker = { x: shop.markerX, y: shop.markerY };
  const routePoints = ADMIN_CROSSWALK_SHOP_IDS.has(shop.id)
    ? [ADMIN_ROUTE_ORIGIN, { x: 4920, y: 3804 }, { x: 5060, y: 3804 }, { x: 5540, y: 3804 }, { x: 5540, y: marker.y }]
    : shop.section === "시장 남측" && !!shop.iconCell && shop.iconCell.width > 52
      ? [ADMIN_ROUTE_ORIGIN, { x: 4920, y: ADMIN_SOUTH_AISLE_Y }, { x: marker.x, y: ADMIN_SOUTH_AISLE_Y }]
      : [ADMIN_ROUTE_ORIGIN, { x: 4920, y: marker.y }];
  const distance = routePoints.slice(1).reduce((sum, point, index) => {
    const previous = routePoints[index];
    return sum + Math.hypot(
      (point.x - previous.x) / ADMIN_X_UNITS_PER_METER,
      (point.y - previous.y) / ADMIN_Y_UNITS_PER_METER,
    );
  }, 0);
  return Math.max(1, Math.round(distance));
}


const iconOptions: IconOption[] = [
  ["정육청과수산", "wheat"], ["식품", "washoku"], ["식료품잡화", "shopping-cart"],
  ["농산물 가공", "milk"], ["식당", "restaurant"], ["의류잡화", "apparel"],
  ["서비스업", "person"], ["좌판", "store"],
].map(([label, asset]) => ({
  label,
  Icon: function MapAsset({ size = 24 }) {
    return <svg width={size} height={size} viewBox="0 0 34 34"><image href={`/map-icons/figma-${asset}-icon.svg`} width="34" height="34" /></svg>;
  },
}));

function PillButton({ children, kind = "primary", disabled, className = "", onClick }: { children: React.ReactNode; kind?: "primary" | "secondary" | "outline"; disabled?: boolean; className?: string; onClick?: () => void }) {
  const colors = kind === "primary" ? "bg-[#116543] text-white" : kind === "outline" ? "border border-[#a1a1a1] bg-[#f8fbf8] text-[#19211c]" : "bg-[#ebebeb] text-[#19211c]";
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex h-[48px] items-center justify-center rounded-full px-[20px] text-[16px] font-medium leading-[23px] transition hover:brightness-[.98] disabled:cursor-default disabled:opacity-50 ${colors} ${className}`}>{children}</button>;
}

function Header({ mode, onLogout }: { mode: OperationMode; onLogout: () => void }) {
  return (
    <header className="flex h-[80px] shrink-0 items-center gap-[32px] border-b border-[#ebebeb] bg-white px-[32px]">
      <div className="flex items-center gap-[20px]">
        <img src="/api/design-asset/logo" alt="대조시장" className="h-[44px] w-[142px]" />
        <strong className="text-[16px] leading-[23px]">관리자</strong>
      </div>
      <div className="flex-1" />
      <div className="flex h-[47px] items-center gap-[6px] rounded-full bg-[#cfeadb] px-[24px] text-[16px] font-medium">
        <span className="h-[8px] w-[8px] rounded-full bg-[#168259]" /> {mode} 운영 중
      </div>
      <PillButton kind="secondary" className="w-[112px]" onClick={onLogout}>로그아웃</PillButton>
    </header>
  );
}

function OperationPanel({ current, selected, onSelect, onApply }: { current: OperationMode; selected: OperationMode; onSelect: (mode: OperationMode) => void; onApply: () => void }) {
  return (
    <section className="flex h-[115px] items-center justify-between rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
      <div className="flex gap-[40px]">
        <div className="flex w-[280px] flex-col gap-[16px]">
          <span className="text-[14px] font-medium leading-[20px]">현재 운영 중</span>
          <strong className="flex items-center gap-[4px] text-[24px] leading-[29px] text-[#116543]"><span className="h-[8px] w-[8px] rounded-full bg-[#168259]" />{current} 서비스</strong>
        </div>
        <div className="flex flex-col gap-[8px]">
          <span className="text-[14px] font-medium leading-[20px]">모드 변경하기</span>
          <div className="flex gap-[8px]">
            {(["길찾기", "홍보"] as OperationMode[]).map((mode) => <PillButton key={mode} kind={selected === mode ? "primary" : "secondary"} className="w-[128px]" onClick={() => onSelect(mode)}>{mode}</PillButton>)}
          </div>
        </div>
      </div>
      <PillButton kind={selected === current ? "secondary" : "primary"} className="w-[180px]" disabled={selected === current} onClick={onApply}>운영 모드 적용</PillButton>
    </section>
  );
}

function ShopList({ selectedId, onSelect }: { selectedId: string; onSelect: (name: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = shops.filter(({ name, number }) => `${name} ${number}`.includes(search));
  return (
    <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
      <div className="flex items-start gap-[12px]"><h2 className="flex-1 text-[20px] font-bold leading-[29px]">가게 목록</h2><span className="text-[12px] font-medium leading-[17px]">{shops.length}개</span></div>
      <label className="flex shrink-0 items-center gap-[8px] rounded-full bg-[#f8fbf8] p-[12px] text-[#a1a1a1]"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="가게명 또는 지도 번호" className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] outline-none placeholder:text-[#a1a1a1]" /></label>
      <div className="flex min-h-0 flex-1 flex-col gap-[8px] overflow-y-auto pr-[2px]">
        {filtered.map(({ id, name }) => {
          const selected = id === selectedId;
          return <button type="button" key={id} onClick={() => onSelect(id)} className={`flex shrink-0 items-center gap-[12px] rounded-[14px] border p-[12px] text-left ${selected ? "border-[#116543] bg-[#cfeadb]" : "border-[#ebebeb] bg-white"}`}>
            <span className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${selected ? "bg-[#a1a1a1]" : "bg-[#ebebeb] text-[#116543]"}`}>
              {selected ? <img src="/api/design-asset/thumbnail" alt="" className="h-full w-full object-cover" /> : <Store size={24} />}
            </span>
            <span className="min-w-0"><strong className="block truncate text-[16px] leading-[23px]">{name}</strong></span>
          </button>;
        })}
      </div>
    </aside>
  );
}

function MarketMap({ zoom, setZoom, selectedId, iconByShopId, onSelect }: { zoom: number; setZoom: (value: number) => void; selectedId: string; iconByShopId: Record<string, string>; onSelect: (name: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 852, height: 620 });
  const selectedShop = shops.find((shop) => shop.id === selectedId) ?? shops[8];
  const defaultIconLabel = selectedShop.category === "식당" ? "식당"
    : selectedShop.category === "서비스업" ? "서비스업"
      : selectedShop.category === "잡화" ? "식료품잡화"
        : selectedShop.category === "식품" ? "식품"
          : "정육청과수산";
  const selectedIconLabel = iconByShopId[selectedShop.id] || defaultIconLabel;
  const SelectedMapIcon = iconOptions.find((option) => option.label === selectedIconLabel)?.Icon ?? Store;
  const [center, setCenter] = useState({ x: selectedShop.markerX, y: selectedShop.markerY });
  const [isPanning, setIsPanning] = useState(false);
  const pointerRef = useRef<{ id: number; x: number; y: number; shopId: string | null } | null>(null);
  const draggedRef = useRef(false);
  const viewWidth = 1100 / zoom;
  const viewHeight = viewWidth * (mapSize.height / mapSize.width);
  const viewX = Math.min(Math.max(center.x - viewWidth / 2, 0), 6807 - viewWidth);
  const viewY = Math.min(Math.max(center.y - viewHeight / 2, 0), 10577 - viewHeight);
  const viewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;

  useEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    const updateSize = () => {
      const bounds = container.getBoundingClientRect();
      setMapSize({ width: Math.max(bounds.width, 1), height: Math.max(bounds.height, 1) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCenter({ x: selectedShop.markerX, y: selectedShop.markerY });
  }, [selectedShop.id, selectedShop.markerX, selectedShop.markerY]);

  const labelCenterX = selectedShop.x + selectedShop.width / 2;
  const labelCenterY = selectedShop.y + selectedShop.height / 2;
  const labelWidth = Math.max(96, selectedShop.width + 32);
  const labelHeight = Math.max(58, selectedShop.height + 20);
  const labelX = labelCenterX - labelWidth / 2;
  const labelY = labelCenterY - labelHeight / 2;
  const deltaX = selectedShop.markerX - labelCenterX;
  const deltaY = selectedShop.markerY - labelCenterY;
  const tailPath = Math.abs(deltaX) > Math.abs(deltaY)
    ? (() => {
        const edgeX = deltaX >= 0 ? labelX + labelWidth : labelX;
        const tailY = Math.min(Math.max(selectedShop.markerY, labelY + 16), labelY + labelHeight - 16);
        return `M ${edgeX} ${tailY - 9} L ${edgeX + Math.sign(deltaX || 1) * 16} ${tailY} L ${edgeX} ${tailY + 9} Z`;
      })()
    : (() => {
        const edgeY = deltaY >= 0 ? labelY + labelHeight : labelY;
        const tailX = Math.min(Math.max(selectedShop.markerX, labelX + 16), labelX + labelWidth - 16);
        return `M ${tailX - 9} ${edgeY} L ${tailX} ${edgeY + Math.sign(deltaY || 1) * 16} L ${tailX + 9} ${edgeY} Z`;
      })();

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const shopId = (event.target as Element).closest<SVGGElement>("[data-shop-id]")?.dataset.shopId ?? null;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, shopId };
    draggedRef.current = false;
    setIsPanning(true);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointerRef.current;
    if (!previous || previous.id !== event.pointerId) return;
    const deltaScreenX = event.clientX - previous.x;
    const deltaScreenY = event.clientY - previous.y;
    if (Math.hypot(deltaScreenX, deltaScreenY) > 2) draggedRef.current = true;
    const worldDeltaX = deltaScreenX * viewWidth / mapSize.width;
    const worldDeltaY = deltaScreenY * viewHeight / mapSize.height;
    setCenter((current) => ({
      x: Math.min(Math.max(current.x - worldDeltaX, viewWidth / 2), 6807 - viewWidth / 2),
      y: Math.min(Math.max(current.y - worldDeltaY, viewHeight / 2), 10577 - viewHeight / 2),
    }));
    pointerRef.current = { ...previous, x: event.clientX, y: event.clientY };
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (pointer?.id !== event.pointerId) return;
    pointerRef.current = null;
    setIsPanning(false);
    if (!draggedRef.current && pointer.shopId) onSelect(pointer.shopId);
  };

  return (
    <section className="flex min-h-0 flex-col gap-[16px] rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
      <h2 className="flex items-center gap-[12px] text-[20px] font-bold leading-[29px]"><MapIcon size={20} />가게 지도</h2>
      <div ref={mapRef} className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden rounded-[16px] bg-[#f1f2f1] ${isPanning ? "cursor-grabbing" : "cursor-grab"}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd}>
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={`${selectedShop.name} 위치가 선택된 대조시장 가게 지도`}>
          <image href="/images/daejomarket-map.svg" x="0" y="0" width="6807" height="10577" preserveAspectRatio="none" />
          {shops.map((shop) => {
            const cell = shop.iconCell;
            if (!cell) return null;
            const fallback = shop.category === "식당" ? "식당" : shop.category === "서비스업" ? "서비스업" : shop.category === "잡화" ? "식료품잡화" : shop.category === "식품" ? "식품" : "정육청과수산";
            const Icon = iconOptions.find((option) => option.label === (iconByShopId[shop.id] || fallback))?.Icon ?? iconOptions[7].Icon;
            return <g key={shop.id} pointerEvents="none">
              <rect x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx="8" fill="#7a7a7a" />
              <g transform={`translate(${cell.x + cell.width / 2 - 17} ${cell.y + cell.height / 2 - 17})`}><Icon size={34} /></g>
            </g>;
          })}
          {shops.map((shop) => {
            return (
              <g
                key={shop.id}
                role="button"
                tabIndex={0}
                aria-label={`${shop.name} 선택`}
                data-shop-id={shop.id}
                className="cursor-pointer outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(shop.id);
                  }
                }}
              >
                <title>{shop.name}</title>
                <rect x={shop.x - 12} y={shop.y - 8} width={shop.width + 24} height={shop.height + 16} rx="8" fill="transparent" pointerEvents="all" />
                {shop.iconCell && <rect x={shop.iconCell.x} y={shop.iconCell.y} width={shop.iconCell.width} height={shop.iconCell.height} rx="8" fill="transparent" pointerEvents="all" />}
              </g>
            );
          })}
          <g className="pointer-events-none" aria-hidden="true">
            <path d={tailPath} fill="#12bf68" />
            <rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} rx="16" fill="#12bf68" />
            <text x={labelCenterX} y={labelCenterY} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="28" fontWeight="700" fontFamily="Pretendard, Arial, sans-serif">{selectedShop.name}</text>
            {selectedShop.iconCell && <><rect x={selectedShop.iconCell.x} y={selectedShop.iconCell.y} width={selectedShop.iconCell.width} height={selectedShop.iconCell.height} rx="8" fill="#08a957" /><g transform={`translate(${selectedShop.markerX - 16} ${selectedShop.markerY - 17})`} color="white"><SelectedMapIcon size={32} strokeWidth={2.4} /></g></>}
          </g>
        </svg>
        <div className="absolute left-[16px] top-[16px] flex gap-[8px]" onPointerDown={(event) => event.stopPropagation()}>
          <PillButton kind="secondary" className="w-[48px] px-0" onClick={() => setZoom(Math.max(.65, zoom - .15))}>−</PillButton>
          <PillButton kind="secondary" className="w-[48px] px-0" onClick={() => setZoom(Math.min(1.7, zoom + .15))}>+</PillButton>
          <PillButton kind="secondary" className="w-[104px]" onClick={() => setZoom(1)}>전체 보기</PillButton>
        </div>
      </div>
      <p className="text-[14px] font-medium leading-[21px] text-[#a1a1a1]">목록 또는 지도에서 가게를 선택하면 위치와 정보를 확인할 수 있습니다.</p>
    </section>
  );
}

function Field({ label, value, onChange, multiline, error }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; error?: string }) {
  const className = `w-full rounded-[12px] border bg-white p-[12px] text-[16px] font-medium leading-[23px] outline-none focus:border-[#116543] ${error ? "border-[#b3261e]" : "border-[#ebebeb]"}`;
  return <label className="flex flex-col gap-[8px] text-[14px] font-bold leading-[20px]">{label}{multiline ? <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={`${className} min-h-[112px] resize-none`} /> : <input value={value} onChange={(e) => onChange(e.target.value)} className={`${className} min-h-[48px]`} />}{error && <span className="font-medium text-[#b3261e]">{error}</span>}</label>;
}

function IconPicker({ open, selected, onToggle, onSelect }: { open: boolean; selected: number; onToggle: () => void; onSelect: (index: number) => void }) {
  const CurrentIcon = iconOptions[selected].Icon;
  return <section className="flex flex-col gap-[16px] rounded-[12px] bg-[#f6f6f6] px-[24px] py-[12px]">
    <strong className="text-[14px] leading-[20px]">지도 아이콘</strong>
    <div className="flex items-center gap-[16px]"><span className="flex h-[34px] w-[34px] items-center justify-center rounded-[6px] bg-[#7a7a7a] text-white"><CurrentIcon size={22} /></span><span className="flex-1 text-[16px] font-medium">{selected === 4 ? "식사" : iconOptions[selected].label}</span><PillButton kind="outline" className="h-[32px] w-[136px] shrink-0 whitespace-nowrap text-[14px]" onClick={onToggle}>{open ? "닫기" : "아이콘 변경"}</PillButton></div>
    {open && <div className="grid grid-cols-4 gap-[12px]">{iconOptions.map(({ label, Icon }, index) => <button type="button" key={label} onClick={() => onSelect(index)} className={`flex flex-col items-center gap-[8px] rounded-[12px] border p-[8px] text-[14px] font-medium ${selected === index ? "border-2 border-[#116543] bg-[#cfeadb]" : "border-[#e1e5e1] bg-[#f8fbf8]"}`}><span className="flex h-[34px] w-[34px] items-center justify-center rounded-[6px] bg-[#7a7a7a] text-white"><Icon size={23} /></span>{label}</button>)}</div>}
  </section>;
}

function StoreEditor({ shopId, form, setForm, baseline, setBaseline, setDialog, saved, setSaved, iconOpen, setIconOpen, thumbnail, setThumbnail, onSavedIcon }: { shopId: string; form: ShopForm; setForm: React.Dispatch<React.SetStateAction<ShopForm>>; baseline: ShopForm; setBaseline: (form: ShopForm) => void; setDialog: (state: DialogState) => void; saved: boolean; setSaved: (value: boolean) => void; iconOpen: boolean; setIconOpen: (value: boolean) => void; thumbnail: string; setThumbnail: (value: string) => void; onSavedIcon: (shopId: string, icon: string) => void }) {
  const [tags, setTags] = useState(["닭강정", "옛날통닭", "포장"]);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState(4);
  const [nameError, setNameError] = useState("");
  const [translations, setTranslations] = useState<Record<string, { en?: string; vi?: string }>>({});
  const [translationPending, setTranslationPending] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || iconOpen || !saved;
  const distanceMeters = getAdminRouteDistanceMeters(shopId);

  useEffect(() => {
    let disposed = false;
    getKioskExperience().then((config) => {
      if (disposed) return;
      setTranslations(config.translations ?? {});
      setTranslationPending(config.pendingTranslations ?? 0);
      const managed = config.shops.find((shop) => shop.id === shopId);
      const shop = shops.find((item) => item.id === shopId);
      const fallback = shop?.category === "식당" ? "식당" : shop?.category === "서비스업" ? "서비스업" : shop?.category === "잡화" ? "식료품잡화" : shop?.category === "식품" ? "식품" : "정육청과수산";
      const iconIndex = iconOptions.findIndex((option) => option.label === (managed?.icon || fallback));
      setSelectedIcon(iconIndex >= 0 ? iconIndex : 7);
      setTags(managed?.tags ?? []);
      setThumbnail(managed?.thumbnailUrl || "/api/design-asset/thumbnail");
      if (managed) {
        const loadedForm = { name: managed.name, description: managed.description, keywords: managed.keywords };
        setForm(loadedForm);
        setBaseline(loadedForm);
      }
      setSaved(true);
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, [shopId, setBaseline, setForm, setSaved, setThumbnail]);

  const finishTagEditing = (index: number) => {
    setTags((all) => {
      const value = all[index]?.trim() ?? "";
      if (!value) return all.filter((_, tagIndex) => tagIndex !== index);
      return all.map((tag, tagIndex) => tagIndex === index ? value : tag);
    });
    setEditingTagIndex(null);
    setSaved(false);
  };

  const save = async () => {
    if (!form.name.trim()) { setNameError("가게명을 입력해주세요."); return; }
    setNameError(""); setDialog("saving");
    try {
      const config = await getKioskExperience();
      const managed = { id: shopId, name: form.name, description: form.description, keywords: form.keywords, tags, thumbnailUrl: thumbnail.startsWith("/api/") ? "" : thumbnail, icon: iconOptions[selectedIcon].label };
      const savedConfig = await saveManagedShops([...config.shops.filter((shop) => shop.id !== managed.id), managed]);
      setTranslations(savedConfig.translations ?? {});
      setTranslationPending(savedConfig.pendingTranslations ?? 0);
      onSavedIcon(managed.id, managed.icon);
      setBaseline(form); setSaved(true); setDialog(null); setIconOpen(false);
    } catch { setDialog("save-error"); }
  };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setDialog("upload-error"); return; }
    setDialog("upload");
    try { const uploaded = await uploadPromotion(file); setThumbnail(uploaded.url); setDialog(null); setSaved(false); }
    catch { setDialog("upload-error"); }
  };

  return <section className="flex min-h-0 flex-col gap-[40px] overflow-hidden rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
    <div className="flex shrink-0 items-center gap-[12px]"><h2 className="flex-1 text-[32px] font-bold leading-[32px]">가게 정보</h2><span className="rounded-full bg-[#cfeadb] px-[12px] py-[6px] text-[14px] font-medium text-[#0a3825]">{saved && !dirty ? "저장 완료" : "수정 중"}</span></div>
    <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto pr-[3px]">
      <Field label="가게명 *" value={form.name} onChange={(name) => { setForm((prev) => ({ ...prev, name })); setNameError(""); setSaved(false); }} error={nameError} />
      <Field multiline label="가게 설명" value={form.description} onChange={(description) => { setForm((prev) => ({ ...prev, description })); setSaved(false); }} />
      <section className="flex flex-col gap-[8px] rounded-[12px] bg-[#f6f6f6] px-[24px] py-[12px]">
        <div className="flex text-[14px] font-bold leading-[20px]"><span className="flex-1">설명 태그</span><span className="font-medium text-[#116543]">{tags.length} / 3</span></div>
        <div className="flex flex-wrap gap-[8px]">{tags.map((tag, index) => <span key={index} className="flex min-h-[34px] items-center rounded-full bg-[#cfeadb] px-[12px] py-[5px] text-[14px] font-medium text-[#0a3825]">{editingTagIndex === index ? <input autoFocus value={tag} maxLength={20} placeholder="태그 입력" aria-label={`${index + 1}번째 설명 태그`} onChange={(event) => { const value = event.target.value; setTags((all) => all.map((item, tagIndex) => tagIndex === index ? value : item)); setSaved(false); }} onBlur={() => finishTagEditing(index)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-[92px] bg-transparent outline-none placeholder:text-[#56816f]" /> : <button type="button" onClick={() => setEditingTagIndex(index)} className="max-w-[120px] truncate text-left">{tag}</button>}<button type="button" aria-label={`${tag || "빈"} 태그 삭제`} onClick={() => { setTags((all) => all.filter((_, tagIndex) => tagIndex !== index)); setEditingTagIndex(null); setSaved(false); }} className="ml-[7px] text-[17px] leading-none">×</button></span>)}<button type="button" disabled={tags.length >= 3} onClick={() => { setTags((all) => [...all, ""]); setEditingTagIndex(tags.length); setSaved(false); }} className="min-h-[34px] whitespace-nowrap rounded-full bg-[#ebebeb] px-[12px] py-[6px] text-[14px] font-medium disabled:opacity-50">+ 추가</button></div>
        <p className="text-[14px] font-medium leading-[21px] text-[#a1a1a1]">최대 3개 · 태그를 삭제하면 새 태그를 추가할 수 있어요.</p>
      </section>
      <section className="rounded-[12px] bg-[#f6f6f6] px-[24px] py-[12px]"><Field label="검색용 키워드 · 관리자 전용" value={form.keywords} onChange={(keywords) => { setForm((prev) => ({ ...prev, keywords })); setSaved(false); }} /><p className="mt-[6px] text-[14px] font-medium leading-[21px] text-[#a1a1a1]">검색에만 사용되며, 이용자 화면에는 표시되지 않습니다. 쉼표로 구분하세요.</p></section>
      <section className="flex flex-col gap-[8px] rounded-[12px] bg-[#f6f6f6] px-[24px] py-[12px]"><strong className="text-[14px] leading-[20px]">썸네일 이미지</strong><div className="flex items-center gap-[16px]"><img src={thumbnail.startsWith("/api/") ? thumbnail : absoluteAssetUrl(thumbnail)} alt="현재 썸네일" className="h-[96px] w-[96px] rounded-[12px] object-cover" /><div className="flex flex-1 flex-col gap-[16px]"><span className="text-[14px] font-medium">가게_썸네일.jpg</span><div className="flex gap-[8px]"><PillButton kind="secondary" className="h-[32px] w-[120px] text-[14px]" onClick={() => fileRef.current?.click()}>이미지 교체</PillButton><PillButton kind="secondary" className="h-[32px] w-[120px] text-[14px]" onClick={() => { setThumbnail("/api/design-asset/thumbnail"); setSaved(false); }}>기본 이미지</PillButton></div></div><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={chooseFile} /></div></section>
      <IconPicker open={iconOpen} selected={selectedIcon} onToggle={() => setIconOpen(!iconOpen)} onSelect={(index) => { setSelectedIcon(index); setIconOpen(false); setSaved(false); }} />
      <section className="flex flex-col gap-[8px]"><strong className="text-[14px] leading-[20px]">카드 미리보기</strong><div className="flex justify-center rounded-[24px] bg-[#ebebeb] px-[12px] py-[24px]"><div className="flex h-[120px] w-[426px] items-center gap-[17px] rounded-[23px] border border-[#ebebeb] bg-white px-[23px]"><img src={thumbnail.startsWith("/api/") ? thumbnail : absoluteAssetUrl(thumbnail)} alt="" className="h-[87px] w-[87px] rounded-[12px] object-cover" /><div className="min-w-0"><strong className="block truncate text-[26px] leading-[32px]">{form.name || "가게명"}</strong><div className="mt-[10px] flex gap-[3px]">{tags.map((tag, index) => <span key={`${index}-${tag}`} className="rounded-full bg-[#ebebeb] px-[9px] py-[3px] text-[13px] text-[#6f6f6f]">{tag}</span>)}</div><span className="mt-[6px] block text-[12px] text-[#a1a1a1]">현재 위치에서 {distanceMeters}m</span></div></div></div></section>
    </div>
    <div className="shrink-0 rounded-xl bg-[#f6f6f6] p-3 text-[13px] leading-5">
      <strong>영어 · 베트남어 자동 번역</strong>
      <p>EN: {translations[form.name.trim()]?.en || "저장 시 자동 번역"}</p>
      <p>VI: {translations[form.name.trim()]?.vi || "저장 시 자동 번역"}</p>
      <p className={translationPending ? "text-[#b3261e]" : "text-[#116543]"}>{translationPending ? `번역 대기 ${translationPending}개: 한국어는 저장되었습니다. Argos 번역 서버 실행 상태 확인 후 다시 저장하거나 서버를 재시작하세요.` : "이름·설명·검색어·태그를 번역하여 함께 저장합니다."}</p>
    </div>
    <div className="flex shrink-0 flex-col gap-[8px]"><p className={`text-[14px] font-medium leading-[17px] ${saved && !dirty ? "text-[#116543]" : "text-[#116543]"}`}>{saved && !dirty ? "모든 변경 내용이 저장되었습니다." : "저장하지 않은 변경 내용이 있습니다."}</p><div className="flex gap-[12px]"><PillButton kind="secondary" className="h-[56px] w-[144px]" onClick={() => { setForm(baseline); setNameError(""); setIconOpen(false); }}>변경 취소</PillButton><PillButton className="h-[56px] flex-1" onClick={save}>가게 정보 저장</PillButton></div></div>
  </section>;
}

function ConfirmDialog({ state, progress, onClose, onPrimary, onSecondary }: { state: Exclude<DialogState, null>; progress: number; onClose: () => void; onPrimary: () => void; onSecondary: () => void }) {
  const config = {
    session: { title: "다시 로그인해주세요.", body: <>로그인 시간이 만료되었습니다.<br />작성 중인 내용은 다시 로그인한 뒤 이어서 수정할 수 있습니다.</>, primary: "다시 로그인", secondary: "" },
    unsaved: { title: "변경 내용을 저장할까요?", body: <>변경한 내용이 아직 저장되지 않았습니다.</>, primary: "저장 후 이동", secondary: "저장 안 함" },
    "invalid-move": { title: "입력 오류를 수정해주세요", body: <>입력 오류가 있어 저장할 수 없습니다.<br />계속 수정하거나 변경 내용을 버리고 이동해주세요.</>, primary: "무시하고 이동하기", secondary: "이전으로" },
    saving: { title: "가게 정보를 저장하고 있어요", body: <>저장이 끝날 때까지 잠시만 기다려주세요.</>, primary: "", secondary: "" },
    "save-error": { title: "저장하지 못했어요", body: <>작성한 내용은 그대로 남아 있습니다.<br />연결을 확인한 뒤 다시 저장해주세요.</>, primary: "다시 저장", secondary: "이전으로" },
    upload: { title: "이미지를 올리고 있어요", body: <>업로드가 끝나기 전까지 기존 이미지를 유지합니다.</>, primary: "", secondary: "업로드 취소" },
    "upload-error": { title: "이미지를 올리지 못했어요", body: <>기존 이미지는 그대로 유지됩니다.<br />다시 시도하거나 다른 파일을 선택해주세요.</>, primary: "다시 시도", secondary: "파일 다시 선택" },
  }[state];
  const passive = state === "saving" || state === "upload";
  return <div className="admin-fade-in fixed inset-0 z-50 flex items-center justify-center bg-[rgba(25,33,28,.48)] p-[24px]" role="dialog" aria-modal="true"><div className="flex w-[640px] flex-col gap-[24px] rounded-[20px] bg-white p-[32px] shadow-xl"><div className="flex items-center justify-between"><h2 className="text-[28px] font-bold leading-[41px] text-[#0a3825]">{config.title}</h2>{!passive && <button type="button" onClick={onClose} aria-label="닫기"><X size={24} /></button>}</div><div className="text-[16px] font-medium leading-[24px]">{config.body}</div>{state === "upload" && <div><p className="mb-[8px] text-[14px] font-medium text-[#0a3825]">업로드 중 · {progress}%</p><div className="h-[8px] overflow-hidden rounded-full bg-[#ebebeb]"><div className="h-full rounded-full bg-[#116543] transition-all" style={{ width: `${progress}%` }} /></div></div>}{state === "saving" && <div className="flex justify-center"><span className="admin-spin h-[32px] w-[32px] rounded-full border-[3px] border-[#cfeadb] border-t-[#116543]" /></div>}{(config.primary || config.secondary) && <div className="flex gap-[12px]">{config.secondary && <PillButton kind="secondary" className="h-[56px] flex-1" onClick={onSecondary}>{config.secondary}</PillButton>}{config.primary && <PillButton className="h-[56px] flex-1" onClick={onPrimary}>{config.primary}</PillButton>}</div>}</div></div>;
}

export default function AdminStoreManager() {
  const [currentMode, setCurrentMode] = useState<OperationMode>("길찾기");
  const [selectedMode, setSelectedMode] = useState<OperationMode>("길찾기");
  const [form, setForm] = useState(initialForm);
  const [baseline, setBaseline] = useState(initialForm);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [progress, setProgress] = useState(60);
  const [saved, setSaved] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState("/api/design-asset/thumbnail");
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState<"store" | "promotion" | "tags">("store");
  const [selectedShopId, setSelectedShopId] = useState("585:28772");
  const [iconByShopId, setIconByShopId] = useState<Record<string, string>>({});
  const [pendingPage, setPendingPage] = useState<"store" | "promotion" | "tags">("promotion");
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || iconOpen || !saved;

  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get("state");
    if (state === "session-expired") setDialog("session");
    if (state === "unsaved") setDialog("unsaved");
    if (state === "invalid-move") { setForm((prev) => ({ ...prev, name: "" })); setDialog("invalid-move"); }
    if (state === "saving") setDialog("saving");
    if (state === "save-error") setDialog("save-error");
    if (state === "upload") setDialog("upload");
    if (state === "upload-error") setDialog("upload-error");
    if (state === "icon-open") setIconOpen(true);
    if (state === "saved") { setSaved(true); setBaseline(initialForm); }
    const page = new URLSearchParams(window.location.search).get("page");
    if (page === "promotion" || page === "tags") setActivePage(page);
    getKioskExperience().then((config) => {
      const mode: OperationMode = config.operationMode === "PROMOTION" ? "홍보" : "길찾기";
      setCurrentMode(mode); setSelectedMode(mode);
      setIconByShopId(Object.fromEntries(config.shops.map((shop) => [shop.id, shop.icon])));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (dialog !== "upload") return;
    const timer = window.setInterval(() => setProgress((value) => value >= 92 ? 60 : value + 4), 400);
    return () => window.clearInterval(timer);
  }, [dialog]);

  const logout = () => { localStorage.removeItem("accessToken"); localStorage.removeItem("refreshToken"); document.cookie = "accessToken=; Max-Age=0; path=/"; window.location.href = "/login"; };
  const requestNavigation = (page: "store" | "promotion" | "tags") => {
    setPendingPage(page);
    if (!form.name.trim()) setDialog("invalid-move");
    else if (dirty) setDialog("unsaved");
    else setActivePage(page);
  };
  const selectShop = (id: string) => {
    const name = shops.find((shop) => shop.id === id)?.name ?? "" ;
    const next = { name, description: "", keywords: name };
    setSelectedShopId(id);
    setForm(next);
    setBaseline(next);
    setSaved(true);
    setIconOpen(false);
  };
  const closeDialog = () => setDialog(null);
  const primaryDialogAction = () => {
    if (dialog === "session") { logout(); return; }
    if (dialog === "unsaved") { setBaseline(form); setSaved(true); setDialog(null); setActivePage(pendingPage); return; }
    if (dialog === "invalid-move") { setForm(baseline); setDialog(null); setActivePage(pendingPage); return; }
    if (dialog === "save-error") { setDialog("saving"); window.setTimeout(() => { setBaseline(form); setSaved(true); setDialog(null); }, 900); return; }
    if (dialog === "upload-error") { setDialog("upload"); }
  };
  const secondaryDialogAction = () => {
    if (dialog === "unsaved") { setForm(baseline); setDialog(null); setActivePage(pendingPage); return; }
    if (dialog === "upload-error") { setDialog(null); document.querySelector<HTMLInputElement>('input[type="file"]')?.click(); return; }
    setDialog(null);
  };

  return <main className="min-h-screen min-w-[1400px] bg-[#f8fbf8]">
    <Header mode={currentMode} onLogout={logout} />
    <div className="px-[32px] pb-[24px] pt-[24px]">
      {activePage === "promotion" && <PromotionManager onNavigate={setActivePage} onModeApply={(mode) => { setCurrentMode(mode); setSelectedMode(mode); }} />}
      {activePage === "tags" && <SearchTagManager onBack={() => setActivePage("store")} />}
      {activePage === "store" && <>
      <div className="flex h-[60px] items-start justify-between"><div className="flex gap-[32px] text-[40px] leading-[60px]"><button type="button" onClick={() => requestNavigation("store")} className="font-bold text-[#0a3825]">가게 관리</button><button type="button" onClick={() => requestNavigation("promotion")} className="font-medium text-[#c3c3c3]">홍보 관리</button></div><PillButton kind="outline" onClick={() => requestNavigation("tags")}>검색 태그 관리하기　›</PillButton></div>
      <div className="mt-[20px]"><OperationPanel current={currentMode} selected={selectedMode} onSelect={setSelectedMode} onApply={async () => { try { await saveOperationMode(selectedMode === "홍보" ? "PROMOTION" : "DIRECTIONS"); setCurrentMode(selectedMode); } catch { setDialog("save-error"); } }} /></div>
      <div className="mt-[20px] grid h-[calc(100vh-343px)] min-h-[737px] grid-cols-[300px_minmax(500px,852px)_minmax(480px,656px)] justify-between gap-[24px]">
        <ShopList selectedId={selectedShopId} onSelect={selectShop} /><MarketMap zoom={zoom} setZoom={setZoom} selectedId={selectedShopId} iconByShopId={iconByShopId} onSelect={selectShop} /><StoreEditor shopId={shops.find((shop) => shop.id === selectedShopId)?.id ?? shops[0].id} form={form} setForm={setForm} baseline={baseline} setBaseline={setBaseline} setDialog={setDialog} saved={saved} setSaved={setSaved} iconOpen={iconOpen} setIconOpen={setIconOpen} thumbnail={thumbnail} setThumbnail={setThumbnail} onSavedIcon={(shopId, icon) => setIconByShopId((current) => ({ ...current, [shopId]: icon }))} />
      </div>
      </>}
    </div>
    {dialog && <ConfirmDialog state={dialog} progress={progress} onClose={closeDialog} onPrimary={primaryDialogAction} onSecondary={secondaryDialogAction} />}
  </main>;
}
