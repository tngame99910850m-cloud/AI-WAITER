import {
  computeTotals,
  priceCart,
  PosError,
  type Menu,
  type Order,
  type OrderStatus,
  type Product,
  type PosAdapter,
  type PosContext,
  type PosCreateOrderInput,
} from '@ai-waiter/shared';
import { store } from '../data/store.js';

/**
 * Reference POS adapter backed by the in-memory store. It is the contract other
 * adapters (Foodics/Toast/Square/ERP) must satisfy. All order creation is
 * idempotent: the same idempotencyKey always yields the same order.
 */
export class InMemoryPosAdapter implements PosAdapter {
  readonly name = 'memory';

  async getMenu(ctx: PosContext): Promise<Menu> {
    const t = this.tenantOrThrow(ctx.restaurantId);
    return t.menu;
  }

  async getProduct(ctx: PosContext, productId: string): Promise<Product | null> {
    const t = this.tenantOrThrow(ctx.restaurantId);
    return t.menu.products.find((p) => p.id === productId) ?? null;
  }

  async createOrder(ctx: PosContext, input: PosCreateOrderInput): Promise<Order> {
    const t = this.tenantOrThrow(ctx.restaurantId);

    // Idempotency: return the existing order for a repeated key.
    const existingId = t.idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = t.orders.get(existingId);
      if (existing) return existing;
    }

    // Authoritative pricing from the menu — never trust client prices.
    const { items, totals } = priceCart(
      t.menu,
      input.items.map((i) => ({
        lineId: i.lineId,
        productId: i.productId,
        quantity: i.quantity,
        sizeId: i.sizeId,
        modifierIds: i.modifierIds,
        notes: i.notes,
      })),
      t.restaurant.taxRateBps,
    );

    const now = new Date().toISOString();
    const seq = ++t.orderSeq;
    const order: Order = {
      id: `ord_${ctx.restaurantId}_${seq}`,
      restaurantId: ctx.restaurantId,
      tableId: input.tableId ?? null,
      status: 'received',
      items,
      totals,
      idempotencyKey: input.idempotencyKey,
      displayNumber: String(seq),
      createdAt: now,
      updatedAt: now,
    };

    t.orders.set(order.id, order);
    t.idempotency.set(input.idempotencyKey, order.id);
    return order;
  }

  async updateOrder(
    ctx: PosContext,
    orderId: string,
    patch: { status?: OrderStatus },
  ): Promise<Order> {
    const t = this.tenantOrThrow(ctx.restaurantId);
    const order = t.orders.get(orderId);
    if (!order) throw new PosError('Order not found', 'ORDER_NOT_FOUND');
    const updated: Order = {
      ...order,
      status: patch.status ?? order.status,
      updatedAt: new Date().toISOString(),
    };
    t.orders.set(orderId, updated);
    return updated;
  }

  async cancelOrder(ctx: PosContext, orderId: string): Promise<Order> {
    return this.updateOrder(ctx, orderId, { status: 'cancelled' });
  }

  async getOrderStatus(ctx: PosContext, orderId: string): Promise<Order | null> {
    const t = this.tenantOrThrow(ctx.restaurantId);
    return t.orders.get(orderId) ?? null;
  }

  private tenantOrThrow(restaurantId: string) {
    if (!store.hasTenant(restaurantId)) {
      throw new PosError('Menu unavailable', 'MENU_UNAVAILABLE');
    }
    return store.tenant(restaurantId);
  }

  /** Not part of the adapter contract; used by totals recompute in tests. */
  recomputeTotals(order: Order, taxRateBps: number) {
    return computeTotals(order.items, order.totals.subtotal.currency, taxRateBps);
  }
}
