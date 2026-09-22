/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";

export type PromotionContent = {
  id: number;
  name: string;
  type: "image" | "video";
  url: string;
  durationSeconds: number;
  fit: "contain" | "cover";
};

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
const assetUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;

export function KioskPromotionPlayer({ contents }: { contents: PromotionContent[] }) {
  const [index, setIndex] = useState(0);
  const next = useCallback(() => setIndex((current) => contents.length ? (current + 1) % contents.length : 0), [contents.length]);
  const active = contents[index] ?? contents[0];
  const activeId = active?.id;
  const activeType = active?.type;
  const activeDuration = active?.durationSeconds;

  useEffect(() => { if (index >= contents.length) setIndex(0); }, [contents.length, index]);
  useEffect(() => {
    if (activeId == null || activeType !== "image") return;
    const timer = window.setTimeout(next, Math.max(1, activeDuration || 10) * 1000);
    return () => window.clearTimeout(timer);
  }, [activeDuration, activeId, activeType, next]);

  if (!active) return null;
  const style = { objectFit: active.fit } as const;
  return <main className="fixed inset-0 z-[100] overflow-hidden bg-black" aria-label="대조시장 홍보 콘텐츠">
    {active.type === "video"
      ? <video key={active.id} src={assetUrl(active.url)} autoPlay muted playsInline className="h-full w-full" style={style} onEnded={next} onError={next} />
      : <img key={active.id} src={assetUrl(active.url)} alt={active.name} className="h-full w-full" style={style} onError={next} />}
  </main>;
}

export type KioskExperience = { operationMode: "DIRECTIONS" | "PROMOTION"; promotions: PromotionContent[]; searchTags: Array<{ id: number; name: string; keywords: string; icon: string; iconUrl?: string; visible: boolean }>; shops: Array<{ id: string; name: string; description: string; keywords: string; tags: string[]; thumbnailUrl: string; icon: string }> };

export async function fetchKioskExperience(signal?: AbortSignal): Promise<KioskExperience> {
  const response = await fetch(`${API_BASE}/api/kiosk-experience`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("키오스크 운영 설정을 불러오지 못했습니다.");
  return response.json() as Promise<KioskExperience>;
}

export function subscribeToKioskExperience(onExperience: (experience: KioskExperience) => void) {
  const events = new EventSource(`${API_BASE}/api/kiosk-experience/events`);
  const receive = (event: MessageEvent<string>) => {
    try { onExperience(JSON.parse(event.data) as KioskExperience); }
    catch { /* Ignore malformed events and keep the last valid configuration. */ }
  };
  events.addEventListener("experience", receive as EventListener);
  return () => events.close();
}
