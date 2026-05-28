import { CartItemType } from '@/features/order/types';
import { create } from 'zustand';
import { Menu } from '@/types/menu';

interface CartState {
  cartItems: CartItemType[];
  addItem: (menu: Menu, quantity?: number) => void;
  removeItem: (menuId: number) => void;
  updateQuantity: (menuId: number, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  // 초기 상태
  cartItems: [],

  // 액션: 아이템 추가 (기존 cartReducer의 ADD_ITEM 로직)
  addItem: (menu, quantity = 1) =>
    set((state) => {
      const existingItemIndex = state.cartItems.findIndex(
        (item) => item.menu.menuId === menu.menuId
      );

      if (existingItemIndex > -1) {
        // 이미 있으면 수량 증가
        const updatedItems = state.cartItems.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
        return { cartItems: updatedItems };
      } else {
        // 없으면 새로 추가
        const newItem: CartItemType = { menu: menu, quantity: quantity };
        return { cartItems: [...state.cartItems, newItem] };
      }
    }),

  // 액션: 아이템 제거 (기존 cartReducer의 REMOVE_ITEM 로직)
  removeItem: (menuId) =>
    set((state) => ({
      cartItems: state.cartItems.filter((item) => item.menu.menuId !== menuId),
    })),

  // 액션: 수량 변경 (기존 cartReducer의 UPDATE_QUANTITY 로직)
  updateQuantity: (menuId, quantity) =>
    set((state) => {
      const existingItem = state.cartItems.find(
        (item) => item.menu.menuId === menuId
      );
      if (!existingItem) return state;

      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity <= 0) {
        // 수량이 0 이하이면 제거
        return {
          cartItems: state.cartItems.filter(
            (item) => item.menu.menuId !== menuId
          ),
        };
      } else {
        // 수량 업데이트
        return {
          cartItems: state.cartItems.map((item) =>
            item.menu.menuId === menuId
              ? { ...item, quantity: newQuantity }
              : item
          ),
        };
      }
    }),

  // 액션: 장바구니 비우기 (기존 cartReducer의 CLEAR_CART 로직)
  clearCart: () => set({ cartItems: [] }),

  // 예시: 계산된 값 (필요한 경우)
  // getTotalItems: () => get().cartItems.reduce((total, item) => total + item.quantity, 0),
}));
