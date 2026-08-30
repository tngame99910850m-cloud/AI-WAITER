import { z } from 'zod';
import { moneySchema } from './money.js';

/** A selected modifier captured on a cart/order line. */
export const selectedModifierSchema = z.object({
  modifierGroupId: z.string(),
  modifierId: z.string(),
  name: z.string(),
  priceDelta: moneySchema,
});
export type SelectedModifier = z.infer<typeof selectedModifierSchema>;

export const cartItemSchema = z.object({
  /** Client-generated stable id for this line (lets us edit/remove it). */
  lineId: z.string(),
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().min(1),
  sizeId: z.string().nullable().default(null),
  sizeName: z.string().nullable().default(null),
  unitBasePrice: moneySchema,
  modifiers: z.array(selectedModifierSchema).default([]),
  notes: z.string().default(''),
  /** Computed unit price incl. size + modifiers. */
  unitPrice: moneySchema,
  /** unitPrice * quantity. */
  lineTotal: moneySchema,
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartTotalsSchema = z.object({
  subtotal: moneySchema,
  tax: moneySchema,
  discount: moneySchema,
  total: moneySchema,
});
export type CartTotals = z.infer<typeof cartTotalsSchema>;

export const cartSchema = z.object({
  restaurantId: z.string(),
  tableId: z.string().nullable().default(null),
  currency: z.string(),
  items: z.array(cartItemSchema),
  totals: cartTotalsSchema,
});
export type Cart = z.infer<typeof cartSchema>;

export const orderStatusSchema = z.enum([
  'received',
  'preparing',
  'ready',
  'served',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  tableId: z.string().nullable(),
  status: orderStatusSchema,
  items: z.array(cartItemSchema),
  totals: cartTotalsSchema,
  /** Idempotency key used at creation to prevent duplicate orders. */
  idempotencyKey: z.string(),
  /** Human-facing short number, e.g. "1024". */
  displayNumber: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;

/** Request body the mobile client sends to create an order. */
export const createOrderRequestSchema = z.object({
  restaurantId: z.string(),
  tableId: z.string().nullable().default(null),
  items: z.array(
    z.object({
      lineId: z.string(),
      productId: z.string(),
      quantity: z.number().int().min(1).max(99),
      sizeId: z.string().nullable().default(null),
      modifierIds: z.array(z.string()).default([]),
      notes: z.string().max(500).default(''),
    }),
  ).min(1),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
