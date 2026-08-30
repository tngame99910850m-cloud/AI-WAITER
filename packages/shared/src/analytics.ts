import { z } from 'zod';

export const analyticsEventNameSchema = z.enum([
  'app_opened',
  'menu_viewed',
  'product_viewed',
  'ai_chat_started',
  'recommendation_clicked',
  'product_added',
  'upsell_shown',
  'upsell_accepted',
  'upsell_rejected',
  'cart_viewed',
  'order_started',
  'order_confirmed',
  'order_failed',
  'service_request_created',
]);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

export const analyticsEventSchema = z.object({
  name: analyticsEventNameSchema,
  restaurantId: z.string(),
  tableId: z.string().nullable().default(null),
  /** Free-form, non-PII properties. */
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])).default(
    {},
  ),
  /** Client timestamp (ISO). The server also records its own receipt time. */
  clientTimestamp: z.string().nullable().default(null),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
