import type { Menu, Product } from './menu.js';
import type { Order, OrderStatus, CreateOrderRequest } from './order.js';

/**
 * POSAdapter is the abstraction seam between the AI Waiter platform and any
 * restaurant POS / KDS / menu-management system. Concrete adapters (in-memory,
 * Foodics, Toast, Square, a bespoke ERP, …) implement this contract so the rest
 * of the platform never hard-codes a specific integration.
 */
export interface PosContext {
  restaurantId: string;
}

export interface PosCreateOrderInput extends CreateOrderRequest {
  /** Idempotency key — the adapter MUST NOT create a duplicate for the same key. */
  idempotencyKey: string;
}

export interface PosAdapter {
  readonly name: string;

  getMenu(ctx: PosContext): Promise<Menu>;

  getProduct(ctx: PosContext, productId: string): Promise<Product | null>;

  createOrder(ctx: PosContext, input: PosCreateOrderInput): Promise<Order>;

  updateOrder(
    ctx: PosContext,
    orderId: string,
    patch: { status?: OrderStatus },
  ): Promise<Order>;

  cancelOrder(ctx: PosContext, orderId: string): Promise<Order>;

  getOrderStatus(ctx: PosContext, orderId: string): Promise<Order | null>;
}

/** Raised by adapters for well-known, client-safe failure modes. */
export class PosError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MENU_UNAVAILABLE'
      | 'PRODUCT_UNAVAILABLE'
      | 'MODIFIER_UNAVAILABLE'
      | 'ORDER_NOT_FOUND'
      | 'POS_UNAVAILABLE'
      | 'ORDER_REJECTED',
  ) {
    super(message);
    this.name = 'PosError';
  }
}
