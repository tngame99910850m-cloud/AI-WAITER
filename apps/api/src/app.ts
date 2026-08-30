import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadConfig, corsOrigins, type Config } from './config.js';
import {
  rateLimit,
  requestId,
  requireAdminAuth,
  requireClientAuth,
} from './middleware/index.js';
import { errorHandler } from './errors.js';
import { publicRouter } from './routes/publicRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

/** Build the Express app. Pure/testable — no listening side effects. */
export function buildApp(cfg: Config = loadConfig()): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins(cfg),
      allowedHeaders: ['content-type', 'x-api-key', 'x-admin-key', 'idempotency-key', 'x-request-id'],
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(requestId);

  // Liveness/readiness — unauthenticated.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  // Admin API: separate admin key. Mounted before /v1 so admin paths never hit
  // the customer api-key middleware.
  app.use('/v1/admin', rateLimit(cfg), requireAdminAuth(cfg), adminRouter());

  // Customer API: api-key + rate limited.
  app.use('/v1', rateLimit(cfg), requireClientAuth(cfg), publicRouter());

  // Unknown route -> 404 JSON.
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);
  return app;
}
