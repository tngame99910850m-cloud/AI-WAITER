import { z } from 'zod';
import { moneySchema } from './money.js';

/**
 * Structured menu model:
 *   Restaurant → Categories → Products → Sizes / ModifierGroups → Modifiers
 *   with cross-cutting Ingredients, Allergens and Promotions.
 *
 * These schemas are the single source of truth. The AI is only ever allowed to
 * reason about and act on data that conforms to these shapes — it must never
 * invent products, prices or modifiers that are not present here.
 */

export const allergenSchema = z.object({
  id: z.string(),
  /** Stable key, e.g. `gluten`, `dairy`, `nuts`, `soy`, `shellfish`. */
  key: z.string(),
  label: z.string(),
});
export type Allergen = z.infer<typeof allergenSchema>;

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Allergen ids this ingredient contributes. */
  allergenIds: z.array(z.string()).default([]),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const dietaryTagSchema = z.enum([
  'vegetarian',
  'vegan',
  'halal',
  'gluten_free',
  'dairy_free',
  'nut_free',
  'spicy',
  'popular',
  'kids',
  'healthy',
]);
export type DietaryTag = z.infer<typeof dietaryTagSchema>;

/** A selectable option inside a modifier group (e.g. "Cheddar", "Brioche"). */
export const modifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceDelta: moneySchema,
  /** Whether choosing this option is available right now. */
  available: z.boolean().default(true),
  /** Ingredient ids added by selecting this modifier. */
  addsIngredientIds: z.array(z.string()).default([]),
  /** Ingredient ids removed by selecting this modifier (e.g. "No Onion"). */
  removesIngredientIds: z.array(z.string()).default([]),
});
export type Modifier = z.infer<typeof modifierSchema>;

export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** e.g. "Bread", "Cheese", "Extras", "Remove". */
  minSelect: z.number().int().min(0).default(0),
  /** null = unlimited. */
  maxSelect: z.number().int().min(1).nullable().default(null),
  modifiers: z.array(modifierSchema),
});
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

export const productSizeSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceDelta: moneySchema,
});
export type ProductSize = z.infer<typeof productSizeSchema>;

export const productSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().default(''),
  basePrice: moneySchema,
  imageUrl: z.string().url().nullable().default(null),
  available: z.boolean().default(true),
  /** Rating 0-5, presentation only. */
  rating: z.number().min(0).max(5).nullable().default(null),
  dietaryTags: z.array(dietaryTagSchema).default([]),
  allergenIds: z.array(z.string()).default([]),
  ingredientIds: z.array(z.string()).default([]),
  sizes: z.array(productSizeSchema).default([]),
  modifierGroups: z.array(modifierGroupSchema).default([]),
  /** For ranking recommendations. Higher = more popular. */
  popularityScore: z.number().min(0).default(0),
});
export type Product = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(''),
  sortOrder: z.number().int().default(0),
});
export type Category = z.infer<typeof categorySchema>;

export const promotionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  /** Products this promotion applies to (empty = whole menu). */
  productIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** A complete, denormalized menu for one restaurant — what the API serves. */
export const menuSchema = z.object({
  restaurantId: z.string(),
  currency: z.string(),
  categories: z.array(categorySchema),
  products: z.array(productSchema),
  modifierGroups: z.array(modifierGroupSchema),
  ingredients: z.array(ingredientSchema),
  allergens: z.array(allergenSchema),
  promotions: z.array(promotionSchema),
  updatedAt: z.string(),
});
export type Menu = z.infer<typeof menuSchema>;
