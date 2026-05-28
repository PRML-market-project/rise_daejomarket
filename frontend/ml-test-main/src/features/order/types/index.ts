// src/features/order/types/index.ts

import { Menu } from '@/types/menu';

export interface CartItemType {
  menu: Menu; // Contains the full menu details
  quantity: number;
  // IMPORTANT: If items can have options (size, toppings, etc.),
  // you'll need to add an 'options' field here or change the structure
  // to uniquely identify items beyond just menu_id.
  // e.g., options?: Record<string, string | number>;
  // or a unique cart_item_id?: string;
}

export interface Cart {
  cartItems: CartItemType[];
  // You might add calculated values here later if needed, but often calculated in components
  // totalPrice?: number;
  // totalQuantity?: number;
}
