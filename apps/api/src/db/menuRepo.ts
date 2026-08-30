import type {
  AnalyticsEvent,
  CartItem,
  Menu,
  Modifier,
  ModifierGroup,
  Order,
  Product,
  Restaurant,
  ServiceRequest,
  Table,
  UpsellRule,
} from '@ai-waiter/shared';
import { getPool } from './pool.js';
import { store, type AuditLogEntry } from '../data/store.js';
import { logger } from '../logger.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

const money = (amount: number, currency: string) => ({ amount, currency });
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/**
 * Load every tenant (restaurant, tables, menu, upsell rules) plus their existing
 * transactional data (orders, service requests, analytics, audit) from Postgres
 * into the in-memory store. The store acts as a fast read projection; writes are
 * mirrored back to Postgres via {@link txnRepo}.
 */
export async function loadTenantsIntoStore(): Promise<number> {
  const pool = getPool();
  store.reset();

  const [
    restaurants,
    tables,
    categories,
    products,
    sizes,
    groups,
    modifiers,
    ingredients,
    allergens,
    promotions,
    upsells,
    orders,
    orderItems,
    orderItemMods,
    serviceRequests,
    analytics,
    audit,
  ] = await Promise.all([
    pool.query('select * from restaurants order by id'),
    pool.query('select * from tables'),
    pool.query('select * from categories'),
    pool.query('select * from products'),
    pool.query('select * from product_sizes'),
    pool.query('select * from modifier_groups order by sort_order'),
    pool.query('select * from modifiers'),
    pool.query('select * from ingredients'),
    pool.query('select * from allergens'),
    pool.query('select * from promotions'),
    pool.query('select * from upsell_rules order by priority desc'),
    pool.query('select * from orders order by created_at'),
    pool.query('select * from order_items'),
    pool.query('select * from order_item_modifiers'),
    pool.query('select * from service_requests order by created_at'),
    pool.query('select * from analytics_events order by received_at'),
    pool.query('select * from audit_log order by created_at'),
  ]);

  const by = <T extends Record<string, any>>(rows: T[], key: string) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const k = row[key];
      (map.get(k) ?? map.set(k, []).get(k)!).push(row);
    }
    return map;
  };

  const tablesByR = by(tables.rows, 'restaurant_id');
  const catsByR = by(categories.rows, 'restaurant_id');
  const prodsByR = by(products.rows, 'restaurant_id');
  const ingByR = by(ingredients.rows, 'restaurant_id');
  const algByR = by(allergens.rows, 'restaurant_id');
  const promoByR = by(promotions.rows, 'restaurant_id');
  const upsByR = by(upsells.rows, 'restaurant_id');

  // Modifiers/sizes/groups keyed by restaurant+product.
  const key = (r: string, p: string) => `${r}::${p}`;
  const sizesByRP = by(sizes.rows.map((s) => ({ ...s, _k: key(s.restaurant_id, s.product_id) })), '_k');
  const groupsByRP = by(groups.rows.map((g) => ({ ...g, _k: key(g.restaurant_id, g.product_id) })), '_k');
  const modsByRPG = new Map<string, any[]>();
  for (const m of modifiers.rows) {
    const k = `${m.restaurant_id}::${m.product_id}::${m.group_id}`;
    (modsByRPG.get(k) ?? modsByRPG.set(k, []).get(k)!).push(m);
  }

  for (const r of restaurants.rows) {
    const restaurant: Restaurant = {
      id: r.id,
      name: r.name,
      currency: r.currency,
      timezone: r.timezone,
      taxRateBps: r.tax_rate_bps,
      branding: r.branding,
      aiConfig: r.ai_config,
      openingHours: [],
      policies: r.policies ?? '',
    };

    const restaurantTables: Table[] = (tablesByR.get(r.id) ?? []).map((t) => ({
      id: t.id,
      restaurantId: t.restaurant_id,
      number: t.number,
      active: t.active,
    }));

    const rProducts: Product[] = (prodsByR.get(r.id) ?? []).map((p) => {
      const pGroups: ModifierGroup[] = (groupsByRP.get(key(r.id, p.id)) ?? []).map((g) => {
        const mods: Modifier[] = (modsByRPG.get(`${r.id}::${p.id}::${g.id}`) ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          priceDelta: money(m.delta_amount_minor, r.currency),
          available: m.available,
          addsIngredientIds: m.adds_ingredient_ids ?? [],
          removesIngredientIds: m.removes_ingredient_ids ?? [],
        }));
        return {
          id: g.id,
          name: g.name,
          minSelect: g.min_select,
          maxSelect: g.max_select,
          modifiers: mods,
        };
      });
      const pSizes = (sizesByRP.get(key(r.id, p.id)) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        priceDelta: money(s.delta_amount_minor, r.currency),
      }));
      return {
        id: p.id,
        categoryId: p.category_id,
        name: p.name,
        description: p.description ?? '',
        basePrice: money(p.base_amount_minor, r.currency),
        imageUrl: p.image_url,
        available: p.available,
        rating: p.rating == null ? null : Number(p.rating),
        dietaryTags: p.dietary_tags ?? [],
        allergenIds: p.allergen_ids ?? [],
        ingredientIds: p.ingredient_ids ?? [],
        sizes: pSizes,
        modifierGroups: pGroups,
        popularityScore: p.popularity_score ?? 0,
      };
    });

    const menu: Menu = {
      restaurantId: r.id,
      currency: r.currency,
      updatedAt: iso(r.updated_at),
      categories: (catsByR.get(r.id) ?? [])
        .map((c) => ({ id: c.id, name: c.name, description: c.description ?? '', sortOrder: c.sort_order }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      products: rProducts,
      modifierGroups: [],
      ingredients: (ingByR.get(r.id) ?? []).map((i) => ({ id: i.id, name: i.name, allergenIds: i.allergen_ids ?? [] })),
      allergens: (algByR.get(r.id) ?? []).map((a) => ({ id: a.id, key: a.key, label: a.label })),
      promotions: (promoByR.get(r.id) ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description ?? '',
        productIds: p.product_ids ?? [],
        active: p.active,
      })),
    };

    const rules: UpsellRule[] = (upsByR.get(r.id) ?? []).map((u) => ({
      id: u.id,
      whenProductIds: u.when_product_ids ?? [],
      whenCategoryIds: u.when_category_ids ?? [],
      suggestProductId: u.suggest_product_id,
      suggestModifierId: u.suggest_modifier_id,
      message: u.message,
      priority: u.priority,
    }));

    store.createTenant({ restaurant, tables: restaurantTables, menu, upsellRules: rules });
  }

  // Hydrate transactional data into each tenant's projection.
  hydrateOrders(orders.rows, orderItems.rows, orderItemMods.rows);
  for (const s of serviceRequests.rows) {
    if (!store.hasTenant(s.restaurant_id)) continue;
    const req: ServiceRequest = {
      id: s.id,
      restaurantId: s.restaurant_id,
      tableId: s.table_id,
      type: s.type,
      note: s.note ?? '',
      status: s.status,
      createdAt: iso(s.created_at),
    };
    store.tenant(s.restaurant_id).serviceRequests.set(req.id, req);
  }
  for (const e of analytics.rows) {
    if (!store.hasTenant(e.restaurant_id)) continue;
    const ev: AnalyticsEvent = {
      name: e.name,
      restaurantId: e.restaurant_id,
      tableId: e.table_id,
      properties: e.properties ?? {},
      clientTimestamp: e.client_ts ? iso(e.client_ts) : null,
    };
    store.tenant(e.restaurant_id).analytics.push(ev);
  }
  for (const a of audit.rows) {
    if (!store.hasTenant(a.restaurant_id)) continue;
    const entry: AuditLogEntry = {
      id: a.id,
      restaurantId: a.restaurant_id,
      actor: a.actor,
      action: a.action,
      target: a.target,
      at: iso(a.created_at),
      meta: a.meta ?? {},
    };
    store.tenant(a.restaurant_id).auditLog.push(entry);
  }

  logger.info({ tenants: restaurants.rowCount }, 'Loaded tenants from Postgres');
  return restaurants.rowCount ?? 0;
}

