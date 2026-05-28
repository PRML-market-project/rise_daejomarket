import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Menu, Category, MenuResponse } from '../types/menu';
import { useNavigationStore } from './navigationStore';
import { mockCategories } from '../mock/categories';
import { mockMenuItems } from '../mock/menuItems';

type LocalMenu = {
  menu_id: number;
  category_id: number;
  menu_name: string;
  menu_price: number;
  menu_img_url: string;
};

type LocalCategory = {
  category_id: number;
  category_name: string;
  category_name_en: string;
  menus: LocalMenu[];
};

interface MenuState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  fetchMenusByCategory: (kioskId: number) => Promise<void>;
  getMenusByCategory: (categoryId: number) => Menu[];
  getCategoryById: (categoryId: number) => Category | undefined;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      categories: [],
      isLoading: false,
      error: null,

      fetchMenusByCategory: async (kioskId: number) => {
        set({ isLoading: true, error: null });

        try {
          const backendUrl = import.meta.env.VITE_API_URL;
          const response = await fetch(
            `${backendUrl}/api/kiosk/${kioskId}/menu-by-category`
          );

          if (!response.ok) {
            throw new Error('API request failed');
          }

          const data: MenuResponse = await response.json();

          const fixedData = data.map((category) => ({
            ...category,
            menus: category.menus.map((menu) => ({
              ...menu,
              imageUrl: menu.imageUrl.startsWith('http')
                ? menu.imageUrl
                : `${backendUrl}${menu.imageUrl}`,
            })),
          }));

          const filteredCategories = fixedData.filter(
            (category) => category.categoryName !== '전체'
          );

          set({
            categories: filteredCategories,
            isLoading: false,
          });

          if (filteredCategories.length > 0) {
            useNavigationStore
              .getState()
              .setCurrentCategory(filteredCategories[0].categoryId);
          }
        } catch (error) {
          console.error('Failed to fetch menus from API, using mock data:', error);

          const backendUrl = import.meta.env.VITE_API_URL;

          const combinedMockData = mockCategories.map((category) => {
            const menus = mockMenuItems
              .filter((menu) => menu.category_id === category.category_id)
              .map((menu) => ({
                menuId: menu.menu_id,
                menuName: menu.menu_name,
                menuNameEn: menu.menu_name_en,
                menuPrice: menu.menu_price,
                imageUrl: menu.menu_img_url.startsWith('http')
                  ? menu.menu_img_url
                  : `${backendUrl}${menu.menu_img_url}`,
                categoryId: menu.category_id,
              }));
            return {
              categoryId: category.category_id,
              categoryName: category.category_name,
              categoryNameEn: category.category_name_en,
              categoryType: category.category_type || '기타',
              menus: menus,
            };
          });

          set({
            categories: combinedMockData as Category[],
            isLoading: false,
            error: null,
          });

          if (combinedMockData.length > 0) {
            useNavigationStore
              .getState()
              .setCurrentCategory(combinedMockData[0].categoryId);
          }
        }
      },

      getMenusByCategory: (categoryId: number) => {
        const category = get().categories.find(
          (category) => category.categoryId === categoryId
        );
        return category?.menus || [];
      },

      getCategoryById: (categoryId: number) => {
        return get().categories.find(
          (category) => category.categoryId === categoryId
        );
      },
    }),
    {
      name: 'menu-storage',
      partialize: (state) => ({
        categories: state.categories,
      }),
    }
  )
);
