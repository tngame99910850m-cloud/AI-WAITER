import type {
  ChatMessage,
  ChatResult,
  Menu,
  Order,
  Product,
  RestaurantDetail,
  RestaurantSummary,
  ServiceRequestType,
  TableInfo,
} from '../types';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? 'dev-client-key';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        ...opts.headers,
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = json?.error ?? {};
      throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? 'Request failed');
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'The request timed out. Check your connection.');
    }
    throw new ApiError(0, 'NETWORK', 'No connection. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  listRestaurants: () =>
    request<{ restaurants: RestaurantSummary[] }>('/v1/restaurants').then((r) => r.restaurants),

  getRestaurant: (id: string) =>
    request<{ restaurant: RestaurantDetail; tables: TableInfo[] }>(`/v1/restaurants/${id}`),

  getMenu: (id: string) => request<{ menu: Menu }>(`/v1/restaurants/${id}/menu`).then((r) => r.menu),

  getProduct: (restaurantId: string, productId: string) =>
    request<{ product: Product }>(`/v1/restaurants/${restaurantId}/products/${productId}`).then(
      (r) => r.product,
    ),

  chat: (input: {
    restaurantId: string;
    tableId?: string | null;
    message: string;
    history: ChatMessage[];
    cartProductIds: string[];
  }) => request<{ result: ChatResult }>('/v1/chat', { method: 'POST', body: input }).then((r) => r.result),

  createOrder: (
    input: {
      restaurantId: string;
      tableId: string | null;
      items: Array<{
        lineId: string;
        productId: string;
        quantity: number;
        sizeId: string | null;
        modifierIds: string[];
        notes: string;
      }>;
    },
    idempotencyKey: string,
  ) =>
    request<{ order: Order; deduplicated: boolean }>('/v1/orders', {
      method: 'POST',
      body: input,
      headers: { 'idempotency-key': idempotencyKey },
    }),

  getOrder: (restaurantId: string, orderId: string) =>
    request<{ order: Order }>(`/v1/restaurants/${restaurantId}/orders/${orderId}`).then((r) => r.order),

  createServiceRequest: (input: {
    restaurantId: string;
    tableId: string | null;
    type: ServiceRequestType;
    note?: string;
  }) => request<{ request: unknown }>('/v1/service-requests', { method: 'POST', body: input }),

  track: (input: {
    restaurantId: string;
    tableId?: string | null;
    name: string;
    properties?: Record<string, string | number | boolean>;
  }) =>
    request('/v1/analytics', {
      method: 'POST',
      body: { ...input, clientTimestamp: new Date().toISOString() },
    }).catch(() => undefined), // analytics must never break the UX
};
