import { create } from 'zustand';
import type { CartItem, CartTotals, Menu, RestaurantDetail, TableInfo } from '../types';
import { computeTotals } from './cart';

interface AppState {
  restaurant: RestaurantDetail | null;
  tables: TableInfo[];
  tableId: string | null;
  menu: Menu | null;
  cart: CartItem[];
  lastOrderId: string | null;

  setRestaurant: (r: RestaurantDetail, tables: TableInfo[]) => void;
  setTable: (tableId: string | null) => void;
  setMenu: (m: Menu) => void;

  addToCart: (item: CartItem) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  removeByProduct: (productId: string) => void;
  clearCart: () => void;

  setLastOrderId: (id: string | null) => void;

  totals: () => CartTotals;
  cartCount: () => number;
  cartProductIds: () => string[];
}

const emptyTotals = (currency: string): CartTotals => ({
  subtotal: { amount: 0, currency },
  tax: { amount: 0, currency },
  discount: { amount: 0, currency },
  total: { amount: 0, currency },
});

export const useApp = create<AppState>((set, get) => ({
  restaurant: null,
  tables: [],
  tableId: null,
  menu: null,
  cart: [],
  lastOrderId: null,

  setRestaurant: (restaurant, tables) => set({ restaurant, tables }),
  setTable: (tableId) => set({ tableId }),
  setMenu: (menu) => set({ menu }),

  addToCart: (item) => set((s) => ({ cart: [...s.cart, item] })),
  updateQuantity: (lineId, quantity) =>
    set((s) => ({
      cart: s.cart
        .map((i) =>
          i.lineId === lineId
            ? {
                ...i,
                quantity: Math.max(1, quantity),
                lineTotal: { ...i.unitPrice, amount: i.unitPrice.amount * Math.max(1, quantity) },
              }
            : i,
        )
        .filter((i) => i.quantity > 0),
    })),
  removeLine: (lineId) => set((s) => ({ cart: s.cart.filter((i) => i.lineId !== lineId) })),
  removeByProduct: (productId) =>
    set((s) => {
      const idx = s.cart.findIndex((i) => i.productId === productId);
      if (idx < 0) return s;
      const next = [...s.cart];
      next.splice(idx, 1);
      return { cart: next };
    }),
  clearCart: () => set({ cart: [] }),

  setLastOrderId: (lastOrderId) => set({ lastOrderId }),

  totals: () => {
    const { cart, restaurant } = get();
    const currency = restaurant?.currency ?? 'QAR';
    if (!restaurant) return emptyTotals(currency);
    return computeTotals(cart, currency, restaurant.taxRateBps);
  },
  cartCount: () => get().cart.reduce((acc, i) => acc + i.quantity, 0),
  cartProductIds: () => get().cart.map((i) => i.productId),
}));
