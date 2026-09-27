type AiSearchResult = {
  chat_message?: unknown;
  result?: { status?: unknown; intent?: unknown; items?: unknown };
  error?: unknown;
};

export type KioskAiSearch = { shopIds: string[]; message: string; intent: string };

const configuredUrl = import.meta.env.VITE_GPT_API_URL?.trim();
const baseUrl = (configuredUrl || "http://127.0.0.1:8000").replace(/\/$/, "");
const AI_SEARCH_URL = baseUrl.endsWith("/gpt") ? baseUrl : `${baseUrl}/gpt`;

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
    message: typeof data.chat_message === "string" ? data.chat_message.trim() : "",
    intent: typeof data.result.intent === "string" ? data.result.intent : "",
  };
}
