import {
  priceLine,
  PricingError,
  type AiAction,
  type AiIntent,
  type CartItem,
  type Menu,
  type Product,
  type Restaurant,
  type UpsellRule,
} from '@ai-waiter/shared';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { RuleBasedProvider } from './ruleBasedProvider.js';
import { buildMenuContext, type AiProvider, type ProviderInput } from './provider.js';

export interface ChatResult {
  intent: AiIntent;
  reply: string;
  recommendedProductIds: string[];
  /** ADD_ITEM lines already resolved & priced against the real menu. */
  resolvedItems: CartItem[];
  /** Cart operations the client should apply. */
  cartOps: Array<{ op: 'remove' | 'clear'; productId?: string }>;
  /** Service requests to create (already validated). */
  serviceRequests: Array<{ type: string; note: string }>;
  /** True when the customer asked to confirm — client shows the summary. */
  requiresConfirmation: boolean;
  upsell: { productId: string | null; modifierId: string | null; message: string } | null;
  deferredToStaff: boolean;
  /** Raw structured actions, for transparency and analytics. */
  actions: AiAction[];
  provider: string;
}

export interface OrchestratorDeps {
  menu: Menu;
  restaurant: Restaurant;
  upsellRules: UpsellRule[];
}

function selectProvider(): AiProvider {
  const cfg = loadConfig();
  if (cfg.AI_PROVIDER === 'anthropic' && cfg.ANTHROPIC_API_KEY) {
    return new AnthropicProvider(cfg.ANTHROPIC_API_KEY, cfg.ANTHROPIC_MODEL);
  }
  return new RuleBasedProvider();
}

/**
 * The AI orchestration pipeline:
 *   message → context retrieval → provider reasoning → structured actions →
 *   validation against real menu → safe, resolved result.
 */
export async function runChat(
  deps: OrchestratorDeps,
  input: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    cartProductIds: string[];
  },
  providerOverride?: AiProvider,
): Promise<ChatResult> {
  const provider = providerOverride ?? selectProvider();
  const context = buildMenuContext(deps.menu, {
    restaurantName: deps.restaurant.name,
    aiWaiterName: deps.restaurant.branding.aiWaiterName,
    personality: deps.restaurant.aiConfig.personality,
    faqs: deps.restaurant.aiConfig.faqs,
    policies: deps.restaurant.policies,
  });

  const providerInput: ProviderInput = { ...input, context };

  let raw;
  try {
    raw = await provider.complete(providerInput);
  } catch (err) {
    logger.warn({ err, provider: provider.name }, 'AI provider failed, falling back to rules');
    raw = await new RuleBasedProvider().complete(providerInput);
  }

  const resolvedItems: CartItem[] = [];
  const cartOps: ChatResult['cartOps'] = [];
  const serviceRequests: ChatResult['serviceRequests'] = [];
  let requiresConfirmation = false;
  const recommended = new Set<string>(
    raw.recommended.map((r) => resolveProductId(deps.menu, r)).filter(Boolean) as string[],
  );

  for (const action of raw.actions) {
    switch (action.type) {
      case 'ADD_ITEM': {
        const item = resolveAddItem(deps.menu, action);
        if (item) resolvedItems.push(item);
        break;
      }
      case 'REMOVE_ITEM': {
        const pid = action.productId ?? resolveProductId(deps.menu, action.productQuery ?? '');
        if (pid) cartOps.push({ op: 'remove', productId: pid });
        break;
      }
      case 'CLEAR_CART':
        cartOps.push({ op: 'clear' });
        break;
      case 'CONFIRM_ORDER':
        requiresConfirmation = true;
        break;
      case 'CALL_WAITER':
        serviceRequests.push({ type: 'call_waiter', note: '' });
        break;
      case 'REQUEST_BILL':
        serviceRequests.push({ type: 'request_bill', note: '' });
        break;
      case 'REQUEST_ITEM': {
        const req = (action.requestText ?? '').toLowerCase();
        const type = req.includes('water')
          ? 'request_water'
          : req.includes('napkin')
            ? 'request_napkins'
            : 'other';
        serviceRequests.push({ type, note: action.requestText ?? '' });
        break;
      }
      case 'RECOMMEND_PRODUCTS':
        for (const id of raw.recommended) {
          const pid = resolveProductId(deps.menu, id);
          if (pid) recommended.add(pid);
        }
        break;
      default:
        break;
    }
  }

  // Upselling: apply the highest-priority matching rule for what's in cart or
  // just added — but only when enabled and the AI didn't already defer.
  const upsell = deps.restaurant.aiConfig.upsellEnabled
    ? pickUpsell(deps.upsellRules, [
        ...input.cartProductIds,
        ...resolvedItems.map((i) => i.productId),
      ])
    : null;

  return {
    intent: raw.intent,
    reply: raw.reply,
    recommendedProductIds: [...recommended],
    resolvedItems,
    cartOps,
    serviceRequests,
    requiresConfirmation,
    upsell,
    deferredToStaff: raw.deferredToStaff,
    actions: raw.actions,
    provider: provider.name,
  };
}

