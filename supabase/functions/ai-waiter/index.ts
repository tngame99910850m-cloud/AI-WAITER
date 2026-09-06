// AI Waiter API — Supabase Edge Function (Deno).
//
// A public deployment shim that serves the same customer API contract as the
// Express backend (apps/api) so the mobile app has a reachable, protection-free
// endpoint. Self-contained: embedded menu, server-authoritative pricing, and the
// deterministic rule-based AI. Deployed with verify_jwt=false (public); the app
// still sends its own x-api-key which this function checks.
//
// Base URL when deployed: https://<ref>.supabase.co/functions/v1/ai-waiter
// The mobile client calls `${BASE}/health`, `${BASE}/v1/chat`, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CLIENT_KEYS = new Set(["dev-client-key"]);
const CUR = "QAR";

type Money = { amount: number; currency: string };
const money = (amount: number, currency = CUR): Money => ({ amount, currency });

// ---------------------------------------------------------------------------
// Menu (mirrors apps/api seed) — two tenants share the same menu shape.
// ---------------------------------------------------------------------------
function breadGroup() {
  return { id: "g_bread", name: "Bread", minSelect: 1, maxSelect: 1, modifiers: [
    { id: "m_bread_regular", name: "Regular Bun", priceDelta: money(0), available: true },
    { id: "m_bread_brioche", name: "Brioche Bun", priceDelta: money(300), available: true },
  ] };
}
function cheeseGroup() {
  return { id: "g_cheese", name: "Cheese", minSelect: 0, maxSelect: 1, modifiers: [
    { id: "m_cheese_american", name: "American Cheese", priceDelta: money(200), available: true },
    { id: "m_cheese_cheddar", name: "Cheddar Cheese", priceDelta: money(200), available: true },
  ] };
}
function extrasGroup() {
  return { id: "g_extras", name: "Extras", minSelect: 0, maxSelect: 4, modifiers: [
    { id: "m_extra_chicken", name: "Extra Chicken", priceDelta: money(500), available: true },
    { id: "m_extra_jalapeno", name: "Jalapeño", priceDelta: money(100), available: true },
  ] };
}
function removeGroup() {
  return { id: "g_remove", name: "Remove", minSelect: 0, maxSelect: 2, modifiers: [
    { id: "m_no_onion", name: "No Onion", priceDelta: money(0), available: true },
    { id: "m_no_pickles", name: "No Pickles", priceDelta: money(0), available: true },
  ] };
}

