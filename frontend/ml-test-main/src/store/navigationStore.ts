import { create } from 'zustand';

type ViewType = 'menu' | 'orderHistory' | 'map';

interface NavigationState {
  currentCategoryId: number | null;
  currentMenuId: number | null;
  currentCategoryType: string | null;
  currentView: ViewType;
  highlightedCategoryIds: number[]; // ✅ 다중 깜빡임용 ID 배열

  setCurrentCategory: (categoryId: number | null) => void;
  setCurrentMenu: (menuId: number | null) => void;
  setCurrentCategoryType: (categoryType: string | null) => void;
  setCurrentView: (view: ViewType) => void;
  setHighlightedCategoryIds: (ids: number[]) => void; // ✅ 액션 추가
  resetNavigation: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentCategoryId: null,
  currentMenuId: null,
  currentCategoryType: null,
  currentView: 'menu',
  highlightedCategoryIds: [],

  setCurrentCategory: (categoryId) => set({ currentCategoryId: categoryId }),

  setCurrentMenu: (menuId) => set({ currentMenuId: menuId }),

  setCurrentCategoryType: (categoryType) =>
    set({ currentCategoryType: categoryType }),

  // ✅ 핵심: 화면 전환 시 모든 강조 효과 및 선택 상태 해제
  setCurrentView: (view) =>
    set({
      currentView: view,
      currentMenuId: null,
      highlightedCategoryIds: [],
    }),

  // ✅ 여러 가게 깜빡임 설정
  setHighlightedCategoryIds: (ids) => set({ highlightedCategoryIds: ids }),

  resetNavigation: () =>
    set({
      currentCategoryId: null,
      currentMenuId: null,
      currentCategoryType: null,
      highlightedCategoryIds: [],
      currentView: 'menu',
    }),
}));