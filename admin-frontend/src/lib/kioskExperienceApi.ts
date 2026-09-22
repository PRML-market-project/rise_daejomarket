export type OperationMode = "DIRECTIONS" | "PROMOTION";

export type PromotionContent = {
  id: number;
  name: string;
  type: "image" | "video";
  url: string;
  durationSeconds: number;
  fit: "contain" | "cover";
};

export type SearchTag = {
  id: number;
  name: string;
  keywords: string;
  icon: string;
  iconUrl?: string;
  visible: boolean;
};

export type KioskExperience = {
  operationMode: OperationMode;
  promotions: PromotionContent[];
  searchTags: SearchTag[];
  shops: ManagedShop[];
};

export type ManagedShop = { id: string; name: string; description: string; keywords: string; tags: string[]; thumbnailUrl: string; icon: string };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || `요청에 실패했습니다. (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const absoluteAssetUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE}${url}`;
export const getKioskExperience = () => request<KioskExperience>("/api/kiosk-experience", { cache: "no-store" });
export const saveOperationMode = (operationMode: OperationMode) => request<KioskExperience>("/api/kiosk-experience/mode", { method: "PUT", body: JSON.stringify({ operationMode }) });
export const savePromotions = (promotions: PromotionContent[]) => request<KioskExperience>("/api/kiosk-experience/promotions", { method: "PUT", body: JSON.stringify({ promotions }) });
export const saveSearchTags = (searchTags: SearchTag[]) => request<KioskExperience>("/api/kiosk-experience/search-tags", { method: "PUT", body: JSON.stringify({ searchTags }) });
export const saveManagedShops = (shops: ManagedShop[]) => request<KioskExperience>("/api/kiosk-experience/shops", { method: "PUT", body: JSON.stringify({ shops }) });

export async function uploadPromotion(file: File) {
  const body = new FormData(); body.append("file", file);
  return request<{ name: string; type: "image" | "video"; url: string }>("/api/kiosk-experience/media", { method: "POST", body });
}

export async function uploadSearchIcon(file: File) {
  const body = new FormData(); body.append("file", file);
  return request<{ name: string; type: "icon"; url: string }>("/api/kiosk-experience/icons", { method: "POST", body });
}
