import { Router } from 'express';
import {
  chatRequestSchema,
  createOrderRequestSchema,
  createServiceRequestSchema,
  analyticsEventSchema,
} from '@ai-waiter/shared';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { asyncHandler, param, requireTenant, validateBody } from '../middleware/index.js';
import { store } from '../data/store.js';
import { getPosAdapter } from '../pos/registry.js';
import { runChat } from '../ai/orchestrator.js';
import { createOrder, getOrder } from '../services/orderService.js';
import { createServiceRequest } from '../services/serviceRequestService.js';
import { recordEvent } from '../services/analyticsService.js';

/** Customer-facing API used by the mobile app. */
export function publicRouter(): Router {
  const r = Router();

  // --- Restaurants ------------------------------------------------------
  r.get(
    '/restaurants',
    asyncHandler(async (_req, res) => {
      const list = store.listRestaurants().map((rest) => ({
        id: rest.id,
        name: rest.name,
        currency: rest.currency,
        branding: rest.branding,
      }));
      res.json({ restaurants: list });
    }),
  );

  r.get(
    '/restaurants/:restaurantId',
    requireTenant,
    asyncHandler(async (req, res) => {
      const t = store.tenant(param(req, "restaurantId"));
      res.json({
        restaurant: {
          id: t.restaurant.id,
          name: t.restaurant.name,
          currency: t.restaurant.currency,
          taxRateBps: t.restaurant.taxRateBps,
          branding: t.restaurant.branding,
          policies: t.restaurant.policies,
        },
        tables: [...t.tables.values()].filter((tab) => tab.active),
      });
    }),
  );

  r.get(
    '/restaurants/:restaurantId/menu',
    requireTenant,
    asyncHandler(async (req, res) => {
      const menu = await getPosAdapter().getMenu({ restaurantId: param(req, "restaurantId") });
      res.json({ menu });
    }),
  );

  r.get(
    '/restaurants/:restaurantId/products/:productId',
    requireTenant,
    asyncHandler(async (req, res) => {
      const product = await getPosAdapter().getProduct(
        { restaurantId: param(req, "restaurantId") },
        param(req, "productId"),
      );
      if (!product) throw AppError.notFound('Product not found');
      res.json({ product });
    }),
  );

  // --- AI chat ----------------------------------------------------------
  r.post(
    '/chat',
    validateBody(chatRequestSchema),
    requireTenant,
    asyncHandler(async (req, res) => {
      const body = req.body as import('@ai-waiter/shared').ChatRequest;
      const t = store.tenant(body.restaurantId);
      const result = await runChat(
        { menu: t.menu, restaurant: t.restaurant, upsellRules: t.upsellRules },
        { message: body.message, history: body.history, cartProductIds: body.cartProductIds },
      );
      res.json({ result });
    }),
  );

  // --- Orders (idempotent) ---------------------------------------------
  r.post(
    '/orders',
    validateBody(createOrderRequestSchema),
    requireTenant,
    asyncHandler(async (req, res) => {
      const idempotencyKey =
        req.header('idempotency-key')?.slice(0, 128) || randomUUID();
      const { order, deduplicated } = await createOrder(req.body, idempotencyKey);
      res.status(deduplicated ? 200 : 201).json({ order, deduplicated });
    }),
  );

  r.get(
    '/restaurants/:restaurantId/orders/:orderId',
    requireTenant,
    asyncHandler(async (req, res) => {
      const order = await getOrder(param(req, "restaurantId"), param(req, "orderId"));
      if (!order) throw AppError.notFound('Order not found');
      res.json({ order });
    }),
  );

  // --- Service requests -------------------------------------------------
  r.post(
    '/service-requests',
    validateBody(createServiceRequestSchema),
    requireTenant,
    asyncHandler(async (req, res) => {
      const request = createServiceRequest(req.body);
      res.status(201).json({ request });
    }),
  );

  // --- Analytics --------------------------------------------------------
  r.post(
    '/analytics',
    validateBody(analyticsEventSchema),
    requireTenant,
    asyncHandler(async (req, res) => {
      recordEvent(req.body);
      res.status(202).json({ ok: true });
    }),
  );

  return r;
}