function hydrateOrders(orderRows: any[], itemRows: any[], modRows: any[]): void {
  const itemsByOrder = new Map<string, any[]>();
  for (const it of itemRows) {
    (itemsByOrder.get(it.order_id) ?? itemsByOrder.set(it.order_id, []).get(it.order_id)!).push(it);
  }
  const modsByItem = new Map<string, any[]>();
  for (const m of modRows) {
    (modsByItem.get(m.order_item_id) ?? modsByItem.set(m.order_item_id, []).get(m.order_item_id)!).push(m);
  }

  const maxSeqByR = new Map<string, number>();
  for (const o of orderRows) {
    if (!store.hasTenant(o.restaurant_id)) continue;
    const cur = o.currency;
    const items: CartItem[] = (itemsByOrder.get(o.id) ?? []).map((it) => ({
      lineId: it.line_id,
      productId: it.product_id,
      name: it.name,
      quantity: it.quantity,
      sizeId: it.size_id,
      sizeName: it.size_name,
      unitBasePrice: money(it.unit_amount_minor, cur),
      modifiers: (modsByItem.get(it.id) ?? []).map((m) => ({
        modifierGroupId: m.modifier_group_id,
        modifierId: m.modifier_id,
        name: m.name,
        priceDelta: money(m.delta_amount_minor, cur),
      })),
      notes: it.notes ?? '',
      unitPrice: money(it.unit_amount_minor, cur),
      lineTotal: money(it.line_total_minor, cur),
    }));
    const order: Order = {
      id: o.id,
      restaurantId: o.restaurant_id,
      tableId: o.table_id,
      status: o.status,
      items,
      totals: {
        subtotal: money(o.subtotal_minor, cur),
        tax: money(o.tax_minor, cur),
        discount: money(o.discount_minor, cur),
        total: money(o.total_minor, cur),
      },
      idempotencyKey: o.idempotency_key,
      displayNumber: o.display_number,
      createdAt: iso(o.created_at),
      updatedAt: iso(o.updated_at),
    };
    const t = store.tenant(o.restaurant_id);
    t.orders.set(order.id, order);
    t.idempotency.set(order.idempotencyKey, order.id);
    const seq = Number(order.displayNumber);
    if (!Number.isNaN(seq)) maxSeqByR.set(o.restaurant_id, Math.max(maxSeqByR.get(o.restaurant_id) ?? 1000, seq));
  }
  for (const [rid, seq] of maxSeqByR) store.tenant(rid).orderSeq = seq;
}
