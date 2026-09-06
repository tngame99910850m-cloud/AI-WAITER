import type { Menu, Product } from './menu.js';
import type { CartItem, CartTotals, SelectedModifier } from './order.js';
import { addMoney, money, multiplyMoney } from './money.js';

export interface LineSelection {
  lineId: string;
  productId: string;
  quantity: number;
  sizeId?: string | null;
  modifierIds?: string[];
  notes?: string;
}

export class PricingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PRODUCT_NOT_FOUND'
      | 'PRODUCT_UNAVAILABLE'
      | 'SIZE_NOT_FOUND'
      | 'MODIFIER_NOT_FOUND'
      | 'MODIFIER_UNAVAILABLE'
      | 'MODIFIER_RULE_VIOLATION',
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

/**
 * Resolve and price a single line against the menu. Validates that the product,
 * size and every modifier exist, are available, and satisfy the modifier-group
 * min/max selection rules. Throws {@link PricingError} on any violation.
 *
 * This is the authoritative pricing path: the server prices from the menu, never
 * from client-supplied prices.
 */
export function priceLine(menu: Menu, sel: LineSelection): CartItem {
  const product = menu.products.find((p) => p.id === sel.productId);
  if (!product) {
    throw new PricingError(
      `Product ${sel.productId} not found`,
      'PRODUCT_NOT_FOUND',
      { productId: sel.productId },
    );
  }
  if (!product.available) {
    throw new PricingError(
      `${product.name} is currently unavailable`,
      'PRODUCT_UNAVAILABLE',
      { productId: sel.productId },
    );
  }

  const currency = menu.currency;
  let unit = product.basePrice;

  // Size
  let sizeName: string | null = null;
  if (sel.sizeId) {
    const size = product.sizes.find((s) => s.id === sel.sizeId);
    if (!size) {
      throw new PricingError(`Size ${sel.sizeId} not found`, 'SIZE_NOT_FOUND', {
        productId: product.id,
        sizeId: sel.sizeId,
      });
    }
    sizeName = size.name;
    unit = addMoney(unit, size.priceDelta);
  }

  // Modifiers — must belong to one of the product's groups.
  const selectedModifierIds = sel.modifierIds ?? [];
  const selected: SelectedModifier[] = [];
  const countByGroup = new Map<string, number>();

  const groupIndex = indexById(product.modifierGroups);
  const modifierToGroup = new Map<string, string>();
  for (const group of product.modifierGroups) {
    for (const m of group.modifiers) modifierToGroup.set(m.id, group.id);
  }

  for (const modId of selectedModifierIds) {
    const groupId = modifierToGroup.get(modId);
    if (!groupId) {
      throw new PricingError(
        `Modifier ${modId} is not valid for ${product.name}`,
        'MODIFIER_NOT_FOUND',
        { productId: product.id, modifierId: modId },
      );
    }
    const group = groupIndex.get(groupId)!;
    const modifier = group.modifiers.find((m) => m.id === modId)!;
    if (!modifier.available) {
      throw new PricingError(
        `${modifier.name} is currently unavailable`,
        'MODIFIER_UNAVAILABLE',
        { productId: product.id, modifierId: modId },
      );
    }
    selected.push({
      modifierGroupId: group.id,
      modifierId: modifier.id,
      name: modifier.name,
      priceDelta: modifier.priceDelta,
    });
    unit = addMoney(unit, modifier.priceDelta);
    countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + 1);
  }

  // Enforce min/max selection rules per group.
  for (const group of product.modifierGroups) {
    const count = countByGroup.get(group.id) ?? 0;
    if (count < group.minSelect) {
      throw new PricingError(
        `${product.name}: choose at least ${group.minSelect} from ${group.name}`,
        'MODIFIER_RULE_VIOLATION',
        { productId: product.id, groupId: group.id, min: group.minSelect },
      );
    }
    if (group.maxSelect != null && count > group.maxSelect) {
      throw new PricingError(
        `${product.name}: choose at most ${group.maxSelect} from ${group.name}`,
        'MODIFIER_RULE_VIOLATION',
        { productId: product.id, groupId: group.id, max: group.maxSelect },
      );
    }
  }

  const quantity = Math.max(1, Math.floor(sel.quantity));
  const lineTotal = multiplyMoney(unit, quantity);

  return {
    lineId: sel.lineId,
    productId: product.id,
    name: product.name,
    quantity,
    sizeId: sel.sizeId ?? null,
    sizeName,
    unitBasePrice: product.basePrice,
    modifiers: selected,
    notes: sel.notes ?? '',
    unitPrice: unit,
    lineTotal,
  };
}

export function computeTotals(
  items: CartItem[],
  currency: string,
  taxRateBps: number,
  discount = 0,
): CartTotals {
  const subtotal = items.reduce(
    (acc, i) => addMoney(acc, i.lineTotal),
    money(0, currency),
  );
  const discountMoney = money(discount, currency);
  const taxable = Math.max(0, subtotal.amount - discountMoney.amount);
  const tax = money(Math.round((taxable * taxRateBps) / 10000), currency);
  const total = money(taxable + tax.amount, currency);
  return { subtotal, tax, discount: discountMoney, total };
}

/** Price a whole cart of selections at once. */
export function priceCart(
  menu: Menu,
  selections: LineSelection[],
  taxRateBps: number,
): { items: CartItem[]; totals: CartTotals } {
  const items = selections.map((s) => priceLine(menu, s));
  const totals = computeTotals(items, menu.currency, taxRateBps);
  return { items, totals };
}

/** Utility: resolve products by free-text query for the recommendation engine. */
export function findProductsByText(menu: Menu, query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return menu.products
    .filter((p) => p.available)
    .map((p) => {
      const haystack = [
        p.name,
        p.description,
        ...p.dietaryTags,
      ]
        .join(' ')
        .toLowerCase();
      const score = terms.reduce(
        (acc, t) => acc + (haystack.includes(t) ? 1 : 0),
        0,
      );
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.popularityScore - a.p.popularityScore)
    .map((x) => x.p);
}
