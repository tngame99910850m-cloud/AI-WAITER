import { z } from 'zod';

/**
 * The AI never mutates state directly. It emits *structured actions* that the
 * backend validates against the real menu before applying. Dangerous or
 * irreversible actions (confirm order) always require explicit customer
 * confirmation on the client.
 */

export const aiIntentSchema = z.enum([
  'greeting',
  'ask_recommendation',
  'ask_menu_question',
  'ask_dietary',
  'add_to_order',
  'remove_from_order',
  'update_item',
  'view_cart',
  'clear_cart',
  'confirm_order',
  'call_waiter',
  'request_bill',
  'request_item', // water, napkins, etc.
  'check_order_status',
  'smalltalk',
  'unknown',
]);
export type AiIntent = z.infer<typeof aiIntentSchema>;

export const aiActionTypeSchema = z.enum([
  'SEARCH_MENU',
  'GET_PRODUCT',
  'RECOMMEND_PRODUCTS',
  'ADD_ITEM',
  'REMOVE_ITEM',
  'UPDATE_ITEM',
  'VIEW_CART',
  'CLEAR_CART',
  'CONFIRM_ORDER',
  'CALL_WAITER',
  'REQUEST_BILL',
  'REQUEST_ITEM',
  'CHECK_ORDER_STATUS',
  'REPLY_ONLY',
]);
export type AiActionType = z.infer<typeof aiActionTypeSchema>;

/** A modifier request the AI extracts, resolved against the menu later. */
export const aiModifierRequestSchema = z.object({
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

/** Structured action proposed by the AI. Validated before it is applied. */
export const aiActionSchema = z.object({
  type: aiActionTypeSchema,
  /** Product name or query as the customer described it. */
  productQuery: z.string().nullable().default(null),
  /** Resolved product id once validated by the backend (null if unresolved). */
  productId: z.string().nullable().default(null),
  quantity: z.number().int().min(1).max(99).default(1),
  sizeQuery: z.string().nullable().default(null),
  modifiers: aiModifierRequestSchema.default({ add: [], remove: [] }),
  /** For UPDATE_ITEM / REMOVE_ITEM against an existing cart line. */
  lineId: z.string().nullable().default(null),
  notes: z.string().default(''),
  /** Free text for REQUEST_ITEM (e.g. "water", "napkins"). */
  requestText: z.string().nullable().default(null),
});
export type AiAction = z.infer<typeof aiActionSchema>;

/** The full structured result the orchestrator returns for one message. */
export const aiTurnSchema = z.object({
  intent: aiIntentSchema,
  /** Natural-language reply to show the customer. */
  reply: z.string(),
  /** Structured actions the client/back end should surface or apply. */
  actions: z.array(aiActionSchema).default([]),
  /** Products to render as recommendation cards (resolved ids). */
  recommendedProductIds: z.array(z.string()).default([]),
  /** An optional upsell suggestion to render as a CTA. */
  upsell: z
    .object({
      productId: z.string().nullable().default(null),
      modifierId: z.string().nullable().default(null),
      message: z.string(),
    })
    .nullable()
    .default(null),
  /** True when the AI is unsure and defers to restaurant staff. */
  deferredToStaff: z.boolean().default(false),
});
export type AiTurn = z.infer<typeof aiTurnSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  restaurantId: z.string(),
  tableId: z.string().nullable().default(null),
  message: z.string().min(1).max(2000),
  /** Recent conversation history for context (bounded by the API). */
  history: z.array(chatMessageSchema).max(40).default([]),
  /** Current cart line ids + product ids, so the AI knows what's in the cart. */
  cartProductIds: z.array(z.string()).default([]),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
