type EventType = "START" | "SEARCH" | "SELECT" | "DIRECTIONS";
type Source = "keyboard" | "voice" | "handwriting" | "tag" | "touch";
type Event = { id: string; sessionId: string; type: EventType; source: Source; language: string; targetIds: string[]; occurredAt: string };
const KEY = "kiosk-analytics-pending-v1";
const URL = `${(import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "")}/api/kiosk-analytics/events`;
let pending: Event[] = [];
try { const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]"); if (Array.isArray(saved)) pending = saved.filter(e => e && typeof e.id === "string" && typeof e.sessionId === "string" && Array.isArray(e.targetIds)); } catch { /* Keep working when storage is unavailable. */ }
let flushing = false; let retry: ReturnType<typeof setTimeout> | undefined;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(pending)); } catch { /* Memory queue still retries. */ } }
async function flush() {
  if (flushing || !pending.length) return;
  flushing = true;
  if (retry) { clearTimeout(retry); retry = undefined; }
  try {
    while (pending.length) {
      const response = await fetch(URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending[0]), signal: AbortSignal.timeout(8000) });
      if (!response.ok && response.status !== 400) throw new Error(`Analytics: ${response.status}`);
      if (response.status === 400) console.warn("Rejected kiosk analytics event", pending[0].id);
      pending.shift(); persist();
    }
  } catch { retry = setTimeout(() => void flush(), 15000); }
  finally { flushing = false; }
}
export function recordKioskEvent(sessionId: string | null, type: EventType, language: string, source: Source = "touch", targetIds: string[] = [], id: string = crypto.randomUUID()) {
  if (!sessionId || pending.some(event => event.id === id)) return;
  pending.push({ id, sessionId, type, source, language, targetIds: [...new Set(targetIds)], occurredAt: new Date().toISOString() });
  persist(); void flush();
}
window.addEventListener("online", () => void flush());
void flush();
