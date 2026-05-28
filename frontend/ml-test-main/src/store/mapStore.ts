import { create } from 'zustand';

interface MapState {
  selectedShopId: string | null;
  isNavigationActive: boolean;

  // 액션
  selectShop: (id: string | null) => void;
  setNavigation: (isActive: boolean) => void;
  selectAndNavigate: (id: string) => void; // ✅ GPT용: 선택+길안내 동시 실행
  resetMap: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedShopId: null,
  isNavigationActive: false,

  // 일반 선택 (길안내 꺼짐)
  selectShop: (id) => set({ selectedShopId: id, isNavigationActive: false }),

  // 길안내 상태 토글용
  setNavigation: (isActive) => set({ isNavigationActive: isActive }),

  selectAndNavigate: (id) => set({ selectedShopId: id, isNavigationActive: true }),

  resetMap: () => set({ selectedShopId: null, isNavigationActive: false }),
}));