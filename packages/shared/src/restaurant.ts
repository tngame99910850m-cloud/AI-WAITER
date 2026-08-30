import { z } from 'zod';

/** Per-restaurant branding — each tenant configures its own look and AI persona. */
export const brandingSchema = z.object({
  logoUrl: z.string().url().nullable().default(null),
  primaryColor: z.string().default('#E8552B'),
  accentColor: z.string().default('#1F2937'),
  aiWaiterName: z.string().default('AI Waiter'),
  welcomeMessage: z.string().default('How can I help you today?'),
});
export type Branding = z.infer<typeof brandingSchema>;

/** Configurable AI behavior per restaurant. */
export const aiConfigSchema = z.object({
  /** Persona/system-prompt flavor text, e.g. "warm, concise, never pushy". */
  personality: z.string().default(
    'You are a warm, professional, concise restaurant waiter. You are helpful, never pushy.',
  ),
  /** Whether the AI is allowed to upsell. */
  upsellEnabled: z.boolean().default(true),
  /** Max number of upsell suggestions per conversation. */
  maxUpsellsPerConversation: z.number().int().min(0).default(3),
  /** Free-form FAQ entries the AI can quote verbatim. */
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .default([]),
});
export type AiConfig = z.infer<typeof aiConfigSchema>;

/** A configurable upsell rule (e.g. "when X in cart, suggest Y for +Z"). */
export const upsellRuleSchema = z.object({
  id: z.string(),
  /** Trigger: product ids or category ids present in the cart. */
  whenProductIds: z.array(z.string()).default([]),
  whenCategoryIds: z.array(z.string()).default([]),
  /** Suggested product id or modifier to add. */
  suggestProductId: z.string().nullable().default(null),
  suggestModifierId: z.string().nullable().default(null),
  message: z.string(),
  priority: z.number().int().default(0),
});
export type UpsellRule = z.infer<typeof upsellRuleSchema>;

export const openingHoursSchema = z.object({
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: z.number().int().min(0).max(6),
  /** Minutes from midnight, local restaurant time. */
  opensAt: z.number().int().min(0).max(1440),
  closesAt: z.number().int().min(0).max(1440),
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const restaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string().default('QAR'),
  timezone: z.string().default('Asia/Qatar'),
  taxRateBps: z.number().int().min(0).default(0), // basis points, e.g. 500 = 5%
  branding: brandingSchema,
  aiConfig: aiConfigSchema,
  openingHours: z.array(openingHoursSchema).default([]),
  policies: z.string().default(''),
});
export type Restaurant = z.infer<typeof restaurantSchema>;

export const tableSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  number: z.string(),
  active: z.boolean().default(true),
});
export type Table = z.infer<typeof tableSchema>;
