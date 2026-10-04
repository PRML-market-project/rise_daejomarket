type AiSearchResult = {
  chat_message?: unknown;
  result?: { status?: unknown; intent?: unknown; items?: unknown };
  error?: unknown;
};

export type KioskAiSearch = { shopIds: string[]; message: string; intent: string };

const configuredUrl = import.meta.env.VITE_GPT_API_URL?.trim();
const baseUrl = (configuredUrl || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_SEARCH_URL = baseUrl.endsWith("/gpt") ? baseUrl : `${baseUrl}/gpt`;
export const KIOSK_TTS_URL = `${baseUrl.replace(/\/gpt$/, "")}/api/tts`;

export function formatKioskAiMessage(raw: string): string {
  const message = raw.replace(/\*\*/g, "")
    .split(/\[\s*(?:카테고리\s*매치|검색\s*매치|category\s*matches?|search\s*matches?)\s*\]/i)[0]
    .split(/\n\s*(?:[-*•]|\d+[.)])\s+/)[0]
    .replace(/\s+/g, " ").trim();
  const characters = Array.from(message);
  if (characters.length <= 85) return message;
  const shortened = characters.slice(0, 85).join("");
  const endings = [...shortened.matchAll(/[.!?。！？](?=\s|$)/g)];
  const lastEnding = endings[endings.length - 1];
  if (lastEnding?.index !== undefined) return shortened.slice(0, lastEnding.index + 1).trim();
  return characters.slice(0, 84).join("").trimEnd() + "…";
}

export async function searchKioskWithAi(text: string, language: "ko" | "en" | "vi", signal: AbortSignal): Promise<KioskAiSearch> {
  const response = await fetch(AI_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.trim(),
      language,
      admin_id: Number(import.meta.env.VITE_GPT_ADMIN_ID || 1),
      kiosk_id: Number(import.meta.env.VITE_GPT_KIOSK_ID || 1),
    }),
    signal,
  });
  if (!response.ok) throw new Error(`AI search failed: ${response.status}`);
  const data = await response.json() as AiSearchResult;
  if (data.error || data.result?.status !== "success" || !Array.isArray(data.result.items)) {
    throw new Error("AI search returned an invalid response");
  }
  const shopIds = [...new Set(data.result.items.flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || !("target_id" in item)) return [];
    const id = (item as { target_id: unknown }).target_id;
    return typeof id === "string" ? [id] : [];
  }))];
  return {
    shopIds,
    message: typeof data.chat_message === "string" ? formatKioskAiMessage(data.chat_message) : "",
    intent: typeof data.result.intent === "string" ? data.result.intent : "",
  };
}
