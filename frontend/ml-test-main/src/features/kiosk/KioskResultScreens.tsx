import { useEffect, useState } from "react";
import type { Shop } from "@/types/shop";

type Language = "ko" | "en" | "vi";

const GREEN = "linear-gradient(105deg, #289064 0%, #116543 82%)";

export function FloatingSearchBar({ value, onClick }: { value?: string; onClick: () => void }) {
  return (
    <div className="absolute left-[48px] right-[48px] top-[56px] z-30">
      <button
        type="button"
        onClick={onClick}
        className="flex h-[120px] w-full items-center gap-[16px] rounded-full border-2 border-[#ebebeb] bg-white/80 px-[48px] text-left shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]"
      >
        <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
        <span className={`text-[40px] leading-[52px] ${value ? "text-[#19211c]" : "text-[#a1a1a1]"}`}>
          {value || "검색어를 입력하세요"}
        </span>
      </button>
    </div>
  );
}

export type StatusKind = "processing" | "empty" | "connection";

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
};

export function SearchStatusScreen({
  kind,
  query,
  onBack,
  onRetry,
}: {
  kind: StatusKind;
  query: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const copy = statusCopy[kind];
  return (
    <main className="flex h-[1800px] flex-col items-center px-[48px] pb-[160px] pt-[320px] text-center text-[#0a3825]">
      <img src={copy.image} alt="" className="h-[200px] w-[200px] object-contain" />
      <h1 className="mt-[16px] text-[64px] font-bold leading-[1.4]">{copy.title}</h1>
      <p className="mt-[16px] text-[36px] font-medium leading-[44px]">{copy.body}</p>

      {kind === "empty" && (
        <div className="mt-[80px] w-full">
          <div className="flex h-[120px] items-center gap-[16px] rounded-full bg-[#ebebeb] px-[48px] text-left text-[40px] text-[#19211c]">
            <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
            <span>{query}</span>
          </div>
          <button type="button" onClick={onBack} className="mt-[40px] flex h-[120px] w-full items-center justify-center gap-[20px] rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>
            <span className="text-[44px]">↻</span> 다시 검색하기
          </button>
        </div>
      )}

      {kind === "processing" && (
        <button type="button" onClick={onBack} className="mt-[80px] h-[120px] w-full rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">검색 취소</button>
      )}

      {kind === "connection" && (
        <div className="mt-[80px] flex w-full gap-[24px]">
          <button type="button" onClick={onBack} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">이전으로</button>
          <button type="button" onClick={onRetry} className="flex h-[120px] flex-1 items-center justify-center gap-[20px] rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>
            <span className="text-[44px]">↻</span> 다시 시도
          </button>
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
  const languages: Array<{ value: Language; title: string; subtitle: string }> = [
    { value: "ko", title: "한국어", subtitle: "Korean" },
    { value: "en", title: "English", subtitle: "영어" },
    { value: "vi", title: "Tiếng Việt", subtitle: "베트남어" },
  ];
  return (
    <main className="flex h-[1800px] flex-col px-[48px] pb-[160px] pt-[320px] text-[#0a3825]">
      <div className="text-center">
        <h1 className="text-[64px] font-bold leading-[1.4]">사용할 언어를 선택하세요</h1>
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
              <span className="mt-[4px] text-[24px] text-[#19211c]">{item.subtitle}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-[40px] flex gap-[24px]">
        <button type="button" onClick={onBack} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">이전으로</button>
        <button type="button" onClick={onComplete} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>완료</button>
      </div>
    </main>
  );
}

function ResultCard({ shop, selected, onSelect }: { shop: Shop; selected: boolean; onSelect: () => void }) {
  const hasPhoto = shop.category === "식당" && shop.id !== "21";
  const tags = shop.id === "14" ? ["닭강정", "옛날통닭"] : shop.id === "21" ? ["한식뷔페"] : [shop.category, shop.section.replace("구역", "")];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-[164px] min-w-0 flex-1 items-center gap-[24px] rounded-[32px] border-2 px-[28px] py-[16px] text-left ${selected ? "border-[#116543] bg-[#e8f2ee]" : "border-[#ebebeb] bg-white"}`}
    >
      {hasPhoto ? (
        <img src="/figma/search-result-food.png" alt="" className="h-[120px] w-[120px] shrink-0 rounded-[16px] object-cover" />
      ) : (
        <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-[16px] bg-[#ebebeb] text-center text-[24px] font-bold leading-[28px] text-[#c9c9c9]">대조<br />시장</div>
      )}
      <div className="min-w-0">
        <strong className="block truncate text-[34px] font-bold leading-[44px] text-[#19211c]">{shop.name}</strong>
        <div className="mt-[8px] flex gap-[4px] overflow-hidden">
          {tags.slice(0, 3).map((tag) => <span key={tag} className={`shrink-0 rounded-[16px] px-[12px] py-[4px] text-[18px] leading-[28px] ${selected ? "bg-[#b9ead2] text-[#116543]" : "bg-[#ebebeb] text-[#6f6f6f]"}`}>{tag}</span>)}
        </div>
        <span className="mt-[8px] block text-[16px] text-[#a1a1a1]">현재 위치에서 {shop.id === "22" ? 1 : 2}분</span>
      </div>
    </button>
  );
}

export function ResultsPanel({
  shops,
  selectedId,
  onSelect,
  onSearchAgain,
  onDirections,
}: {
  shops: Shop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchAgain: () => void;
  onDirections: () => void;
}) {
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(shops.length / pageSize));
  const [page, setPage] = useState(1);
  const visible = shops.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [shops]);

  return (
    <section className="absolute bottom-0 left-0 right-0 z-30 h-[1112px] rounded-t-[32px] border-2 border-[#ebebeb] bg-white/80 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]">
      <div className="flex items-center justify-between">
        <h2 className="text-[36px] font-medium">{shops.length}개의 가게를 찾았어요</h2>
        <div className="flex rounded-full bg-[#ebebeb] p-[8px] text-[24px]">
          <button type="button" className="w-[180px] rounded-full bg-[#363636] py-[8px] text-white">정확도순</button>
          <button type="button" className="w-[180px] rounded-full py-[8px]">거리순</button>
        </div>
      </div>
      <div className="mt-[40px] grid grid-cols-2 gap-[16px]">
        {visible.map((shop) => <ResultCard key={shop.id} shop={shop} selected={selectedId === shop.id} onSelect={() => onSelect(shop.id)} />)}
      </div>
      <div className="mt-[48px] flex items-center justify-center gap-[16px] text-[28px]">
        {pageCount > 1 && (
          <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-[56px] w-[40px] text-[40px] disabled:text-[#c9c9c9]">‹</button>
        )}
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            onClick={() => setPage(pageNumber)}
            className={`h-[56px] w-[56px] rounded-[8px] ${pageNumber === page ? "bg-[#116543] text-white" : "bg-[#ebebeb] text-[#a1a1a1]"}`}
          >
            {pageNumber}
          </button>
        ))}
        {pageCount > 1 && (
          <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="h-[56px] w-[40px] text-[40px] disabled:text-[#c9c9c9]">›</button>
        )}
      </div>
      <div className="mt-[48px] flex gap-[24px]">
        <button type="button" onClick={onSearchAgain} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">다시 검색하기</button>
        <button type="button" disabled={!selectedId} onClick={onDirections} className="h-[120px] flex-1 rounded-full text-[40px] disabled:bg-[#ebebeb] disabled:text-[#a1a1a1]" style={selectedId ? { backgroundImage: GREEN, color: "white" } : undefined}>길 찾기</button>
      </div>
    </section>
  );
}

export function DirectionsPanel({ shopName, onBack, onHome }: { shopName: string; onBack: () => void; onHome: () => void }) {
  return (
    <section className="absolute bottom-0 left-0 right-0 z-30 h-[492px] rounded-t-[32px] border-2 border-[#ebebeb] bg-white/80 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]">
      <div className="flex items-center justify-between">
        <h2 className="max-w-[650px] text-[36px] font-bold leading-[52px]">“{shopName}”으로<br />이동하는 길을 알려드릴게요</h2>
        <p className="text-[48px] font-bold text-[#19211c]"><strong className="text-[80px] text-[#116543]">30</strong>m 이동</p>
      </div>
      <div className="mt-[48px] flex gap-[24px]">
        <button type="button" onClick={onBack} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">이전</button>
        <button type="button" onClick={onHome} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>처음으로</button>
      </div>
    </section>
  );
}

export function MarketMapPanel({ onHome, onSearch }: { onHome: () => void; onSearch: () => void }) {
  return (
    <section className="absolute bottom-0 left-0 right-0 z-30 h-[420px] rounded-t-[32px] border-2 border-[#ebebeb] bg-white/80 px-[48px] pb-[160px] pt-[40px] shadow-[4px_4px_32px_rgba(0,0,0,.24)] backdrop-blur-[16px]">
      <h2 className="text-[36px] font-medium">대조시장 전체 지도</h2>
      <div className="mt-[48px] flex gap-[24px]">
        <button type="button" onClick={onHome} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">처음으로</button>
        <button type="button" onClick={onSearch} className="h-[120px] flex-1 rounded-full text-[40px] text-white" style={{ backgroundImage: GREEN }}>검색하기</button>
      </div>
    </section>
  );
}
