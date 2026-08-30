import type { AnalyticsEvent, Order, OrderStatus, ServiceRequest } from '@ai-waiter/shared';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';
import { getPool } from './pool.js';
import type { AuditLogEntry } from '../data/store.js';

/**
 * Persistence port for transactional writes. The in-memory store is the read
 * projection; these methods mirror each write to the durable backend. The Noop
 * implementation is used in `memory` mode (the store already holds everything).
 */
export interface Persistence {
  readonly name: string;
  saveOrder(order: Order): Promise<void>;
  updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus, updatedAt: string): Promise<void>;
  saveServiceRequest(req: ServiceRequest): Promise<void>;
  updateServiceRequestStatus(restaurantId: string, id: string, status: string): Promise<void>;
  saveAnalytics(event: AnalyticsEvent, receivedAt: string): Promise<void>;
  saveAudit(entry: AuditLogEntry): Promise<void>;
}

class NoopPersistence implements Persistence {
  readonly name = 'noop';
  async saveOrder() {}
  async updateOrderStatus() {}
  async saveServiceRequest() {}
  async updateServiceRequestStatus() {}
  async saveAnalytics() {}
  async saveAudit() {}
}

class PgPersistence implements Persistence {
  readonly name = 'postgres';

  async saveOrder(order: Order): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into orders (id,restaurant_id,table_id,status,display_number,idempotency_key,
           subtotal_minor,tax_minor,discount_minor,total_minor,currency,created_at,updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         on conflict (id) do nothing`,
        [
          order.id, order.restaurantId, order.tableId, order.status, order.displayNumber,
          order.idempotencyKey, order.totals.subtotal.amount, order.totals.tax.amount,
          order.totals.discount.amount, order.totals.total.amount, order.totals.total.currency,
          order.createdAt, order.updatedAt,
        ],
      );
      for (const item of order.items) {
        const res = await client.query<{ id: string }>(
          `insert into order_items (order_id,restaurant_id,line_id,product_id,name,quantity,
             size_id,size_name,unit_amount_minor,line_total_minor,notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
          [
            order.id, order.restaurantId, item.lineId, item.productId, item.name, item.quantity,
            item.sizeId, item.sizeName, item.unitPrice.amount, item.lineTotal.amount, item.notes,
          ],
        );
        const orderItemId = res.rows[0]!.id;
        for (const m of item.modifiers) {
          await client.query(
            `insert into order_item_modifiers (order_item_id,modifier_group_id,modifier_id,name,delta_amount_minor)
             values ($1,$2,$3,$4,$5)`,
            [orderItemId, m.modifierGroupId, m.modifierId, m.name, m.priceDelta.amount],
          );
        }
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus, updatedAt: string): Promise<void> {
    await getPool().query(
      'update orders set status=$3, updated_at=$4 where restaurant_id=$1 and id=$2',
      [restaurantId, orderId, status, updatedAt],
    );
  }

  async saveServiceRequest(req: ServiceRequest): Promise<void> {
    await getPool().query(
      `insert into service_requests (id,restaurant_id,table_id,type,note,status,created_at)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
      [req.id, req.restaurantId, req.tableId, req.type, req.note, req.status, req.createdAt],
    );
  }

  async updateServiceRequestStatus(restaurantId: string, id: string, status: string): Promise<void> {
    await getPool().query(
      'update service_requests set status=$3 where restaurant_id=$1 and id=$2',
      [restaurantId, id, status],
    );
  }

  async saveAnalytics(event: AnalyticsEvent, receivedAt: string): Promise<void> {
    await getPool().query(
      `insert into analytics_events (restaurant_id,table_id,name,properties,client_ts,received_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [event.restaurantId, event.tableId, event.name, event.properties, event.clientTimestamp, receivedAt],
    );
  }

  async saveAudit(entry: AuditLogEntry): Promise<void> {
    await getPool().query(
      `insert into audit_log (id,restaurant_id,actor,action,target,meta,created_at)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
      [entry.id, entry.restaurantId, entry.actor, entry.action, entry.target ?? null, entry.meta ?? {}, entry.at],
    );
  }
}

let instance: Persistence | null = null;

export function persistence(): Persistence {
  if (instance) return instance;
  const cfg = loadConfig();
  instance = cfg.PERSISTENCE === 'postgres' ? new PgPersistence() : new NoopPersistence();
  return instance;
}

export function __setPersistence(p: Persistence | null): void {
  instance = p;
}

/** Fire-and-forget helper for append-only writes (analytics, audit). */
export function persistBestEffort(op: () => Promise<void>): void {
  op().catch((err) => logger.warn({ err }, 'best-effort persistence write failed'));
}
