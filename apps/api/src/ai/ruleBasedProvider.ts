import type { AiAction } from '@ai-waiter/shared';
import type { AiProvider, ProviderInput, ProviderOutput } from './provider.js';

/**
 * Deterministic, offline NLU provider. It requires no external API, is fully
 * testable, and serves as a safe fallback when no LLM key is configured. It
 * implements the same pipeline shape as the LLM provider: it emits structured
 * actions that the orchestrator validates against the real menu.
 */
export class RuleBasedProvider implements AiProvider {
  readonly name = 'rules';

  async complete(input: ProviderInput): Promise<ProviderOutput> {
    const text = input.message.toLowerCase().trim();
    const ctx = input.context;

    const emptyMods = { add: [] as string[], remove: [] as string[] };
    const action = (partial: Partial<AiAction> & { type: AiAction['type'] }): AiAction => ({
      type: partial.type,
      productQuery: partial.productQuery ?? null,
      productId: partial.productId ?? null,
      quantity: partial.quantity ?? 1,
      sizeQuery: partial.sizeQuery ?? null,
      modifiers: partial.modifiers ?? emptyMods,
      lineId: partial.lineId ?? null,
      notes: partial.notes ?? '',
      requestText: partial.requestText ?? null,
    });

    // --- Service requests -------------------------------------------------
    if (/\b(call|get|need).*(waiter|server|staff)\b/.test(text) || /\bwaiter\b/.test(text)) {
      return this.turn('call_waiter', 'I’ve let the team know — someone will be right with you.', [
        action({ type: 'CALL_WAITER' }),
      ]);
    }
    if (/\bwater\b/.test(text)) {
      return this.turn('request_item', 'Sure — water is on its way.', [
        action({ type: 'REQUEST_ITEM', requestText: 'water' }),
      ]);
    }
    if (/\bnapkin/.test(text)) {
      return this.turn('request_item', 'Of course — I’ll send some napkins over.', [
        action({ type: 'REQUEST_ITEM', requestText: 'napkins' }),
      ]);
    }
    if (/\b(bill|check|pay|invoice)\b/.test(text)) {
      return this.turn('request_bill', 'I’ve requested the bill for your table.', [
        action({ type: 'REQUEST_BILL' }),
      ]);
    }
    if (/\b(help|assist|assistance)\b/.test(text)) {
      return this.turn('call_waiter', 'I’ve requested assistance for your table.', [
        action({ type: 'CALL_WAITER' }),
      ]);
    }

    // --- Cart control -----------------------------------------------------
    if (/\b(confirm|place|checkout|check out|that'?s all|done ordering)\b/.test(text)) {
      return this.turn(
        'confirm_order',
        'Great! Please review your order summary and tap Confirm to send it to the kitchen.',
        [action({ type: 'CONFIRM_ORDER' })],
      );
    }
    if (/\b(clear|empty|start over|cancel).*(cart|order)\b/.test(text)) {
      return this.turn('clear_cart', 'No problem — I’ve cleared your order. What would you like instead?', [
        action({ type: 'CLEAR_CART' }),
      ]);
    }
    if (/\b(view|show|see|what'?s in).*(cart|order)\b/.test(text) || /\bmy order\b/.test(text)) {
      return this.turn('view_cart', 'Here’s what you have so far.', [action({ type: 'VIEW_CART' })]);
    }
    if (/\b(order status|where.*order|is.*ready|track)\b/.test(text)) {
      return this.turn('check_order_status', 'Let me check on your order status.', [
        action({ type: 'CHECK_ORDER_STATUS' }),
      ]);
    }

    // --- Menu product matching -------------------------------------------
    const matched = this.matchProduct(text, ctx.products);

    // Remove an item
    if (/\b(remove|delete|take off)\b/.test(text) && matched) {
      return this.turn('remove_from_order', `Removed ${matched.name} from your order.`, [
        action({ type: 'REMOVE_ITEM', productQuery: matched.name, productId: matched.id }),
      ]);
    }

    // A question (rather than a command) is answered, never treated as an order.
    const isQuestion = /\?|\b(is|are|does|do|what|which|can you|could you|how|why|contain|have)\b/.test(text);

    // --- Dietary / allergy (checked before add, so questions aren't ordered) --
    if (/\b(allergy|allergic|gluten|dairy|nut|vegan|vegetarian|halal|free)\b/.test(text)) {
      return this.answerDietary(text, ctx);
    }

    // Add an item — an ordering verb, or a bare product name that isn't a question.
    const orderVerb = /\b(i'?ll have|i want|i'?d like|add|get me|give me|can i get|order)\b/.test(text);
    if (matched && (orderVerb || (this.isBareProduct(text, matched.name) && !isQuestion))) {
      const mods = this.extractModifiers(text);
      const makeMeal = /\bmeal\b/.test(text);
      const reply = this.confirmAddReply(matched.name, mods, makeMeal, ctx.currency, matched.price);
      return this.turn('add_to_order', reply, [
        action({
          type: 'ADD_ITEM',
          productQuery: matched.name,
          productId: matched.id,
          sizeQuery: makeMeal ? 'meal' : null,
          modifiers: mods,
        }),
      ]);
    }

    // --- Recommendations --------------------------------------------------
    if (/\b(recommend|suggest|what.*good|popular|best|spicy|light|healthy|kids|chicken|hungry|under \d+)\b/.test(text)) {
      const recs = this.recommend(text, ctx);
      return this.turn(
        'ask_recommendation',
        recs.ids.length
          ? `${recs.reply}`
          : 'We have some great options — would you like something spicy, light, or a customer favorite?',
        [action({ type: 'RECOMMEND_PRODUCTS' })],
        recs.ids,
      );
    }

    // --- Greeting / fallback ---------------------------------------------
    if (/\b(hi|hello|hey|salam|marhaba)\b/.test(text)) {
      return this.turn(
        'greeting',
        `Hi! I’m ${ctx.aiWaiterName}. I can recommend dishes, answer menu questions, and take your order. What are you in the mood for?`,
        [],
      );
    }

    return this.turn(
      'unknown',
      'I can help you order, recommend dishes, or answer questions about the menu. What would you like?',
      [],
    );
  }

  private turn(
    intent: ProviderOutput['intent'],
    reply: string,
    actions: AiAction[],
    recommended: string[] = [],
    deferredToStaff = false,
  ): ProviderOutput {
    return { intent, reply, actions, recommended, deferredToStaff };
  }

  private matchProduct(
    text: string,
    products: ProviderInput['context']['products'],
  ): ProviderInput['context']['products'][number] | null {
    let best: { p: (typeof products)[number]; score: number } | null = null;
    for (const p of products) {
      const name = p.name.toLowerCase();
      let score = 0;
      if (text.includes(name)) score += 10;
      for (const word of name.split(/\s+/)) {
        if (word.length > 2 && text.includes(word)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) best = { p, score };
    }
    return best && best.score >= 2 ? best.p : null;
  }

  private isBareProduct(text: string, name: string): boolean {
    return text.includes(name.toLowerCase());
  }

  private extractModifiers(text: string): { add: string[]; remove: string[] } {
    const add: string[] = [];
    const remove: string[] = [];
    if (/\b(add|with|extra)\b.*cheese\b/.test(text) || /\bcheese\b/.test(text)) {
      if (!/\bno cheese\b/.test(text)) add.push('cheese');
    }
    if (/\bextra chicken\b/.test(text)) add.push('extra chicken');
    if (/\bjalape/.test(text)) add.push('jalapeño');
    const noMatches = text.match(/\bno ([a-z]+)\b/g) ?? [];
    for (const m of noMatches) remove.push(m.replace(/^no /, ''));
    return { add, remove };
  }

  private confirmAddReply(
    name: string,
    mods: { add: string[]; remove: string[] },
    makeMeal: boolean,
    currency: string,
    price: number,
  ): string {
    const parts = [`Added ${name}`];
    if (makeMeal) parts.push('as a meal');
    if (mods.add.length) parts.push(`with ${mods.add.join(', ')}`);
    if (mods.remove.length) parts.push(`(no ${mods.remove.join(', ')})`);
    return `${parts.join(' ')}. Anything else?`;
  }

  private recommend(text: string, ctx: ProviderInput['context']) {
    let pool = ctx.products;
    const priceCap = text.match(/under (\d+)/);
    if (/spicy/.test(text)) pool = pool.filter((p) => p.tags.includes('spicy'));
    else if (/light|healthy/.test(text)) pool = pool.filter((p) => p.tags.includes('healthy'));
    else if (/kids?/.test(text)) pool = pool.filter((p) => p.tags.includes('kids'));
    else if (/popular|best/.test(text)) pool = pool.filter((p) => p.tags.includes('popular'));
    else if (/chicken/.test(text)) pool = pool.filter((p) => /chicken/i.test(p.name));

    if (priceCap) {
      const cap = Number(priceCap[1]) * 100; // QAR -> minor units
      pool = pool.filter((p) => p.price <= cap);
    }
    if (!pool.length) pool = ctx.products.slice(0, 3);

    const top = pool.slice(0, 3);
    const names = top.map((p) => p.name).join(', ');
    return {
      ids: top.map((p) => p.id),
      reply: top.length
        ? `I’d suggest ${names}. Want me to add one to your order?`
        : '',
    };
  }

  private answerDietary(text: string, ctx: ProviderInput['context']): ProviderOutput {
    const matched = this.matchProduct(text, ctx.products);
    if (/vegetarian|vegan/.test(text)) {
      const veg = ctx.products.filter((p) => p.tags.includes('vegetarian') || p.tags.includes('vegan'));
      return this.turn(
        'ask_dietary',
        veg.length
          ? `Our vegetarian-friendly options include ${veg.map((p) => p.name).join(', ')}.`
          : 'I don’t have confirmed vegetarian items on file. Let me check with the restaurant.',
        [],
        veg.map((p) => p.id),
        veg.length === 0,
      );
    }
    // Allergen question about a specific product
    if (matched) {
      if (matched.allergens.length) {
        return this.turn(
          'ask_dietary',
          `${matched.name} contains: ${matched.allergens.join(', ')}. Please let staff know about any allergy.`,
          [],
        );
      }
      return this.turn(
        'ask_dietary',
        `I don’t have confirmed allergen information for ${matched.name}. Let me check with the restaurant to be safe.`,
        [],
        [],
        true,
      );
    }
    return this.turn(
      'ask_dietary',
      'I don’t have confirmed information about that. Let me check with the restaurant.',
      [],
      [],
      true,
    );
  }
}
