/* eslint-disable @next/next/no-img-element */
"use client";

import { ChangeEvent, ComponentType, useEffect, useRef, useState } from "react";
import {
  CircleUserRound,
  Map as MapIcon,
  Milk,
  Search,
  Shirt,
  ShoppingCart,
  Soup,
  Store,
  Utensils,
  Wheat,
  X,
} from "lucide-react";
import { PromotionManager, SearchTagManager } from "./AdminFeaturePanels";
import { absoluteAssetUrl, getKioskExperience, saveManagedShops, saveOperationMode, uploadPromotion } from "@/lib/kioskExperienceApi";

type OperationMode = "길찾기" | "홍보";
type DialogState = "session" | "unsaved" | "invalid-move" | "saving" | "save-error" | "upload" | "upload-error" | null;
type IconOption = { label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> };
type ShopForm = { name: string; description: string; keywords: string };
type AdminShop = { name: string; meta: string; markerX: number; markerY: number };

const initialForm: ShopForm = {
  name: "불광돌쇠닭강정",
  description: "바삭한 닭강정과 옛날통닭을 판매하는 가게입니다.\n시장 구경 중 간편하게 포장해 갈 수 있어요.",
  keywords: "불광돌쇠닭강정, 음식점, 닭강정, 옛날통닭, 치킨",
};

const NORTH_AISLE_MARKER_X = 4850;
const SECOND_FLOOR_MARKER_X = 5250;
const northAisleY = (mapNumber: number) => 1852 + mapNumber * 90;
const mapShop = (name: string, meta: string, mapNumber: number, markerX = NORTH_AISLE_MARKER_X): AdminShop => ({
  name,
  meta,
  markerX,
  markerY: northAisleY(mapNumber),
});

const shops: AdminShop[] = [
  mapShop("남영상회", "지도 2·4번", 4), mapShop("행운손만두", "지도 7번", 7), mapShop("금산약초", "지도 8번", 8),
  mapShop("재덕정육점", "지도 9번", 9), mapShop("신흥고추", "지도 10번", 10), mapShop("서울건어물", "지도 11번", 11),
  mapShop("전라도김치", "지도 12번", 12), mapShop("고원문방구", "지도 13번", 13), mapShop("불광돌쇠닭강정", "선택됨 · 수정 중", 14),
  mapShop("황가네순대국 (2층)", "지도 3번", 3, SECOND_FLOOR_MARKER_X), mapShop("엉터리집 (2층)", "지도 5번", 5, SECOND_FLOOR_MARKER_X), mapShop("늘푸른야채", "지도 15번", 15),
  { name: "봉화장 여관 (2층)", meta: "지도에서 위치 확인", markerX: 4440, markerY: 3290 }, mapShop("문창식품", "지도 16번", 16), mapShop("대광사화장품", "지도 17번", 17),
  mapShop("좋은축산마을", "지도 18번", 18), { name: "칠공주 호떡&떡갈비", meta: "지도 번호 없음", markerX: 4440, markerY: 2480 }, mapShop("양지상회", "지도 20번", 20),
];

const iconOptions: IconOption[] = [
  { label: "정육청과수산", Icon: Wheat }, { label: "식품", Icon: Soup },
  { label: "식료품잡화", Icon: ShoppingCart }, { label: "농산물 가공", Icon: Milk },
  { label: "식당", Icon: Utensils }, { label: "의류잡화", Icon: Shirt },
  { label: "서비스업", Icon: CircleUserRound }, { label: "좌판", Icon: Store },
];

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

