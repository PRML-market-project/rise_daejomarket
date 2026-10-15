import { useKioskLocale } from "./i18n";
import { useEffect, useState } from "react";
import { getSearchResultPage, type ResultSortMode, type SearchResult } from "./searchResultPresentation";
import type { Shop } from "@/types/shop";
import type { RouteGuidanceDirection } from "@/components/market/MapView";

type Language = "ko" | "en" | "vi";

const GREEN = "linear-gradient(105deg, #289064 0%, #116543 82%)";

export function FloatingSearchBar({ value, onClick }: { value?: string; onClick: () => void }) {
  const { t } = useKioskLocale();
  return (
    <div className="absolute left-[48px] right-[48px] top-[56px] z-30">
      <button
        type="button"
        onClick={onClick}
        className="flex h-[120px] w-full items-center gap-[16px] rounded-full border-2 border-[#ebebeb] bg-white/80 px-[48px] text-left shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]"
      >
        <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
        <span className={`text-[40px] leading-[52px] ${value ? "text-[#19211c]" : "text-[#a1a1a1]"}`}>
          {value || t("검색어를 입력하세요")}
        </span>
      </button>
    </div>
  );
}

export type StatusKind = "processing" | "empty" | "connection" | "answer";

const statusCopy: Record<StatusKind, { image: string; title: string; body: string }> = {
  processing: {
    image: "/figma/searching.png",
    title: "관련 가게를 찾고 있어요",
    body: "입력하신 가게 이름·업종·품목을 확인하고 있어요.",
  },
  empty: {
    image: "/figma/no-results.png",
    title: "적절한 가게를 찾지 못했어요",
    body: "다른 이름이나 더 짧은 말로 다시 찾아보세요.",
  },
  connection: {
    image: "/figma/connection-error.png",
    title: "연결이 잠시 끊겼어요",
    body: "입력한 내용을 유지하고 있어요. 잠시 후 다시 시도해주세요.",
  },
  answer: {
    image: "/figma/searching.png",
    title: "검색 결과를 안내해 드릴게요",
    body: "",
  },
};

