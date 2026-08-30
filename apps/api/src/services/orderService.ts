import type { CreateOrderRequest, Order, OrderStatus } from '@ai-waiter/shared';
import { getPosAdapter } from '../pos/registry.js';
import { store } from '../data/store.js';
import { audit } from './auditService.js';

/**
 * Order service. Delegates persistence to the POS adapter and enforces
 * idempotency at the API boundary so a double-tap on "Confirm" can never create
 * two orders.
 */
export async function createOrder(
  input: CreateOrderRequest,
  idempotencyKey: string,
): Promise<{ order: Order; deduplicated: boolean }> {
  const pos = getPosAdapter();
  const t = store.tenant(input.restaurantId);
  const before = t.idempotency.get(idempotencyKey);
  const order = await pos.createOrder(
    { restaurantId: input.restaurantId },
    { ...input, idempotencyKey },
  );
  const deduplicated = Boolean(before) && before === order.id;
  if (!deduplicated) {
    audit(input.restaurantId, 'customer', 'order.create', order.id, {
      total: order.totals.total.amount,
      items: order.items.length,
    });
  }
  return { order, deduplicated };
}

export async function getOrder(
  restaurantId: string,
  orderId: string,
): Promise<Order | null> {
  return getPosAdapter().getOrderStatus({ restaurantId }, orderId);
}

export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: OrderStatus,
  actor = 'admin',
): Promise<Order> {
  const order = await getPosAdapter().updateOrder({ restaurantId }, orderId, { status });
  audit(restaurantId, actor, 'order.status', orderId, { status });
  return order;
}

export function listOrders(restaurantId: string): Order[] {
  return [...store.tenant(restaurantId).orders.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
