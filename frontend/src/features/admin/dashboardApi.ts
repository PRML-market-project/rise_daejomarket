export type AnalyticsRank = { id: string; name: string; count: number };
export type AnalyticsBucket = { key: string; count: number };
export type DashboardSummary = {
  start: string; end: string; year: number; totalUses: number; searches: number; noResults: number;
  months: AnalyticsBucket[]; days: AnalyticsBucket[]; hours: AnalyticsBucket[];
  shops: AnalyticsRank[]; categories: AnalyticsRank[]; products: AnalyticsRank[]; generatedAt: string;
};
export type DateRange = { start: string; end: string };
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");
export function koreaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}
export function offsetDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
export function recentRange(days: number): DateRange { const end = koreaToday(); return { start: offsetDate(end, 1 - days), end }; }
export async function getDashboard(range: DateRange, year: number, signal: AbortSignal): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE}/api/kiosk-analytics?${new URLSearchParams({ ...range, year: String(year) })}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("집계 자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도해주세요.");
  return response.json();
}
export async function downloadAnalytics(range: DateRange, kind: "events" | "summary") {
  const response = await fetch(`${API_BASE}/api/kiosk-analytics/export?${new URLSearchParams({ ...range, kind })}`);
  if (!response.ok) throw new Error("파일을 내려받지 못했습니다. 다시 시도해주세요.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = `kiosk-${kind}-${range.start}-${range.end}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