function resolveProductId(menu: Menu, query: string): string | null {
  if (!query) return null;
  const direct = menu.products.find((p) => p.id === query);
  if (direct) return direct.id;
  const q = query.toLowerCase();
  const byName = menu.products.find((p) => p.name.toLowerCase() === q);
  if (byName) return byName.id;
  const contains = menu.products.find(
    (p) => p.available && (p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())),
  );
  return contains?.id ?? null;
}

/**
 * Turn an ADD_ITEM action into a concrete, priced cart line. Resolves the size,
 * modifiers (by fuzzy name) and auto-selects required-group defaults so the
 * order is valid. Returns null if the product cannot be resolved.
 */
function resolveAddItem(menu: Menu, action: AiAction): CartItem | null {
  const productId = action.productId ?? resolveProductId(menu, action.productQuery ?? '');
  if (!productId) return null;
  const product = menu.products.find((p) => p.id === productId);
  if (!product || !product.available) return null;

  const sizeId = resolveSize(product, action.sizeQuery);
  const modifierIds = resolveModifiers(product, action.modifiers);

  // Auto-satisfy required groups (minSelect>0) that weren't chosen, using the
  // first available option (a sensible default, e.g. "Regular Bun").
  const chosenGroups = new Set(
    modifierIds
      .map((id) => findGroupForModifier(product, id))
      .filter(Boolean) as string[],
  );
  for (const group of product.modifierGroups) {
    if (group.minSelect > 0 && !chosenGroups.has(group.id)) {
      const def = group.modifiers.find((m) => m.available);
      if (def) modifierIds.push(def.id);
    }
  }

  try {
    return priceLine(menu, {
      lineId: randomUUID(),
      productId,
      quantity: action.quantity,
      sizeId,
      modifierIds,
      notes: action.notes,
    });
  } catch (err) {
    if (err instanceof PricingError) {
      logger.info({ code: err.code }, 'AI add-item failed validation; dropping');
      return null;
    }
    throw err;
  }
}

function resolveSize(product: Product, sizeQuery: string | null): string | null {
  if (!sizeQuery) return null;
  const q = sizeQuery.toLowerCase();
  const match = product.sizes.find((s) => s.name.toLowerCase().includes(q));
  return match?.id ?? null;
}

function resolveModifiers(
  product: Product,
  mods: { add: string[]; remove: string[] },
): string[] {
  const ids: string[] = [];
  for (const token of mods.add) {
    const t = token.toLowerCase();
    for (const group of product.modifierGroups) {
      const m = group.modifiers.find(
        (mod) => mod.available && mod.name.toLowerCase().includes(t) && !mod.name.toLowerCase().startsWith('no '),
      );
      if (m) {
        ids.push(m.id);
        break;
      }
    }
  }
  for (const token of mods.remove) {
    // Normalize plurals: "onions" -> "onion" so it matches a "No Onion" option.
    const stem = token.toLowerCase().replace(/s$/, '');
    for (const group of product.modifierGroups) {
      const m = group.modifiers.find((mod) => {
        const name = mod.name.toLowerCase();
        return mod.available && name.startsWith('no ') && name.includes(stem);
      });
      if (m) {
        ids.push(m.id);
        break;
      }
    }
  }
  return [...new Set(ids)];
}

function findGroupForModifier(product: Product, modifierId: string): string | null {
  for (const g of product.modifierGroups) {
    if (g.modifiers.some((m) => m.id === modifierId)) return g.id;
  }
  return null;
}

function pickUpsell(rules: UpsellRule[], cartProductIds: string[]): ChatResult['upsell'] {
  const set = new Set(cartProductIds);
  const matches = rules
    .filter((r) => r.whenProductIds.some((id) => set.has(id)))
    .sort((a, b) => b.priority - a.priority);
  const rule = matches[0];
  if (!rule) return null;
  return {
    productId: rule.suggestProductId,
    modifierId: rule.suggestModifierId,
    message: rule.message,
  };
}
