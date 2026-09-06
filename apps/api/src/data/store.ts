import type {
  AnalyticsEvent,
  Menu,
  Order,
  Restaurant,
  ServiceRequest,
  Table,
  UpsellRule,
} from '@ai-waiter/shared';

/**
 * In-memory data store — the reference persistence layer. In production this is
 * replaced by Postgres (see db/migrations/0001_init.sql) behind the same
 * repository shape. Everything is keyed by restaurantId to enforce tenant
 * isolation: no query ever crosses tenants without an explicit restaurantId.
 */
export interface AuditLogEntry {
  id: string;
  restaurantId: string;
  actor: string;
  action: string;
  target?: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface TenantData {
  restaurant: Restaurant;
  tables: Map<string, Table>;
  menu: Menu;
  upsellRules: UpsellRule[];
  orders: Map<string, Order>;
  /** idempotencyKey -> orderId, so retries don't create duplicates. */
  idempotency: Map<string, string>;
  serviceRequests: Map<string, ServiceRequest>;
  analytics: AnalyticsEvent[];
  auditLog: AuditLogEntry[];
  /** Monotonic per-tenant order sequence for human-facing numbers. */
  orderSeq: number;
}

export class DataStore {
  private tenants = new Map<string, TenantData>();

  reset(): void {
    this.tenants.clear();
  }

  createTenant(input: {
    restaurant: Restaurant;
    tables: Table[];
    menu: Menu;
    upsellRules?: UpsellRule[];
  }): void {
    this.tenants.set(input.restaurant.id, {
      restaurant: input.restaurant,
      tables: new Map(input.tables.map((t) => [t.id, t])),
      menu: input.menu,
      upsellRules: input.upsellRules ?? [],
      orders: new Map(),
      idempotency: new Map(),
      serviceRequests: new Map(),
      analytics: [],
      auditLog: [],
      orderSeq: 1000,
    });
  }

  hasTenant(restaurantId: string): boolean {
    return this.tenants.has(restaurantId);
  }

  /** Throws if the tenant does not exist — callers rely on this for isolation. */
  tenant(restaurantId: string): TenantData {
    const t = this.tenants.get(restaurantId);
    if (!t) throw new Error(`Unknown restaurant: ${restaurantId}`);
    return t;
  }

  listRestaurants(): Restaurant[] {
    return [...this.tenants.values()].map((t) => t.restaurant);
  }
}

/** Process-wide singleton store. */
export const store = new DataStore();
