import type { CartItem, CartTotals, Money, Product, SelectedModifier } from '../types';

let lineCounter = 0;
export function newLineId(): string {
  lineCounter += 1;
  return `line_${Date.now()}_${lineCounter}`;
}

function money(amount: number, currency: string): Money {
  return { amount: Math.round(amount), currency };
}

/**
 * Client-side pricing for immediate cart feedback. The server re-prices
 * authoritatively at order creation, so this is presentation only.
 */
export function buildCartItem(
  product: Product,
  opts: { quantity: number; sizeId: string | null; modifierIds: string[]; notes?: string },
): CartItem {
  const currency = product.basePrice.currency;
  let unit = product.basePrice.amount;

  let sizeName: string | null = null;
  if (opts.sizeId) {
    const size = product.sizes.find((s) => s.id === opts.sizeId);
    if (size) {
      unit += size.priceDelta.amount;
      sizeName = size.name;
    }
  }

  const selected: SelectedModifier[] = [];
  for (const group of product.modifierGroups) {
    for (const m of group.modifiers) {
      if (opts.modifierIds.includes(m.id)) {
        selected.push({
          modifierGroupId: group.id,
          modifierId: m.id,
          name: m.name,
          priceDelta: m.priceDelta,
        });
        unit += m.priceDelta.amount;
      }
    }
  }

  const quantity = Math.max(1, Math.floor(opts.quantity));
  return {
    lineId: newLineId(),
    productId: product.id,
    name: product.name,
    quantity,
    sizeId: opts.sizeId,
    sizeName,
    unitBasePrice: product.basePrice,
    modifiers: selected,
    notes: opts.notes ?? '',
    unitPrice: money(unit, currency),
    lineTotal: money(unit * quantity, currency),
  };
}

export function computeTotals(
  items: CartItem[],
  currency: string,
  taxRateBps: number,
  discount = 0,
): CartTotals {
  const subtotal = items.reduce((acc, i) => acc + i.lineTotal.amount, 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * taxRateBps) / 10000);
  return {
    subtotal: money(subtotal, currency),
    tax: money(tax, currency),
    discount: money(discount, currency),
    total: money(taxable + tax, currency),
  };
}

/** Validate a selection satisfies each modifier group's min/max rules. */
export function validateSelection(
  product: Product,
  modifierIds: string[],
): { ok: true } | { ok: false; message: string } {
  for (const group of product.modifierGroups) {
    const count = group.modifiers.filter((m) => modifierIds.includes(m.id)).length;
    if (count < group.minSelect) {
      return { ok: false, message: `Choose at least ${group.minSelect} from ${group.name}` };
    }
    if (group.maxSelect != null && count > group.maxSelect) {
      return { ok: false, message: `Choose at most ${group.maxSelect} from ${group.name}` };
    }
  }
  return { ok: true };
}
