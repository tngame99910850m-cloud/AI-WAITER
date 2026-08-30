import { randomUUID } from 'node:crypto';
import { store } from '../data/store.js';
import { logger } from '../logger.js';
import { persistence, persistBestEffort } from '../db/txnRepo.js';

/** Append an audit-log entry for a tenant. Used for orders, status, admin ops. */
export function audit(
  restaurantId: string,
  actor: string,
  action: string,
  target?: string,
  meta?: Record<string, unknown>,
): void {
  if (!store.hasTenant(restaurantId)) return;
  const entry = {
    id: randomUUID(),
    restaurantId,
    actor,
    action,
    target,
    at: new Date().toISOString(),
    meta,
  };
  store.tenant(restaurantId).auditLog.push(entry);
  persistBestEffort(() => persistence().saveAudit(entry));
  logger.info({ audit: { restaurantId, actor, action, target } }, 'audit');
}
