import type { AnalyticsEvent } from '@ai-waiter/shared';
import { store } from '../data/store.js';
import { persistence, persistBestEffort } from '../db/txnRepo.js';

export function recordEvent(event: AnalyticsEvent): void {
  const t = store.tenant(event.restaurantId);
  t.analytics.push(event);
  // Append-only: mirror to the durable backend without blocking the response.
  persistBestEffort(() => persistence().saveAnalytics(event, new Date().toISOString()));
}

export interface AnalyticsSummary {
  totalEvents: number;
  totalOrders: number;
  aiConversations: number;
  averageOrderValue: number;
  currency: string;
  conversionRate: number;
  upsell: { shown: number; accepted: number; rate: number };
  serviceRequests: number;
  topOrderedProductIds: Array<{ productId: string; count: number }>;
}

/** Aggregate the tenant's analytics into the operator dashboard summary. */
export function summarize(restaurantId: string): AnalyticsSummary {
  const t = store.tenant(restaurantId);
  const events = t.analytics;
  const count = (name: string) => events.filter((e) => e.name === name).length;

  const orders = [...t.orders.values()];
  const totalOrderValue = orders.reduce((acc, o) => acc + o.totals.total.amount, 0);
  const averageOrderValue = orders.length ? Math.round(totalOrderValue / orders.length) : 0;

  const chats = count('ai_chat_started');
  const confirmed = orders.length;
  const conversionRate = chats ? confirmed / chats : 0;

  const upsellShown = count('upsell_shown');
  const upsellAccepted = count('upsell_accepted');

  const productCounts = new Map<string, number>();
  for (const o of orders) {
    for (const item of o.items) {
      productCounts.set(item.productId, (productCounts.get(item.productId) ?? 0) + item.quantity);
    }
  }
  const topOrderedProductIds = [...productCounts.entries()]
    .map(([productId, c]) => ({ productId, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalEvents: events.length,
    totalOrders: orders.length,
    aiConversations: chats,
    averageOrderValue,
    currency: t.restaurant.currency,
    conversionRate,
    upsell: {
      shown: upsellShown,
      accepted: upsellAccepted,
      rate: upsellShown ? upsellAccepted / upsellShown : 0,
    },
    serviceRequests: t.serviceRequests.size,
    topOrderedProductIds,
  };
}
