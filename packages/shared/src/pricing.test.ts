import { describe, expect, it } from 'vitest';
import type { Menu } from './menu.js';
import { computeTotals, priceCart, priceLine, PricingError } from './pricing.js';
import { money } from './money.js';

const menu: Menu = {
  restaurantId: 'r1',
  currency: 'QAR',
  updatedAt: new Date().toISOString(),
  categories: [{ id: 'c1', name: 'Chicken', description: '', sortOrder: 0 }],
  ingredients: [],
  allergens: [],
  promotions: [],
  modifierGroups: [],
  products: [
    {
      id: 'p1',
      categoryId: 'c1',
      name: 'Nashville Chicken Sandwich',
      description: 'spicy crispy',
      basePrice: money(2200),
      imageUrl: null,
      available: true,
      rating: 4.5,
      dietaryTags: ['spicy'],
      allergenIds: [],
      ingredientIds: [],
      popularityScore: 10,
      sizes: [
        { id: 's_meal', name: 'Meal', priceDelta: money(800) },
      ],
      modifierGroups: [
        {
          id: 'g_bread',
          name: 'Bread',
          minSelect: 1,
          maxSelect: 1,
          modifiers: [
            { id: 'm_reg', name: 'Regular', priceDelta: money(0), available: true, addsIngredientIds: [], removesIngredientIds: [] },
            { id: 'm_brioche', name: 'Brioche', priceDelta: money(300), available: true, addsIngredientIds: [], removesIngredientIds: [] },
          ],
        },
        {
          id: 'g_extra',
          name: 'Extras',
          minSelect: 0,
          maxSelect: 3,
          modifiers: [
            { id: 'm_cheese', name: 'Cheese', priceDelta: money(200), available: true, addsIngredientIds: [], removesIngredientIds: [] },
            { id: 'm_soldout', name: 'Truffle', priceDelta: money(500), available: false, addsIngredientIds: [], removesIngredientIds: [] },
          ],
        },
      ],
    },
    {
      id: 'p2',
      categoryId: 'c1',
      name: 'Sold Out Wrap',
      description: '',
      basePrice: money(1500),
      imageUrl: null,
      available: false,
      rating: null,
      dietaryTags: [],
      allergenIds: [],
      ingredientIds: [],
      popularityScore: 0,
      sizes: [],
      modifierGroups: [],
    },
  ],
};

describe('priceLine', () => {
  it('prices base + size + modifiers and enforces min-select', () => {
    const line = priceLine(menu, {
      lineId: 'l1',
      productId: 'p1',
      quantity: 2,
      sizeId: 's_meal',
      modifierIds: ['m_reg', 'm_cheese'],
    });
    // 2200 base + 800 meal + 0 regular + 200 cheese = 3200 unit
    expect(line.unitPrice.amount).toBe(3200);
    expect(line.lineTotal.amount).toBe(6400);
    expect(line.modifiers).toHaveLength(2);
  });

  it('rejects an unavailable product', () => {
    expect(() => priceLine(menu, { lineId: 'l', productId: 'p2', quantity: 1 }))
      .toThrowError(PricingError);
  });

  it('rejects an unavailable modifier', () => {
    expect(() =>
      priceLine(menu, { lineId: 'l', productId: 'p1', quantity: 1, sizeId: null, modifierIds: ['m_reg', 'm_soldout'] }),
    ).toThrowError(/unavailable/i);
  });

  it('enforces required bread selection (minSelect)', () => {
    try {
      priceLine(menu, { lineId: 'l', productId: 'p1', quantity: 1, modifierIds: [] });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PricingError);
      expect((e as PricingError).code).toBe('MODIFIER_RULE_VIOLATION');
    }
  });

  it('enforces maxSelect on a group', () => {
    expect(() =>
      priceLine(menu, { lineId: 'l', productId: 'p1', quantity: 1, modifierIds: ['m_reg', 'm_brioche'] }),
    ).toThrowError(/at most/i);
  });

  it('rejects modifiers not belonging to the product', () => {
    expect(() =>
      priceLine(menu, { lineId: 'l', productId: 'p1', quantity: 1, modifierIds: ['m_reg', 'does_not_exist'] }),
    ).toThrowError(/not valid/i);
  });
});

describe('computeTotals', () => {
  it('applies tax in basis points on the discounted subtotal', () => {
    const { items } = priceCart(menu, [
      { lineId: 'l1', productId: 'p1', quantity: 1, sizeId: null, modifierIds: ['m_reg'] },
    ], 0);
    const totals = computeTotals(items, 'QAR', 500, 200);
    // subtotal 2200, discount 200 -> taxable 2000, tax 5% = 100, total 2100
    expect(totals.subtotal.amount).toBe(2200);
    expect(totals.tax.amount).toBe(100);
    expect(totals.total.amount).toBe(2100);
  });
});
