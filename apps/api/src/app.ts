import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
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
import { logger } from './logger.js';

/**
 * Locate the admin dashboard's static directory across runtimes:
 *  - ESM (compiled dist): `import.meta.url` is defined.
 *  - Bundled CJS / serverless: `import.meta.url` is undefined, so fall back to
 *    `__dirname`, then to a couple of cwd-relative candidates.
 * Returns null (rather than throwing) if it can't be found, so the API still
 * boots — the `/admin` static mount is simply skipped in that environment.
 */
function resolveAdminDir(): string | null {
  const candidates: string[] = [];
  try {
    const metaUrl = (import.meta as { url?: string }).url;
    if (metaUrl) candidates.push(path.resolve(path.dirname(fileURLToPath(metaUrl)), '../../admin/public'));
  } catch {
    /* import.meta not available in this runtime */
  }
  const dn = (globalThis as { __dirname?: string }).__dirname;
  if (dn) candidates.push(path.resolve(dn, '../../admin/public'));
  candidates.push(path.resolve(process.cwd(), 'apps/admin/public'));
  candidates.push(path.resolve(process.cwd(), 'admin/public'));

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch {
      /* ignore and try next */
    }
  }
  logger.warn('Admin dashboard static directory not found; /admin will not be served here');
  return null;
}

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

  // Admin dashboard (static SPA). Served with a route-scoped CSP that permits
  // its inline assets. The page collects the admin key at runtime and sends it
  // as x-admin-key to the admin API below — no secret is baked into the page.
  //
  // Resolve the directory defensively so the app works whether it runs as ESM
  // (import.meta.url), as a bundled CJS function (__dirname), or a serverless
  // build where neither is reliable — never let this crash app construction.
  const adminDir = resolveAdminDir();
  if (adminDir) {
    app.use(
      '/admin',
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
          },
        },
      }),
      express.static(adminDir),
    );
  }

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
