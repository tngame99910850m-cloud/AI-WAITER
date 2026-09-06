import type { AiAction, AiIntent, Menu } from '@ai-waiter/shared';

/**
 * A compact, retrieval-built view of the menu passed to the LLM. We never dump
 * the whole database into the model — only the relevant, structured slice.
 */
export interface MenuContext {
  restaurantName: string;
  aiWaiterName: string;
  personality: string;
  currency: string;
  /** Compact product summaries (id, name, price, tags) for grounding. */
  products: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    tags: string[];
    allergens: string[];
  }>;
  faqs: Array<{ question: string; answer: string }>;
  policies: string;
}

export interface ProviderInput {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  cartProductIds: string[];
  context: MenuContext;
}

/**
 * Raw, un-validated structured output from a provider. The orchestrator
 * resolves product references against the real menu and enforces safety before
 * anything is applied.
 */
export interface ProviderOutput {
  intent: AiIntent;
  reply: string;
  actions: AiAction[];
  /** Product ids or names the provider recommends. */
  recommended: string[];
  deferredToStaff: boolean;
}

export interface AiProvider {
  readonly name: string;
  complete(input: ProviderInput): Promise<ProviderOutput>;
}

/** Build the compact menu context from a full menu + restaurant config. */
export function buildMenuContext(
  menu: Menu,
  opts: {
    restaurantName: string;
    aiWaiterName: string;
    personality: string;
    faqs: Array<{ question: string; answer: string }>;
    policies: string;
  },
): MenuContext {
  const allergenLabel = new Map(menu.allergens.map((a) => [a.id, a.label]));
  return {
    restaurantName: opts.restaurantName,
    aiWaiterName: opts.aiWaiterName,
    personality: opts.personality,
    currency: menu.currency,
    products: menu.products
      .filter((p) => p.available)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.basePrice.amount,
        tags: p.dietaryTags,
        allergens: p.allergenIds.map((id) => allergenLabel.get(id) ?? id),
      })),
    faqs: opts.faqs,
    policies: opts.policies,
  };
}