// deno-lint-ignore no-explicit-any
function products(): any[] {
  return [
    { id: "p_nashville", categoryId: "cat_chicken", name: "Nashville Chicken Sandwich",
      description: "Crispy fried chicken with a spicy Nashville glaze, pickles and slaw.",
      basePrice: money(2200), imageUrl: null, available: true, rating: 4.7,
      dietaryTags: ["spicy", "popular"], allergenIds: ["al_gluten"], ingredientIds: [], popularityScore: 98,
      sizes: [{ id: "s_sandwich", name: "Sandwich", priceDelta: money(0) }, { id: "s_meal", name: "Meal (fries + drink)", priceDelta: money(800) }],
      modifierGroups: [breadGroup(), cheeseGroup(), extrasGroup(), removeGroup()] },
    { id: "p_classic", categoryId: "cat_chicken", name: "Classic Chicken Sandwich",
      description: "Buttermilk fried chicken, lettuce, and house sauce.",
      basePrice: money(1900), imageUrl: null, available: true, rating: 4.4,
      dietaryTags: ["popular"], allergenIds: ["al_gluten"], ingredientIds: [], popularityScore: 80,
      sizes: [{ id: "s_sandwich", name: "Sandwich", priceDelta: money(0) }, { id: "s_meal", name: "Meal (fries + drink)", priceDelta: money(800) }],
      modifierGroups: [breadGroup(), cheeseGroup(), extrasGroup(), removeGroup()] },
    { id: "p_salad", categoryId: "cat_salads", name: "Grilled Chicken Salad",
      description: "Grilled chicken breast over crisp greens with a light vinaigrette.",
      basePrice: money(2400), imageUrl: null, available: true, rating: 4.5,
      dietaryTags: ["healthy", "gluten_free"], allergenIds: [], ingredientIds: [], popularityScore: 60,
      sizes: [], modifierGroups: [{ id: "g_dressing", name: "Dressing", minSelect: 1, maxSelect: 1, modifiers: [
        { id: "m_vin", name: "Vinaigrette", priceDelta: money(0), available: true },
        { id: "m_ranch", name: "Ranch", priceDelta: money(0), available: true }] }] },
    { id: "p_nuggets", categoryId: "cat_kids", name: "Kids Chicken Nuggets",
      description: "Six crispy nuggets — a kids favorite. Mild, not spicy.",
      basePrice: money(1500), imageUrl: null, available: true, rating: 4.6,
      dietaryTags: ["kids", "popular"], allergenIds: ["al_gluten"], ingredientIds: [], popularityScore: 70,
      sizes: [], modifierGroups: [] },
    { id: "p_fries", categoryId: "cat_sides", name: "Fries",
      description: "Golden, crispy skin-on fries.",
      basePrice: money(900), imageUrl: null, available: true, rating: 4.3,
      dietaryTags: ["vegetarian", "popular"], allergenIds: [], ingredientIds: [], popularityScore: 90,
      sizes: [{ id: "s_reg", name: "Regular", priceDelta: money(0) }, { id: "s_large", name: "Large", priceDelta: money(400) }],
      modifierGroups: [{ id: "g_fries_sauce", name: "Add Sauce", minSelect: 0, maxSelect: 2, modifiers: [
        { id: "m_cheese_sauce", name: "Cheese Sauce", priceDelta: money(200), available: true },
        { id: "m_spicy_mayo", name: "Spicy Mayo", priceDelta: money(200), available: true }] }] },
    { id: "p_cola", categoryId: "cat_drinks", name: "Cola", description: "Ice-cold cola.",
      basePrice: money(700), imageUrl: null, available: true, rating: 4.2,
      dietaryTags: ["vegetarian"], allergenIds: [], ingredientIds: [], popularityScore: 65,
      sizes: [{ id: "s_reg", name: "Regular", priceDelta: money(0) }, { id: "s_large", name: "Large", priceDelta: money(300) }],
      modifierGroups: [] },
  ];
}

function menuFor(restaurantId: string) {
  return {
    restaurantId, currency: CUR, updatedAt: new Date().toISOString(),
    categories: [
      { id: "cat_chicken", name: "Chicken", description: "Our famous fried chicken", sortOrder: 0 },
      { id: "cat_salads", name: "Salads", description: "Lighter options", sortOrder: 1 },
      { id: "cat_sides", name: "Sides", description: "", sortOrder: 2 },
      { id: "cat_kids", name: "Kids", description: "For younger guests", sortOrder: 3 },
      { id: "cat_drinks", name: "Drinks", description: "", sortOrder: 4 },
    ],
    products: products(), modifierGroups: [], ingredients: [],
    allergens: [
      { id: "al_gluten", key: "gluten", label: "Gluten" },
      { id: "al_dairy", key: "dairy", label: "Dairy" },
    ],
    promotions: [{ id: "promo_meal", title: "Make it a Meal", description: "Add fries and a drink to any sandwich for +8 QAR.", productIds: ["p_nashville", "p_classic"], active: true }],
  };
}

const RESTAURANTS: Record<string, {
  id: string; name: string; currency: string; taxRateBps: number;
  // deno-lint-ignore no-explicit-any
  branding: any; policies: string; tables: number;
}> = {
  juniors: { id: "juniors", name: "Juniors", currency: CUR, taxRateBps: 0,
    branding: { logoUrl: null, primaryColor: "#E8552B", accentColor: "#111827", aiWaiterName: "Juniors AI Waiter", welcomeMessage: "Welcome to Juniors! How can I help you today?" },
    policies: "Dine-in table service.", tables: 20 },
  sarahs: { id: "sarahs", name: "Sarah's Kitchen", currency: CUR, taxRateBps: 0,
    branding: { logoUrl: null, primaryColor: "#0EA5E9", accentColor: "#111827", aiWaiterName: "Sarah — Your AI Waiter", welcomeMessage: "Hi, I’m Sarah. What are you in the mood for today?" },
    policies: "Dine-in table service.", tables: 10 },
};