export function SearchStatusScreen({
  kind,
  query,
  message,
  onBack,
  onRetry,
}: {
  kind: StatusKind;
  query: string;
  message?: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const { t } = useKioskLocale();
  const copy = statusCopy[kind];
  return (
    <main className={`flex h-[1800px] flex-col items-center px-[48px] pb-[160px] pt-[320px] text-center text-[#0a3825] ${kind === "connection" ? "font-['Kiosk_Result_Noto',sans-serif]" : ""}`}>
      <img src={copy.image} alt="" className="h-[200px] w-[200px] object-contain" />
      <h1 className="mt-[16px] text-[64px] font-bold leading-[1.4]">{t(copy.title)}</h1>
      <p className="mt-[16px] text-[36px] font-medium leading-[44px]">{message && (kind === "empty" || kind === "answer") ? message : t(copy.body)}</p>

      {(kind === "empty" || kind === "answer") && (
        <div className="mt-[80px] w-full">
          <div className="flex h-[120px] items-center gap-[16px] rounded-full bg-[#ebebeb] px-[48px] text-left text-[40px] text-[#19211c]">
            <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
            <span>{query}</span>
          </div>
          <button type="button" onClick={onBack} className="mt-[40px] flex h-[120px] w-full items-center justify-center gap-[20px] rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>
            <span className="text-[44px]">↻</span>{t("다시 검색하기")}</button>
        </div>
      )}

      {kind === "processing" && (
        <button type="button" onClick={onBack} className="mt-[80px] h-[120px] w-full rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">{t("검색 취소")}</button>
      )}

      {kind === "connection" && (
        <div className="mt-[80px] flex w-full gap-[24px]">
          <button type="button" onClick={onBack} className="flex h-[120px] w-[320px] shrink-0 items-center justify-center rounded-full bg-[#ebebeb] p-[24px] text-[40px] font-normal leading-[52px] text-[#19211c]">{t("이전으로")}</button>
          <button type="button" onClick={onRetry} className="flex h-[120px] flex-1 items-center justify-center gap-[24px] rounded-full p-[24px] text-[40px] font-normal leading-[52px] text-white" style={{ backgroundImage: "linear-gradient(102.376deg, #289064 0%, #116543 74.487%)" }}>
            <img src="/figma/refresh-ccw.svg" alt="" className="shrink-0" />{t("다시 시도")}</button>
        </div>
      )}
    </main>
  );
}

export function LanguageSelectionScreen({
  selected,
  onSelect,
  onBack,
  onComplete,
}: {
  selected: Language;
  onSelect: (language: Language) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const { t } = useKioskLocale();
  const languages: Array<{ value: Language; title: string; subtitle: string }> = [
    { value: "ko", title: "한국어", subtitle: "Korean" },
    { value: "en", title: "English", subtitle: "영어" },
    { value: "vi", title: "Tiếng Việt", subtitle: "베트남어" },
  ];
  return (
    <main className="flex h-[1800px] flex-col px-[48px] pb-[160px] pt-[320px] text-[#0a3825]">
      <div className="text-center">
        <h1 className="text-[64px] font-bold leading-[1.4]">{t("사용할 언어를 선택하세요")}</h1>
        <p className="mt-[16px] text-[36px] font-medium">Choose a language · Chọn ngôn ngữ</p>
      </div>
      <div className="mt-[80px] flex flex-col gap-[16px]">
        {languages.map((item) => {
          const active = selected === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              className={`flex h-[160px] flex-col justify-center rounded-[32px] border-2 px-[32px] text-left ${active ? "border-[#116543] bg-[#e8f2ee]" : "border-[#ebebeb] bg-white"}`}
            >
              <span className="text-[40px] text-[#19211c]">{item.title}</span>
              <span className="mt-[4px] text-[24px] text-[#19211c]">{t(item.subtitle)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-[40px] flex gap-[24px]">
        <button type="button" onClick={onBack} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">{t("이전으로")}</button>
        <button type="button" onClick={onComplete} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>{t("완료")}</button>
      </div>
    </main>
  );
}

function ResultCard({ shop, number, distanceMeters, selected, onSelect }: { shop: Shop; number: number; distanceMeters: number; selected: boolean; onSelect: () => void }) {
  const { t } = useKioskLocale();
  const tags = shop.tags?.length ? shop.tags : shop.id === "14" ? ["닭강정", "옛날통닭"] : shop.id === "21" ? ["한식뷔페"] : [shop.category, shop.section.replace("구역", "")];
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-result-card={number}
      onClick={onSelect}
      className={`flex h-[164px] min-w-0 items-center gap-[24px] rounded-[32px] border-2 px-[32px] py-[16px] font-['Kiosk_Result_Noto',sans-serif] text-left tracking-normal shadow-[0_0_8px_rgba(0,0,0,0.2)] ${selected ? "border-[#116543] bg-[#e8f2ee]" : "border-[#a1a1a1] bg-white"}`}
    >
      {shop.thumbnailUrl ? (
        <img src={shop.thumbnailUrl} alt="" className="h-[120px] w-[120px] shrink-0 rounded-[16px] object-cover" />
      ) : (
        <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-[16px] bg-[#ebebeb]"><img src="/figma/results/shop-placeholder.svg" alt="" /></div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-[8px]">
          <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[#cfeadb] font-['Kiosk_Map_Pretendard',sans-serif] text-[16px] font-semibold leading-[28px] tracking-[-0.8px] text-[#116543]">{String(number).padStart(2, "0")}</span>
          <strong className="block min-w-0 truncate text-[36px] font-bold leading-[44px] text-[#19211c]" title={t(shop.name)}>{t(shop.name)}</strong>
        </div>
        <div className="mt-[16px] flex gap-[4px] overflow-hidden">
          {tags.slice(0, 3).map((tag, index) => <span key={`${tag}-${index}`} className={`shrink-0 rounded-[16px] px-[12px] py-[4px] text-[18px] font-medium leading-[28px] ${selected ? "bg-[#b9ead2] text-[#116543]" : "bg-[#ebebeb] text-[#6f6f6f]"}`}>{t(tag)}</span>)}
        </div>
        <span className="mt-[8px] block text-[16px] font-medium leading-[28px] text-[#a1a1a1]">{t("현재 위치에서 {distance}m", { distance: distanceMeters })}</span>
      </div>
    </button>
  );
}

function ResultAnswer({ answer, onDismiss }: { answer: string; onDismiss: () => void }) {
  const { t } = useKioskLocale();
  return <div className="absolute left-[-2px] top-[-144px] flex h-[120px] w-[920px] items-center gap-[10px] pl-[32px]">
    <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full bg-[#363636]">
      <div className="relative h-[90px] w-[90px] shadow-[4px_4px_32px_rgba(0,0,0,0.4)]">
        <img src="/figma/results/mascot-base.png" alt="" className="absolute inset-0 h-[90px] w-[90px] object-cover" />
        <img src="/figma/results/mascot-overlay.png" alt="" className="absolute inset-0 h-[90px] w-[90px] object-cover" />
      </div>
    </div>
    <div className="flex items-center">
      <span aria-hidden="true" className="relative mr-[-12px] flex h-[22.627px] w-[22.627px] shrink-0 items-center justify-center"><img src="/figma/results/bubble-tail.svg" alt="" className="rotate-45" /></span>
      <div className="relative flex w-[540px] items-start gap-[12px] rounded-[24px] bg-[#363636] py-[16px] pl-[24px] pr-[16px]">
        <p role="status" className="min-w-0 flex-1 whitespace-pre-line break-words text-[20px] font-medium leading-[28px] text-white">{answer}</p>
        <button type="button" onClick={onDismiss} aria-label={t("안내 닫기")} className="relative shrink-0 after:absolute after:inset-[-10px]"><img src="/figma/results/close.svg" alt="" /></button>
      </div>
    </div>
  </div>;
}

export function ResultsPanel({
  results,
  sortMode,
  onSortModeChange,
  page,
  onPageChange,
  answer,
  selectedId,
  onSelect,
  onSearchAgain,
  onDirections,
}: {
  results: SearchResult[];
  sortMode: ResultSortMode;
  onSortModeChange: (mode: ResultSortMode) => void;
  page: number;
  onPageChange: (page: number) => void;
  answer?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchAgain: () => void;
  onDirections: () => void;
}) {
  const { t } = useKioskLocale();
  const [answerDismissed, setAnswerDismissed] = useState(false);
  useEffect(() => { setAnswerDismissed(false); }, [answer]);
  const panelHeight = 1128;
  const { pageCount, visible } = getSearchResultPage(results, page);

  return (
    <section
      className="absolute bottom-0 left-0 right-0 z-30 rounded-t-[32px] border-2 border-[#ebebeb] bg-white/90 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]"
      style={{ height: panelHeight }}
    >
      {answer && !answerDismissed && <ResultAnswer answer={answer} onDismiss={() => setAnswerDismissed(true)} />}
      <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center justify-between">
        <h2 className="text-[36px] font-medium">{t("{count}개의 가게를 찾았어요", { count: results.length })}</h2>
        <div className="flex gap-[8px] rounded-full bg-[#ebebeb] p-[8px] text-[24px]">
          <button
            type="button"
            aria-pressed={sortMode === "relevance"}
            onClick={() => onSortModeChange("relevance")}
            className={`w-[180px] rounded-full py-[8px] leading-[40px] ${sortMode === "relevance" ? "bg-[#363636] text-white" : "text-[#19211c]"}`}
          >{t("정확도순")}</button>
          <button
            type="button"
            aria-pressed={sortMode === "distance"}
            onClick={() => onSortModeChange("distance")}
            className={`w-[180px] rounded-full py-[8px] leading-[40px] ${sortMode === "distance" ? "bg-[#363636] text-white" : "text-[#19211c]"}`}
          >{t("거리순")}</button>
        </div>
      </div>
      <div className="mt-[56px] grid h-[524px] shrink-0 auto-rows-[164px] grid-cols-2 content-start gap-[16px]">
        {visible.map(({ shop, number, distanceMeters }) => <ResultCard key={shop.id} shop={shop} number={number} distanceMeters={distanceMeters} selected={selectedId === shop.id} onSelect={() => onSelect(shop.id)} />)}
      </div>
      <div className="mt-[48px] flex h-[56px] shrink-0 items-center justify-center gap-[16px] font-['Kiosk_Result_Inter',sans-serif] text-[28px] font-medium leading-[22px] tracking-normal">
          <button type="button" aria-label={t("이전")} disabled={page === 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="flex h-[56px] w-[24px] items-center justify-center disabled:opacity-40"><img src="/figma/results/previous.svg" alt="" className="rotate-180" /></button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
            className={`flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[8px] ${pageNumber === page ? "bg-[#116543] text-white" : "bg-[#ebebeb] text-[#a1a1a1]"}`}
          >
            {pageNumber}
          </button>
        ))}
          <button type="button" aria-label={t("다음")} disabled={page === pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} className="flex h-[56px] w-[24px] items-center justify-center disabled:opacity-40"><img src="/figma/results/next.svg" alt="" /></button>
      </div>
      <div className="mx-[-2px] mt-[48px] flex shrink-0 gap-[24px]">
        <button type="button" onClick={onSearchAgain} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">{t("다시 검색하기")}</button>
        <button type="button" disabled={!selectedId} onClick={onDirections} className="h-[120px] flex-1 rounded-full text-[40px] disabled:bg-[#ebebeb] disabled:text-[#a1a1a1]" style={selectedId ? { backgroundImage: GREEN, color: "white" } : undefined}>{t("길 찾기")}</button>
      </div>
      </div>
    </section>
  );
}

export function DirectionsPanel({ shopName, direction, distanceMeters, onBack, onHome }: { shopName: string; direction: RouteGuidanceDirection; distanceMeters: number; onBack: () => void; onHome: () => void }) {
  const { t } = useKioskLocale();
  const lastCode = shopName.trim().slice(-1).charCodeAt(0);
  const hasFinalConsonant = lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0;
  return (
    <section className="absolute bottom-0 left-0 right-0 z-30 flex h-[604px] flex-col justify-end rounded-t-[32px] border-2 border-[#ebebeb] bg-white/80 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]">
      <div className="flex h-[400px] shrink-0 flex-col justify-between">
      <div className="flex min-h-[120px] items-center gap-[32px]">
        <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full bg-[#116543]">
          <img src="/figma/results/directions-map.png" alt="" className="h-[100px] w-[100px] object-cover shadow-[4px_4px_24px_rgba(0,0,0,0.25)]" />
        </div>
        <h2 className="min-w-0 text-[40px] font-bold leading-[52px] text-[#19211c]">
          <span className="block break-words">{t(hasFinalConsonant ? "“{name}”은" : "“{name}”는", { name: t(shopName) })}</span>
          {direction === "behind"
            ? <span className="block">{t("바로 뒤에 있어요")}</span>
            : <span className="block">{direction === "left" ? t("왼쪽으로") : t("오른쪽으로")} <strong className="text-[#22a36b] underline decoration-[4px]">{distanceMeters}m</strong> {t("이동하세요")}</span>}
        </h2>
      </div>
      <div className="mx-[-2px] flex gap-[24px]">
        <button type="button" onClick={onBack} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">{t("이전")}</button>
        <button type="button" onClick={onHome} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>{t("처음으로")}</button>
      </div>
      </div>
    </section>
  );
}

export function MarketMapPanel({ onHome, onSearch }: { onHome: () => void; onSearch: () => void }) {
  const { t } = useKioskLocale();
  return (
    <section className="absolute bottom-0 left-0 right-0 z-30 h-[420px] rounded-t-[32px] border-2 border-[#ebebeb] bg-white/80 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]">
      <h2 className="text-[36px] font-medium">{t("대조시장 전체 지도")}</h2>
      <div className="mt-[48px] flex gap-[24px]">
        <button type="button" onClick={onHome} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">{t("처음으로")}</button>
        <button type="button" onClick={onSearch} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>{t("검색하기")}</button>
      </div>
    </section>
  );
}
