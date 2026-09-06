import { Router } from 'express';
import { z } from 'zod';
import { orderStatusSchema, serviceRequestStatusSchema } from '@ai-waiter/shared';
import { AppError } from '../errors.js';
import { asyncHandler, param, requireTenant, validateBody } from '../middleware/index.js';
import { store } from '../data/store.js';
import { listOrders, updateOrderStatus } from '../services/orderService.js';
import {
  listServiceRequests,
  updateServiceRequestStatus,
} from '../services/serviceRequestService.js';
import { summarize } from '../services/analyticsService.js';

/** Restaurant-operator API (admin dashboard backend). Requires x-admin-key. */
export function adminRouter(): Router {
  const r = Router({ mergeParams: true });

  // Tenant list for the dashboard's restaurant switcher (admin-scoped).
  r.get(
    '/restaurants',
    asyncHandler(async (_req, res) => {
      res.json({
        restaurants: store.listRestaurants().map((rest) => ({
          id: rest.id,
          name: rest.name,
          currency: rest.currency,
        })),
      });
    }),
  );

  r.get(
    '/:restaurantId/orders',
    requireTenant,
    asyncHandler(async (req, res) => {
      res.json({ orders: listOrders(param(req, "restaurantId")) });
    }),
  );

  r.patch(
    '/:restaurantId/orders/:orderId',
    requireTenant,
    validateBody(z.object({ status: orderStatusSchema })),
    asyncHandler(async (req, res) => {
      const order = await updateOrderStatus(
        param(req, "restaurantId"),
        param(req, "orderId"),
        req.body.status,
      );
      res.json({ order });
    }),
  );

  r.get(
    '/:restaurantId/service-requests',
    requireTenant,
    asyncHandler(async (req, res) => {
      res.json({ requests: listServiceRequests(param(req, "restaurantId")) });
    }),
  );

  r.patch(
    '/:restaurantId/service-requests/:id',
    requireTenant,
    validateBody(z.object({ status: serviceRequestStatusSchema })),
    asyncHandler(async (req, res) => {
      const updated = await updateServiceRequestStatus(
        param(req, "restaurantId"),
        param(req, "id"),
        req.body.status,
      );
      if (!updated) throw AppError.notFound('Service request not found');
      res.json({ request: updated });
    }),
  );

  r.get(
    '/:restaurantId/analytics',
    requireTenant,
    asyncHandler(async (req, res) => {
      res.json({ analytics: summarize(param(req, "restaurantId")) });
    }),
  );

  r.get(
    '/:restaurantId/audit',
    requireTenant,
    asyncHandler(async (req, res) => {
      res.json({ auditLog: store.tenant(param(req, "restaurantId")).auditLog.slice(-200) });
    }),
  );

  return r;
}
