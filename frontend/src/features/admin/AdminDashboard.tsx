"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { downloadAnalytics, getDashboard, koreaToday, offsetDate, recentRange } from "./dashboardApi";
import type { AnalyticsBucket, AnalyticsRank, DashboardSummary, DateRange } from "./dashboardApi";

const COLORS = ["#116543", "#bc8241", "#43838b", "#8d729f", "#6f87a3", "#a8b9ad"];
const number = (value: number) => value.toLocaleString("ko-KR");
const dateLabel = (date: string) => date.replace(/-/g, ". ") + ".";
const rangeLabel = (range: DateRange) => range.start === range.end ? dateLabel(range.end) : `${dateLabel(range.start)} – ${dateLabel(range.end)}`;
const card = "rounded-[20px] border border-[#ebebeb] bg-white";
const selectClass = "h-[41px] rounded-[10px] border border-[#91bca1] bg-white px-[16px] text-[16px] font-bold text-[#0a3825]";

function Button({ children, onClick, selected, outline, disabled, className = "" }: { children: ReactNode; onClick?: () => void; selected?: boolean; outline?: boolean; disabled?: boolean; className?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex h-[48px] items-center justify-center gap-[7px] whitespace-nowrap rounded-full px-[20px] text-[16px] font-medium disabled:opacity-50 ${selected ? "bg-[#116543] text-white" : outline ? "border border-[#91bca1] bg-white text-[#0a3825]" : "bg-[#ebebeb] text-[#19211c]"} ${className}`}>{children}</button>;
}

export function DashboardDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>("button, input, select")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab") return;
      const focusable = panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,33,23,.32)] p-[24px]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`${card} max-h-[calc(var(--admin-viewport-height,100vh)*0.9)] overflow-y-auto ${wide ? "w-[1512px]" : "w-[640px] p-[32px]"}`}>
      <div className={`flex items-center justify-between ${wide ? "border-b border-[#ebebeb] px-[24px] py-[13px]" : "mb-[24px]"}`}><h2 className="text-[24px] font-bold text-[#0a3825]">{title}</h2><button type="button" aria-label="닫기" onClick={onClose}>{wide ? <span className="block rounded-full border border-[#91bca1] px-[23px] py-[8px] text-[16px] font-bold">닫기</span> : <img src="/figma/dashboard/close.svg" alt="" />}</button></div>
      {children}
    </div>
  </div>;
}

function useSummary({ start, end }: DateRange, year: number, enabled = true) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); setLoading(true); setError(""); setData(null);
    getDashboard({ start, end }, year, controller.signal).then(setData).catch((cause: Error) => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [start, end, year, revision, enabled]);
  return { data, error, loading, retry: () => setRevision(value => value + 1) };
}

function RangeSelect({ range, value, onChange, label }: { range: DateRange; value: string; onChange: (value: string) => void; label: string }) {
  const months: string[] = []; let month = range.start.slice(0, 7);
  while (month <= range.end.slice(0, 7)) { months.push(month); const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); month = date.toISOString().slice(0, 7); }
  return <label className="ml-auto flex shrink-0 items-center gap-[14px] text-[15px]">조회 기간<select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={selectClass}><option value="all">조회 기간 전체</option>{months.map(month => <option key={month} value={month}>{month.replace("-", "년 ")}월</option>)}</select></label>;
}

function filteredRange(range: DateRange, month: string) {
  if (month === "all") return range;
  const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1);
  const end = offsetDate(date.toISOString().slice(0, 10), -1);
  return { start: range.start > `${month}-01` ? range.start : `${month}-01`, end: range.end < end ? range.end : end };
}

function PieRanking({ ranks, label, range, explanation, noResults }: { ranks: AnalyticsRank[]; label: string; range: DateRange; explanation: string; noResults?: number }) {
  const total = ranks.reduce((sum, rank) => sum + rank.count, 0);
  const shown = ranks.length > 6 ? [...ranks.slice(0, 5), { id: "__other", name: "기타", count: ranks.slice(5).reduce((sum, rank) => sum + rank.count, 0) }] : ranks;
  let cursor = 0;
  const stops = shown.map((rank, index) => { const start = cursor; cursor += total ? rank.count / total * 100 : 0; return `${COLORS[index]} ${start}% ${cursor}%`; });
  return <div className="mt-[27px] grid min-h-[249px] grid-cols-[44%_56%]">
    <div className="flex flex-col items-center border-r border-[#dee7e0] pr-[16px]">
      <div role="img" aria-label={total ? shown.map(rank => `${rank.name} ${number(rank.count)}건`).join(", ") : "기록 없음"} className="mt-[12px] h-[170px] w-[170px] shrink-0 rounded-full border border-white" style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#ebebeb" }} />
      <strong className="mt-[10px] text-[16px] text-[#0a3825]">전체 {label} {number(total)}건</strong><span className="text-[14px] text-[#536258]">{range.start.slice(5).replace("-", ".")} – {range.end.slice(5).replace("-", ".")}</span>
    </div>
    <div className="pl-[23px] text-[14px] text-[#536258]">
      <div className="grid grid-cols-[1fr_70px_100px] border-b border-[#dee7e0] pb-[6px]"><strong className="text-[17px] text-[#0a3825]">{label}</strong><span className="text-right">비중</span><span className="text-right">{label.includes("업체") ? "이용 횟수" : "검색 횟수"}</span></div>
      {shown.length ? shown.map((rank, index) => <div key={rank.id} className="grid h-[25px] grid-cols-[1fr_70px_100px] items-center text-[15px]"><span className="flex min-w-0 items-center gap-[9px]"><i className="h-[10px] w-[10px] shrink-0 rounded-[2px]" style={{ background: COLORS[index] }} /><span className="w-[18px] text-[14px]">{index + 1}</span><span className="truncate text-[#19211c]" title={rank.name}>{rank.name}</span></span><strong className="text-right text-[#0a3825]">{(rank.count / total * 100).toFixed(1)}%</strong><span className="text-right text-[#19211c]">{number(rank.count)}건</span></div>) : <p className="flex h-[150px] items-center justify-center">선택한 기간에 기록이 없습니다.</p>}
      <div className="mt-[19px] border-t border-[#dee7e0] pt-[12px] text-[14px] leading-[21px]"><p>{explanation}</p>{noResults !== undefined && <p>결과 없는 검색 {number(noResults)}건 (전체 검색 기준)</p>}</div>
    </div>
  </div>;
}

function RankingCard({ kind, range, year, summary }: { kind: "shops" | "categories"; range: DateRange; year: number; summary: DashboardSummary }) {
  const [month, setMonth] = useState("all"); const [group, setGroup] = useState<"categories" | "products">("categories");
  const selectedRange = filteredRange(range, month); const result = useSummary(selectedRange, year, month !== "all");
  const { data, error, loading, retry } = month === "all" ? { data: summary, error: "", loading: false, retry: result.retry } : result;
  const isShop = kind === "shops";
  return <section className={`${card} min-h-[356px] px-[27px] py-[17px]`}>
    <div className="flex items-center gap-[20px]"><h2 className="whitespace-nowrap text-[26px] font-bold text-[#0a3825]">{isShop ? "많이 찾은 업체" : "많이 찾은 종목"}</h2>{!isShop && <select className={selectClass} value={group} aria-label="업종·품목 선택" onChange={e => setGroup(e.target.value as typeof group)}><option value="categories">업종</option><option value="products">품목</option></select>}<RangeSelect range={range} value={month} onChange={setMonth} label={isShop ? "업체 순위 조회 기간" : "종목 순위 조회 기간"} /></div>
    {loading ? <p role="status" className="flex h-[249px] items-center justify-center text-[#536258]">집계 중…</p> : error ? <div role="alert" className="mt-12 text-center"><p>{error}</p><button onClick={retry} className="mt-4 text-[#116543] underline">다시 시도</button></div> : data && <PieRanking ranks={isShop ? data.shops : data[group]} label={isShop ? "업체 관심 이용" : group === "categories" ? "업종별 검색" : "품목별 검색"} range={selectedRange} explanation={isShop ? "업체 선택 또는 길찾기를 한 이용을 집계합니다. 같은 이용에서 같은 업체를 여러 번 찾아도 각각 기록됩니다." : group === "categories" ? "직접 검색과 추천 태그 검색의 결과 ID를 연결하고, 검색마다 같은 업종은 한 번 집계합니다." : "검색 결과 점포의 설명 태그를 연결하며, 검색마다 같은 품목은 한 번 집계합니다."} noResults={isShop ? undefined : data.noResults} />}
  </section>;
}

function TrendChart({ data, year, onYear }: { data: DashboardSummary; year: number; onYear: (year: number) => void }) {
  const [mode, setMode] = useState("months"); const [month, setMonth] = useState(koreaToday().slice(0, 7)); const [day, setDay] = useState(koreaToday());
  const currentYear = Number(koreaToday().slice(0, 4));
  const selectedMonth = month.startsWith(`${year}-`) ? month : `${year}-01`;
  const selectedDay = day.startsWith(selectedMonth) ? day : `${selectedMonth}-01`;
  let buckets: AnalyticsBucket[];
  if (mode === "months") buckets = Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, count: data.months.find(b => b.key === `${year}-${String(i + 1).padStart(2, "0")}`)?.count ?? 0 }));
  else if (mode === "days") buckets = Array.from({ length: new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5)), 0).getDate() }, (_, i) => ({ key: `${selectedMonth}-${String(i + 1).padStart(2, "0")}`, count: data.days.find(b => b.key === `${selectedMonth}-${String(i + 1).padStart(2, "0")}`)?.count ?? 0 }));
  else buckets = Array.from({ length: 24 }, (_, i) => ({ key: `${selectedDay}T${String(i).padStart(2, "0")}`, count: data.hours.find(b => b.key === `${selectedDay}T${String(i).padStart(2, "0")}`)?.count ?? 0 }));
  const peak = Math.max(4, ...buckets.map(b => b.count)); const step = Math.max(1, Math.ceil(peak / 4 / 10 ** Math.floor(Math.log10(peak / 4))) * 10 ** Math.floor(Math.log10(peak / 4))); const max = step * 4;
  const yearTotal = data.months.reduce((sum, bucket) => sum + bucket.count, 0);
  const title = mode === "months" ? "월별" : mode === "days" ? "일별" : "시간별";
  return <section className={`${card} min-h-[344px] px-[27px] py-[17px]`}>
    <div className="flex items-center justify-between"><h2 className="text-[30px] font-bold leading-[43px] text-[#0a3825]">이용 횟수 추이</h2><div className="flex items-center gap-[10px] text-[15px]"><span>조회 연도</span><select className={selectClass} value={year} aria-label="조회 연도" onChange={e => onYear(Number(e.target.value))}>{Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i).map(value => <option key={value} value={value}>{value}년</option>)}</select>{mode !== "months" && <select className={selectClass} value={selectedMonth} aria-label="조회 월" onChange={e => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).map(value => <option key={value} value={value}>{Number(value.slice(5))}월</option>)}</select>}{mode === "hours" && <input type="date" aria-label="조회 일" className={selectClass} value={selectedDay} min={`${selectedMonth}-01`} max={offsetDate(`${selectedMonth}-01`, new Date(year, Number(selectedMonth.slice(5)), 0).getDate() - 1)} onChange={e => { if (e.target.value) setDay(e.target.value); }} />}<select className={`${selectClass} min-w-[185px]`} aria-label="추이 집계 단위" value={mode} onChange={e => setMode(e.target.value)}><option value="months">월별 합계</option><option value="days">일별 합계</option><option value="hours">시간별 합계</option></select></div></div>
    <div className="mt-[10px] grid grid-cols-[minmax(0,2.3fr)_minmax(300px,1fr)] gap-[24px]">
      <div><strong className="text-[16px] text-[#0a3825]">{title} 총 이용 횟수 (회)</strong>
        <div className="relative mt-[21px] h-[180px] pl-[61px] pr-[16px]">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="pointer-events-none absolute left-[61px] right-[16px] border-t border-[#dee7e0]" style={{ bottom: 32 + i * 32.75 }}><span className="absolute -left-[61px] -top-[10px] w-[51px] text-right text-[13px] text-[#536258]">{number(max / 4 * i)}</span></div>)}
          <div className="relative flex h-full items-end pb-[32px]">{buckets.map(bucket => <button type="button" key={bucket.key} className="group relative flex h-[145px] min-w-0 flex-1 items-end justify-center" aria-label={`${bucket.key}: ${number(bucket.count)}회${mode === "months" ? ", 일별 보기" : mode === "days" ? ", 시간별 보기" : ""}`} title={`${bucket.key} · ${number(bucket.count)}회`} onClick={() => { if (mode === "months") { setMonth(bucket.key); setMode("days"); } else if (mode === "days") { setDay(bucket.key); setMode("hours"); } }}>
            <span className="relative block w-[47%] max-w-[45px] rounded-t-[2px] bg-[#116543] group-hover:brightness-125" style={{ height: bucket.count ? `${bucket.count / max * 131}px` : 7, background: bucket.count ? undefined : "repeating-linear-gradient(135deg,#a8b9ad 0px,#a8b9ad 1px,transparent 1px,transparent 4px)" }}>{bucket.count > 0 && <strong className={`absolute -top-[23px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[14px] text-[#0a3825] ${buckets.length > 12 ? "hidden group-hover:block" : ""}`}>{number(bucket.count)}</strong>}</span><span className="absolute -bottom-[27px] text-[14px] text-[#536258]">{mode === "months" ? `${Number(bucket.key.slice(5))}월` : mode === "days" ? Number(bucket.key.slice(8)) : `${Number(bucket.key.slice(11))}시`}</span>
          </button>)}</div>
        </div><div className="mt-[15px] flex items-center gap-[22px] text-[13px] text-[#536258]"><span className="flex items-center gap-[8px]"><i className="h-[9px] w-[9px] bg-[#116543]" />월 합계</span><span>▧ 기록 없음</span><span className="ml-auto">{mode === "months" ? "월을 선택하면 일별 기록을 볼 수 있습니다." : mode === "days" ? "일을 선택하면 시간별 기록을 볼 수 있습니다." : "한국시간(KST) 기준"}</span></div>
      </div>
      <div className="border-l border-[#dee7e0] pl-[28px] text-[#0a3825]"><strong className="text-[18px]">{year}년 기록 합계</strong><p className="text-[38px] font-bold leading-[52px]">{number(yearTotal)}회</p><p className="mb-[10px] text-[15px] font-medium text-[#536258]">기록이 있는 달 {data.months.length}개월 / 12개월</p><div className="max-h-[82px] overflow-y-auto">{data.months.map(bucket => <div key={bucket.key} className="flex items-center gap-[9px] text-[15px]"><i className="h-[8px] w-[8px] bg-[#116543]" /><span>{Number(bucket.key.slice(5))}월 · {bucket.key.replace("-", ".")}</span><strong className="ml-auto">{number(bucket.count)}회</strong></div>)}{!data.months.length && <p className="text-[15px] text-[#536258]">아직 이용 기록이 없습니다.</p>}</div><p className="mt-[14px] border-t border-[#dee7e0] pt-[10px] text-[14px] leading-[20px] text-[#536258]">대기화면에서 서비스를 시작한 이용을 1회로 집계합니다.<br />자료가 있는 날짜만 합산합니다.</p></div>
    </div>
  </section>;
}

function CsvContent({ range, total }: { range: DateRange; total: number }) {
  const [kind, setKind] = useState<"events" | "summary">("events"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div className="min-h-[464px] px-[24px] py-[12px]">
    <div className="mb-[14px] flex items-center justify-between text-[16px] text-[#536258]"><p>{rangeLabel(range)} · 이용 {number(total)}회</p><button className="font-bold text-[#0a3825]" onClick={() => { const params = new URLSearchParams({ page: "dashboard", export: "1", ...range }); window.open(`${window.location.pathname}?${params}`, "_blank", "noopener,noreferrer"); }}>새 창에서 열기</button></div>
    <fieldset><legend className="mb-[8px] text-[17px] font-bold">내려받을 자료</legend>{([ ["events", "이용 행동 기록", "이용 시작, 검색, 결과 노출, 업체 선택, 길찾기"], ["summary", "기간별 집계", "전체 조회 기간의 월·일·연 합계와 업체·업종·품목 순위"] ] as const).map(([value, title, description]) => <label key={value} className={`mb-[8px] flex cursor-pointer items-center gap-[16px] rounded-[12px] border p-[16px] ${kind === value ? "border-[#91bca1] bg-[#f0f8f3]" : "border-[#dee7e0]"}`}><input type="radio" name="csv-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="accent-[#116543]" /><span><strong className="block text-[17px]">{title}</strong><span className="text-[15px] text-[#536258]">{description}</span></span></label>)}</fieldset>
    <p className="mt-[18px] text-[14px] leading-[21px] text-[#536258]">실제 수집 자료 · 한국시간(KST) · UTF-8 CSV<br />집계 파일은 집계 단위·구간으로 필터할 수 있습니다.</p>{error && <p role="alert" className="mt-3 text-[#b3261e]">{error}</p>}
    <Button selected disabled={busy} className="ml-auto mt-[18px] font-bold" onClick={async () => { setBusy(true); setError(""); try { await downloadAnalytics(range, kind); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }}>{busy ? "다운로드 중…" : "파일 다운로드"}</Button>
  </div>;
}

export default function AdminDashboard({ onNavigate, standaloneExport = false }: { onNavigate: (page: "store" | "promotion" | "tags") => void; standaloneExport?: boolean }) {
  const [range, setRange] = useState<DateRange>(() => recentRange(30)); const [preset, setPreset] = useState(30); const [year, setYear] = useState(() => Number(koreaToday().slice(0, 4)));
  const [modal, setModal] = useState<"dates" | "csv" | null>(null); const [draft, setDraft] = useState(range); const [dateError, setDateError] = useState("");
  const { data, loading, error, retry } = useSummary(range, year);
  useEffect(() => { if (standaloneExport) { const params = new URLSearchParams(window.location.search); const start = params.get("start"), end = params.get("end"); if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end && end <= koreaToday() && Number.isFinite(Date.parse(start)) && Number.isFinite(Date.parse(end)) && Date.parse(end) - Date.parse(start) <= 366 * 86400000) setRange({ start, end }); } }, [standaloneExport]);
  if (standaloneExport) return <section className={`${card} m-[24px]`}><div className="flex items-center justify-between border-b border-[#ebebeb] px-[24px] py-[16px]"><h1 className="text-[26px] font-bold">CSV 다운로드</h1><Button outline onClick={() => window.close()}>닫기</Button></div>{error ? <p role="alert" className="p-6">{error}</p> : loading ? <p role="status" className="p-6">집계 중…</p> : <CsvContent range={range} total={data?.totalUses ?? 0} />}</section>;
  return <div className="flex flex-col gap-[20px]">
    <nav aria-label="관리 메뉴" className="flex h-[60px] items-start justify-between"><div className="flex gap-[32px] text-[40px] leading-[60px]"><button onClick={() => onNavigate("store")} className="font-medium text-[#c3c3c3]">가게 관리</button><button onClick={() => onNavigate("promotion")} className="font-medium text-[#c3c3c3]">홍보 관리</button><h1 className="font-bold text-[#0a3825]">대시보드</h1></div><Button outline className="border-[#a1a1a1] bg-[#ebebeb] text-[#363636]" onClick={() => onNavigate("tags")}>검색 태그 관리하기<img src="/figma/dashboard/chevron-right.svg" alt="" /></Button></nav>
    <section className={`${card} flex min-h-[88px] items-center justify-between gap-[20px] px-[28px] py-[12px] max-[1700px]:flex-wrap`}>
      <div><p className="text-[15px] text-[#363636]">순위·CSV 조회 기간</p><strong className="text-[24px] leading-[32px]">{rangeLabel(range)}</strong></div><div className="min-w-[160px] border-l border-[#ebebeb] pl-[22px]"><p className="text-[15px]">총 이용 횟수</p><strong className="text-[24px] leading-[34px] text-[#0a3825]">{loading || error ? "—" : number(data?.totalUses ?? 0) + "회"}</strong></div>
      <div className="flex gap-[10px]">{([1, 7, 30] as const).map(days => <Button key={days} selected={preset === days} className="w-[122px]" onClick={() => { setRange(recentRange(days)); setPreset(days); }}>{days === 1 ? "오늘" : `최근 ${days}일`}</Button>)}<Button outline selected={preset === 0} className="w-[166px]" onClick={() => { setDraft(range); setDateError(""); setModal("dates"); }}>기간 직접 선택</Button><Button outline disabled={loading || !!error} className="w-[165px] bg-[#cfeadb] font-bold" onClick={() => setModal("csv")}><img src="/figma/dashboard/download.svg" alt="" />CSV 다운로드</Button></div>
    </section>
    {loading ? <div role="status" className={`${card} flex h-[344px] items-center justify-center text-[#536258]`}>집계 자료를 불러오는 중…</div> : error ? <div role="alert" className={`${card} flex h-[344px] flex-col items-center justify-center gap-6`}><p>{error}</p><Button selected onClick={retry}>다시 시도</Button></div> : data && <><TrendChart data={data} year={year} onYear={setYear} /><div className="grid grid-cols-2 gap-[20px]"><RankingCard key={`shops-${range.start}-${range.end}`} kind="shops" range={range} year={year} summary={data} /><RankingCard key={`categories-${range.start}-${range.end}`} kind="categories" range={range} year={year} summary={data} /></div></>}
    <footer className="flex justify-between text-[15px] text-[#363636]"><p>검색 가능한 운영 시간은 미수집입니다.</p><p>{data && !loading && !error ? `실제 수집 자료 · ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generatedAt))} 기준 (한국시간)` : "한국시간(KST) 기준"}</p></footer>
    {modal === "csv" && <DashboardDialog wide title="CSV 다운로드" onClose={() => setModal(null)}><CsvContent range={range} total={data?.totalUses ?? 0} /></DashboardDialog>}
    {modal === "dates" && <DashboardDialog title="조회 기간 직접 선택" onClose={() => setModal(null)}><div className="flex gap-4"><label className="flex-1 text-[16px]">시작일<input aria-label="시작일" type="date" value={draft.start} max={koreaToday()} onChange={e => setDraft(value => ({ ...value, start: e.target.value }))} className="mt-2 h-[48px] w-full rounded-xl border border-[#91bca1] px-3" /></label><label className="flex-1 text-[16px]">종료일<input aria-label="종료일" type="date" value={draft.end} max={koreaToday()} onChange={e => setDraft(value => ({ ...value, end: e.target.value }))} className="mt-2 h-[48px] w-full rounded-xl border border-[#91bca1] px-3" /></label></div><p className="mt-3 text-[14px] text-[#536258]">오늘까지 최대 367일을 조회할 수 있습니다.</p>{dateError && <p role="alert" className="mt-3 text-[#b3261e]">{dateError}</p>}<div className="mt-[24px] flex gap-3"><Button className="flex-1" onClick={() => setModal(null)}>취소</Button><Button selected className="flex-1" onClick={() => { if (!draft.start || !draft.end || draft.start > draft.end || draft.end > koreaToday() || Date.parse(draft.end) - Date.parse(draft.start) > 366 * 86400000) { setDateError("시작일과 종료일을 확인해주세요. 최대 367일을 선택할 수 있습니다."); return; } setRange(draft); setPreset(0); setModal(null); }}>조회하기</Button></div></DashboardDialog>}
  </div>;
}