function ShopList({ selectedName, onSelect }: { selectedName: string; onSelect: (name: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = shops.filter(({ name, meta }) => `${name} ${meta}`.includes(search));
  return (
    <aside className="flex min-h-0 flex-col gap-[16px] overflow-hidden rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
      <div className="flex items-start gap-[12px]"><h2 className="flex-1 text-[20px] font-bold leading-[29px]">가게 목록</h2><span className="text-[12px] font-medium leading-[17px]">126개</span></div>
      <label className="flex shrink-0 items-center gap-[8px] rounded-full bg-[#f8fbf8] p-[12px] text-[#a1a1a1]"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="가게명 또는 지도 번호" className="min-w-0 flex-1 bg-transparent text-[14px] leading-[20px] outline-none placeholder:text-[#a1a1a1]" /></label>
      <div className="flex min-h-0 flex-1 flex-col gap-[8px] overflow-y-auto pr-[2px]">
        {filtered.map(({ name, meta }) => {
          const selected = name === selectedName;
          return <button type="button" key={name} onClick={() => onSelect(name)} className={`flex shrink-0 items-center gap-[12px] rounded-[14px] border p-[12px] text-left ${selected ? "border-[#116543] bg-[#cfeadb]" : "border-[#ebebeb] bg-white"}`}>
            <span className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${selected ? "bg-[#a1a1a1]" : "bg-[#ebebeb] text-[#116543]"}`}>
              {selected ? <img src="/api/design-asset/thumbnail" alt="" className="h-full w-full object-cover" /> : <Store size={24} />}
            </span>
            <span className="min-w-0"><strong className="block truncate text-[16px] leading-[23px]">{name}</strong><span className="block text-[12px] font-medium leading-[17px]">{meta}</span></span>
          </button>;
        })}
      </div>
    </aside>
  );
}

function MarketMap({ zoom, setZoom, selectedName, onSelect }: { zoom: number; setZoom: (value: number) => void; selectedName: string; onSelect: (name: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 852, height: 620 });
  const selectedShop = shops.find((shop) => shop.name === selectedName) ?? shops[8];
  const labelWidth = Math.max(250, selectedShop.name.length * 31 + 44);
  const viewWidth = 1100 / zoom;
  const viewHeight = viewWidth * (mapSize.height / mapSize.width);
  const focusX = selectedShop.markerX - Math.min(labelWidth * .42, 170);
  const focusY = selectedShop.markerY;
  const viewX = Math.min(Math.max(focusX - viewWidth / 2, 0), 6807 - viewWidth);
  const viewY = Math.min(Math.max(focusY - viewHeight / 2, 0), 10577 - viewHeight);
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

  const labelRight = selectedShop.markerX - 39;
  const labelLeft = labelRight - labelWidth;
  return (
    <section className="flex min-h-0 flex-col gap-[16px] rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
      <h2 className="flex items-center gap-[12px] text-[20px] font-bold leading-[29px]"><MapIcon size={20} />가게 지도</h2>
      <div ref={mapRef} className="relative min-h-0 flex-1 overflow-hidden rounded-[16px] bg-[#f1f2f1]">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={`${selectedShop.name} 위치가 선택된 대조시장 가게 지도`}>
          <image href="/api/design-asset/map" x="0" y="0" width="6807" height="10577" preserveAspectRatio="none" />
          {shops.map((shop) => {
            const hitWidth = Math.max(290, shop.name.length * 27 + 80);
            return (
              <g
                key={shop.name}
                role="button"
                tabIndex={0}
                aria-label={`${shop.name} 선택`}
                className="group cursor-pointer outline-none"
                onClick={() => onSelect(shop.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(shop.name);
                  }
                }}
              >
                <title>{shop.name}</title>
                <rect
                  x={shop.markerX - hitWidth - 35}
                  y={shop.markerY - 41}
                  width={hitWidth + 70}
                  height="82"
                  rx="18"
                  fill="transparent"
                  className="transition-colors group-hover:fill-[#12bf68]/15 group-focus:fill-[#12bf68]/15"
                />
              </g>
            );
          })}
          <g className="pointer-events-none" aria-hidden="true">
            <rect x={labelLeft} y={selectedShop.markerY - 34} width={labelWidth} height="68" rx="18" fill="#12bf68" />
            <path d={`M ${labelRight - 1} ${selectedShop.markerY - 18} L ${labelRight + 25} ${selectedShop.markerY} L ${labelRight - 1} ${selectedShop.markerY + 18} Z`} fill="#12bf68" />
            <rect x={selectedShop.markerX - 28} y={selectedShop.markerY - 34} width="56" height="68" rx="12" fill="#08a957" />
            <text x={labelLeft + 20} y={selectedShop.markerY + 11} fill="white" fontSize="34" fontWeight="700" fontFamily="Pretendard, Arial, sans-serif">{selectedShop.name}</text>
            <Utensils x={selectedShop.markerX - 17} y={selectedShop.markerY - 18} width={34} height={36} color="white" strokeWidth={2.4} />
          </g>
        </svg>
        <div className="absolute left-[16px] top-[16px] flex gap-[8px]">
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

function StoreEditor({ form, setForm, baseline, setBaseline, setDialog, saved, setSaved, iconOpen, setIconOpen, thumbnail, setThumbnail }: { form: ShopForm; setForm: React.Dispatch<React.SetStateAction<ShopForm>>; baseline: ShopForm; setBaseline: (form: ShopForm) => void; setDialog: (state: DialogState) => void; saved: boolean; setSaved: (value: boolean) => void; iconOpen: boolean; setIconOpen: (value: boolean) => void; thumbnail: string; setThumbnail: (value: string) => void }) {
  const [tags, setTags] = useState(["닭강정", "옛날통닭", "포장"]);
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState(4);
  const [nameError, setNameError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || iconOpen || !saved;

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
      const managed = { id: "22", name: form.name, description: form.description, keywords: form.keywords, tags, thumbnailUrl: thumbnail.startsWith("/api/") ? "" : thumbnail, icon: iconOptions[selectedIcon].label };
      await saveManagedShops([...config.shops.filter((shop) => shop.id !== managed.id), managed]);
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
      <section className="flex flex-col gap-[8px]"><strong className="text-[14px] leading-[20px]">카드 미리보기</strong><div className="flex justify-center rounded-[24px] bg-[#ebebeb] px-[12px] py-[24px]"><div className="flex h-[120px] w-[426px] items-center gap-[17px] rounded-[23px] border border-[#ebebeb] bg-white px-[23px]"><img src={thumbnail.startsWith("/api/") ? thumbnail : absoluteAssetUrl(thumbnail)} alt="" className="h-[87px] w-[87px] rounded-[12px] object-cover" /><div className="min-w-0"><strong className="block truncate text-[26px] leading-[32px]">{form.name || "가게명"}</strong><div className="mt-[10px] flex gap-[3px]">{tags.map((tag) => <span key={tag} className="rounded-full bg-[#ebebeb] px-[9px] py-[3px] text-[13px] text-[#6f6f6f]">{tag}</span>)}</div><span className="mt-[6px] block text-[12px] text-[#a1a1a1]">현재 위치에서 2분</span></div></div></div></section>
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
  const [selectedShopName, setSelectedShopName] = useState(initialForm.name);
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
  const selectShop = (name: string) => {
    const next = { name, description: "", keywords: name };
    setSelectedShopName(name);
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
        <ShopList selectedName={selectedShopName} onSelect={selectShop} /><MarketMap zoom={zoom} setZoom={setZoom} selectedName={selectedShopName} onSelect={selectShop} /><StoreEditor form={form} setForm={setForm} baseline={baseline} setBaseline={setBaseline} setDialog={setDialog} saved={saved} setSaved={setSaved} iconOpen={iconOpen} setIconOpen={setIconOpen} thumbnail={thumbnail} setThumbnail={setThumbnail} />
      </div>
      </>}
    </div>
    {dialog && <ConfirmDialog state={dialog} progress={progress} onClose={closeDialog} onPrimary={primaryDialogAction} onSecondary={secondaryDialogAction} />}
  </main>;
}