const UPSELLS: Record<string, { whenProductIds: string[]; suggestModifierId: string | null; message: string; priority: number }[]> = {
  _default: [
    { whenProductIds: ["p_nashville", "p_classic"], suggestModifierId: null, message: "Would you like to make it a meal with fries and a drink for +8 QAR?", priority: 10 },
    { whenProductIds: ["p_fries"], suggestModifierId: "m_cheese_sauce", message: "Would you like to add cheese sauce for +2 QAR?", priority: 5 },
  ],
};

// ---------------------------------------------------------------------------
// Pricing (server-authoritative)
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
function priceLine(menu: any, sel: { lineId: string; productId: string; quantity: number; sizeId?: string | null; modifierIds?: string[]; notes?: string }) {
  const product = menu.products.find((p: any) => p.id === sel.productId);
  if (!product || !product.available) throw new Error("PRODUCT_UNAVAILABLE");
  let unit = product.basePrice.amount;
  let sizeName: string | null = null;
  if (sel.sizeId) {
    const size = product.sizes.find((s: any) => s.id === sel.sizeId);
    if (!size) throw new Error("SIZE_NOT_FOUND");
    sizeName = size.name; unit += size.priceDelta.amount;
  }
  const ids = sel.modifierIds ?? [];
  const selected: any[] = [];
  const countByGroup: Record<string, number> = {};
  for (const id of ids) {
    let found: any = null; let grp: any = null;
    for (const g of product.modifierGroups) { const m = g.modifiers.find((x: any) => x.id === id); if (m) { found = m; grp = g; break; } }
    if (!found) throw new Error("MODIFIER_NOT_FOUND");
    if (!found.available) throw new Error("MODIFIER_UNAVAILABLE");
    selected.push({ modifierGroupId: grp.id, modifierId: found.id, name: found.name, priceDelta: found.priceDelta });
    unit += found.priceDelta.amount;
    countByGroup[grp.id] = (countByGroup[grp.id] ?? 0) + 1;
  }
  for (const g of product.modifierGroups) {
    const c = countByGroup[g.id] ?? 0;
    if (c < g.minSelect) throw new Error("MODIFIER_RULE_VIOLATION");
    if (g.maxSelect != null && c > g.maxSelect) throw new Error("MODIFIER_RULE_VIOLATION");
  }
  const quantity = Math.max(1, Math.floor(sel.quantity));
  return { lineId: sel.lineId, productId: product.id, name: product.name, quantity,
    sizeId: sel.sizeId ?? null, sizeName, unitBasePrice: product.basePrice, modifiers: selected,
    notes: sel.notes ?? "", unitPrice: money(unit), lineTotal: money(unit * quantity) };
}
// deno-lint-ignore no-explicit-any
function computeTotals(items: any[], taxRateBps: number) {
  const subtotal = items.reduce((a: number, i: any) => a + i.lineTotal.amount, 0);
  const tax = Math.round((subtotal * taxRateBps) / 10000);
  return { subtotal: money(subtotal), tax: money(tax), discount: money(0), total: money(subtotal + tax) };
}

