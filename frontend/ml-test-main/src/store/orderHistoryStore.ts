import { create } from 'zustand';

interface OrderItem {
  menuName: string;
  menuNameEn: string | null;
  menuPrice: number;
  quantity: number;
}

interface Order {
  orderId: number;
  createdAt: string;
  items: OrderItem[];
}

interface OrderResponse {
  kioskNumber: number;
  orders: Order[];
}

interface OrderHistoryState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: (kioskId: number) => Promise<void>;
}

export const useOrderHistoryStore = create<OrderHistoryState>((set) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async (kioskId: number) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/kiosk/${kioskId}/orders`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data: OrderResponse = await response.json();
      set({ orders: data.orders, isLoading: false });
    } catch (error) {
      set({
        error: '주문 내역을 불러오는데 실패했습니다',
        isLoading: false,
      });
      console.error('Failed to fetch orders:', error);
    }
  },
}));
