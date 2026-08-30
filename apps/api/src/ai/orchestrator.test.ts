import { beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../data/seed.js';
import { store } from '../data/store.js';
import { runChat } from './orchestrator.js';
import { RuleBasedProvider } from './ruleBasedProvider.js';

function deps() {
  const t = store.tenant('juniors');
  return { menu: t.menu, restaurant: t.restaurant, upsellRules: t.upsellRules };
}

const rules = new RuleBasedProvider();

describe('orchestrator (rule-based)', () => {
  beforeEach(() => seed());

  it('recommends spicy chicken and resolves product ids', async () => {
    const res = await runChat(deps(), { message: 'I want something spicy with chicken', history: [], cartProductIds: [] }, rules);
    expect(res.intent).toBe('ask_recommendation');
    expect(res.recommendedProductIds).toContain('p_nashville');
  });

  it('adds an item as a resolved, priced cart line with a required-group default', async () => {
    const res = await runChat(deps(), { message: "I'll have a Nashville Chicken Sandwich, make it a meal, add cheese, no onions", history: [], cartProductIds: [] }, rules);
    expect(res.intent).toBe('add_to_order');
    expect(res.resolvedItems).toHaveLength(1);
    const item = res.resolvedItems[0]!;
    expect(item.productId).toBe('p_nashville');
    // base 2200 + meal 800 + cheese 200 = 3200; bread default (regular) is 0
    expect(item.unitPrice.amount).toBe(3200);
    const modNames = item.modifiers.map((m) => m.name.toLowerCase());
    expect(modNames.some((n) => n.includes('cheese'))).toBe(true);
    expect(modNames.some((n) => n.includes('no onion'))).toBe(true);
  });

  it('produces an upsell when a sandwich is in the cart', async () => {
    const res = await runChat(deps(), { message: "I'll have a classic chicken sandwich", history: [], cartProductIds: [] }, rules);
    expect(res.upsell?.message).toMatch(/meal/i);
  });

  it('creates a service request for water', async () => {
    const res = await runChat(deps(), { message: 'can I get some water please', history: [], cartProductIds: [] }, rules);
    expect(res.serviceRequests[0]?.type).toBe('request_water');
  });

  it('defers unknown allergen questions to staff rather than inventing facts', async () => {
    const res = await runChat(deps(), { message: 'is the grilled chicken salad nut free? I have a nut allergy', history: [], cartProductIds: [] }, rules);
    expect(res.deferredToStaff).toBe(true);
  });

  it('flags confirm intent for client-side confirmation', async () => {
    const res = await runChat(deps(), { message: "that's all, please confirm my order", history: [], cartProductIds: ['p_fries'] }, rules);
    expect(res.requiresConfirmation).toBe(true);
  });
});