// Auto-satisfy required modifier groups (e.g. Bread) with their first option.
// deno-lint-ignore no-explicit-any
function withRequiredDefaults(product: any, modifierIds: string[]): string[] {
  const ids = [...modifierIds];
  for (const g of product.modifierGroups) {
    if (g.minSelect > 0 && !g.modifiers.some((m: any) => ids.includes(m.id))) {
      const def = g.modifiers.find((m: any) => m.available);
      if (def) ids.push(def.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Rule-based AI (mirrors apps/api ruleBasedProvider, compact)
// ---------------------------------------------------------------------------
let lineSeq = 0;
const newLineId = () => `line_${Date.now()}_${++lineSeq}`;

// deno-lint-ignore no-explicit-any
function runChat(restaurantId: string, message: string, cartProductIds: string[]) {
  const menu = menuFor(restaurantId);
  const rest = RESTAURANTS[restaurantId];
  const text = message.toLowerCase().trim();
  const result: any = { intent: "unknown", reply: "", recommendedProductIds: [], resolvedItems: [],
    cartOps: [], serviceRequests: [], requiresConfirmation: false, upsell: null, deferredToStaff: false,
    actions: [], provider: "rules-edge" };

  const matchProduct = () => {
    let best: any = null; let bestScore = 0;
    for (const p of menu.products) {
      const name = p.name.toLowerCase(); let score = 0;
      if (text.includes(name)) score += 10;
      for (const w of name.split(/\s+/)) if (w.length > 2 && text.includes(w)) score += 1;
      if (score > bestScore) { best = p; bestScore = score; }
    }
    return bestScore >= 2 ? best : null;
  };

  // Service requests
  if (/\bwaiter\b|\b(call|get|need).*(waiter|server|staff)\b/.test(text)) {
    result.intent = "call_waiter"; result.reply = "I’ve let the team know — someone will be right with you.";
    result.serviceRequests.push({ type: "call_waiter", note: "" }); return result;
  }
  if (/\bwater\b/.test(text)) { result.intent = "request_item"; result.reply = "Sure — water is on its way."; result.serviceRequests.push({ type: "request_water", note: "" }); return result; }
  if (/\bnapkin/.test(text)) { result.intent = "request_item"; result.reply = "Of course — I’ll send some napkins over."; result.serviceRequests.push({ type: "request_napkins", note: "" }); return result; }
  if (/\b(bill|check|pay|invoice)\b/.test(text)) { result.intent = "request_bill"; result.reply = "I’ve requested the bill for your table."; result.serviceRequests.push({ type: "request_bill", note: "" }); return result; }

  if (/\b(confirm|place|checkout|check out|that'?s all|done ordering)\b/.test(text)) {
    result.intent = "confirm_order"; result.requiresConfirmation = true;
    result.reply = "Great! Please review your order summary and tap Confirm to send it to the kitchen."; return result;
  }
  if (/\b(clear|empty|start over|cancel).*(cart|order)\b/.test(text)) {
    result.intent = "clear_cart"; result.reply = "No problem — I’ve cleared your order. What would you like instead?";
    result.cartOps.push({ op: "clear" }); return result;
  }

  const isQuestion = /\?|\b(is|are|does|do|what|which|can you|could you|how|why|contain|have|free)\b/.test(text);

  // Dietary
  if (/\b(allergy|allergic|gluten|dairy|nut|vegan|vegetarian|halal|free)\b/.test(text)) {
    result.intent = "ask_dietary";
    if (/vegetarian|vegan/.test(text)) {
      const veg = menu.products.filter((p) => p.dietaryTags.includes("vegetarian") || p.dietaryTags.includes("vegan"));
      result.reply = veg.length ? `Our vegetarian-friendly options include ${veg.map((p) => p.name).join(", ")}.` : "Let me check with the restaurant.";
      result.recommendedProductIds = veg.map((p) => p.id);
      result.deferredToStaff = veg.length === 0;
    } else {
      const m = matchProduct();
      if (m && m.allergenIds.length) result.reply = `${m.name} contains: ${m.allergenIds.map((a: string) => a.replace("al_", "")).join(", ")}. Please tell staff about any allergy.`;
      else { result.reply = "I don’t have confirmed information about that. Let me check with the restaurant."; result.deferredToStaff = true; }
    }
    return result;
  }

  const matched = matchProduct();
  const orderVerb = /\b(i'?ll have|i want|i'?d like|add|get me|give me|can i get|order)\b/.test(text);
  if (matched && (orderVerb || (text.includes(matched.name.toLowerCase()) && !isQuestion))) {
    const add: string[] = [];
    if (/\bcheese\b/.test(text) && !/\bno cheese\b/.test(text)) add.push("cheese");
    if (/\bextra chicken\b/.test(text)) add.push("extra chicken");
    if (/\bjalape/.test(text)) add.push("jalapeño");
    const remove: string[] = (text.match(/\bno ([a-z]+)\b/g) ?? []).map((s) => s.replace(/^no /, ""));
    const makeMeal = /\bmeal\b/.test(text);
    // resolve modifiers
    const modIds: string[] = [];
    for (const g of matched.modifierGroups) {
      for (const m of g.modifiers) {
        const nm = m.name.toLowerCase();
        if (add.some((t) => nm.includes(t) && !nm.startsWith("no "))) modIds.push(m.id);
        for (const r of remove) { const stem = r.replace(/s$/, ""); if (nm.startsWith("no ") && nm.includes(stem)) modIds.push(m.id); }
      }
    }
    const sizeId = makeMeal ? (matched.sizes.find((s: any) => /meal/i.test(s.name))?.id ?? null) : null;
    const finalMods = withRequiredDefaults(matched, [...new Set(modIds)]);
    try {
      const item = priceLine(menu, { lineId: newLineId(), productId: matched.id, quantity: 1, sizeId, modifierIds: finalMods });
      result.resolvedItems.push(item);
      result.intent = "add_to_order";
      const parts = [`Added ${matched.name}`];
      if (makeMeal) parts.push("as a meal");
      if (add.length) parts.push(`with ${add.join(", ")}`);
      if (remove.length) parts.push(`(no ${remove.join(", ")})`);
      result.reply = `${parts.join(" ")}. Anything else?`;
    } catch {
      result.intent = "add_to_order"; result.reply = `I couldn't add ${matched.name} as requested — want to customize it?`;
    }
    result.upsell = pickUpsell([...cartProductIds, ...result.resolvedItems.map((i: any) => i.productId)]);
    return result;
  }

  // Recommendations
  if (/\b(recommend|suggest|what.*good|popular|best|spicy|light|healthy|kids|chicken|hungry|under \d+)\b/.test(text)) {
    let pool = menu.products.filter((p) => p.available);
    const cap = text.match(/under (\d+)/);
    if (/spicy/.test(text)) pool = pool.filter((p) => p.dietaryTags.includes("spicy"));
    else if (/light|healthy/.test(text)) pool = pool.filter((p) => p.dietaryTags.includes("healthy"));
    else if (/kids?/.test(text)) pool = pool.filter((p) => p.dietaryTags.includes("kids"));
    else if (/popular|best/.test(text)) pool = pool.filter((p) => p.dietaryTags.includes("popular"));
    else if (/chicken/.test(text)) pool = pool.filter((p) => /chicken/i.test(p.name));
    if (cap) { const c = Number(cap[1]) * 100; pool = pool.filter((p) => p.basePrice.amount <= c); }
    if (!pool.length) pool = menu.products.slice(0, 3);
    const top = pool.slice(0, 3);
    result.intent = "ask_recommendation";
    result.recommendedProductIds = top.map((p) => p.id);
    result.reply = top.length ? `I’d suggest ${top.map((p) => p.name).join(", ")}. Want me to add one to your order?` : "We have some great options — spicy, light, or a customer favorite?";
    return result;
  }

  if (/\b(hi|hello|hey|salam|marhaba)\b/.test(text)) {
    result.intent = "greeting";
    result.reply = `Hi! I’m ${rest.branding.aiWaiterName}. I can recommend dishes, answer menu questions, and take your order. What are you in the mood for?`;
    return result;
  }

  result.reply = "I can help you order, recommend dishes, or answer questions about the menu. What would you like?";
  return result;
}

function pickUpsell(cartProductIds: string[]) {
  const set = new Set(cartProductIds);
  const rules = UPSELLS._default.filter((r) => r.whenProductIds.some((id) => set.has(id))).sort((a, b) => b.priority - a.priority);
  const r = rules[0];
  return r ? { productId: null, modifierId: r.suggestModifierId, message: r.message } : null;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,x-api-key,x-admin-key,idempotency-key,x-request-id",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });
const err = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

const orders = new Map<string, any>(); // ephemeral per-instance
let orderSeq = 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  let path = url.pathname;
  const marker = "/ai-waiter";
  const i = path.indexOf(marker);
  if (i >= 0) path = path.slice(i + marker.length) || "/";
  const seg = path.split("/").filter(Boolean); // e.g. ["v1","chat"]

  if (path === "/" || path === "/health") {
    return json({ status: "ok", ts: new Date().toISOString(), service: "ai-waiter-edge" });
  }

  // Everything under /v1 requires the client key.
  const key = req.headers.get("x-api-key");
  if (!key || !CLIENT_KEYS.has(key)) return err(401, "UNAUTHORIZED", "Missing or invalid API key");

  try {
    // GET /v1/restaurants
    if (req.method === "GET" && seg[0] === "v1" && seg[1] === "restaurants" && seg.length === 2) {
      return json({ restaurants: Object.values(RESTAURANTS).map((r) => ({ id: r.id, name: r.name, currency: r.currency, branding: r.branding })) });
    }
    // /v1/restaurants/:id ...
    if (seg[0] === "v1" && seg[1] === "restaurants" && seg[2]) {
      const rid = seg[2];
      const rest = RESTAURANTS[rid];
      if (!rest) return err(404, "NOT_FOUND", "Restaurant not found");
      if (seg.length === 3 && req.method === "GET") {
        const tables = Array.from({ length: rest.tables }, (_, k) => ({ id: `t${k + 1}`, restaurantId: rid, number: String(k + 1), active: true }));
        return json({ restaurant: { id: rest.id, name: rest.name, currency: rest.currency, taxRateBps: rest.taxRateBps, branding: rest.branding, policies: rest.policies }, tables });
      }
      if (seg[3] === "menu" && req.method === "GET") return json({ menu: menuFor(rid) });
      if (seg[3] === "products" && seg[4] && req.method === "GET") {
        const p = menuFor(rid).products.find((x) => x.id === seg[4]);
        return p ? json({ product: p }) : err(404, "NOT_FOUND", "Product not found");
      }
      if (seg[3] === "orders" && seg[4] && req.method === "GET") {
        const o = orders.get(seg[4]);
        return o ? json({ order: o }) : err(404, "NOT_FOUND", "Order not found");
      }
    }
    // POST /v1/chat
    if (req.method === "POST" && seg[0] === "v1" && seg[1] === "chat") {
      const body = await req.json();
      if (!RESTAURANTS[body.restaurantId]) return err(404, "NOT_FOUND", "Restaurant not found");
      return json({ result: runChat(body.restaurantId, String(body.message ?? ""), body.cartProductIds ?? []) });
    }
    // POST /v1/orders
    if (req.method === "POST" && seg[0] === "v1" && seg[1] === "orders") {
      const body = await req.json();
      const rest = RESTAURANTS[body.restaurantId];
      if (!rest) return err(404, "NOT_FOUND", "Restaurant not found");
      const menu = menuFor(body.restaurantId);
      const items = (body.items ?? []).map((it: any) => priceLine(menu, it));
      if (!items.length) return err(400, "BAD_REQUEST", "Order has no items");
      const totals = computeTotals(items, rest.taxRateBps);
      const seq = ++orderSeq;
      const now = new Date().toISOString();
      const order = { id: `ord_${body.restaurantId}_${seq}`, restaurantId: body.restaurantId, tableId: body.tableId ?? null,
        status: "received", items, totals, idempotencyKey: req.headers.get("idempotency-key") ?? String(seq),
        displayNumber: String(seq), createdAt: now, updatedAt: now };
      orders.set(order.id, order);
      return json({ order, deduplicated: false }, 201);
    }
    // POST /v1/service-requests
    if (req.method === "POST" && seg[0] === "v1" && seg[1] === "service-requests") {
      const body = await req.json();
      if (!RESTAURANTS[body.restaurantId]) return err(404, "NOT_FOUND", "Restaurant not found");
      const request = { id: crypto.randomUUID(), restaurantId: body.restaurantId, tableId: body.tableId ?? null,
        type: body.type, note: body.note ?? "", status: "open", createdAt: new Date().toISOString() };
      return json({ request }, 201);
    }
    // POST /v1/analytics
    if (req.method === "POST" && seg[0] === "v1" && seg[1] === "analytics") {
      return json({ ok: true }, 202);
    }
  } catch (e) {
    const msg = (e as Error).message ?? "error";
    if (/UNAVAILABLE|NOT_FOUND|RULE_VIOLATION/.test(msg)) return err(409, "CONFLICT", msg);
    return err(500, "INTERNAL", "Something went wrong");
  }

  return err(404, "NOT_FOUND", "Route not found");
});
