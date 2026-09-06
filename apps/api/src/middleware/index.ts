import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z, type ZodTypeAny } from 'zod';
import { AppError } from '../errors.js';
import { clientApiKeys, loadConfig, type Config } from '../config.js';
import { store } from '../data/store.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: { kind: 'client' | 'admin' };
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.header('x-request-id') || randomUUID()).slice(0, 64);
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

/** Requires a valid client API key. Keys live only on the server. */
export function requireClientAuth(cfg: Config) {
  const keys = clientApiKeys(cfg);
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.header('x-api-key');
    if (!key || !keys.has(key)) {
      return next(AppError.unauthorized('Missing or invalid API key'));
    }
    req.auth = { kind: 'client' };
    next();
  };
}

/** Requires the admin key for restaurant-operator endpoints. */
export function requireAdminAuth(cfg: Config) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.header('x-admin-key');
    if (!key || key !== cfg.ADMIN_API_KEY) {
      return next(AppError.forbidden('Admin access required'));
    }
    req.auth = { kind: 'admin' };
    next();
  };
}

/**
 * Tenant guard: ensures the restaurantId in params/body exists. Enforces that
 * every request is scoped to a real tenant (isolation boundary).
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
  const restaurantId =
    (req.params.restaurantId as string | undefined) ??
    (req.body?.restaurantId as string | undefined);
  if (!restaurantId || !store.hasTenant(restaurantId)) {
    return next(AppError.notFound('Restaurant not found'));
  }
  next();
}

/** Simple in-memory fixed-window rate limiter keyed by api key + ip. */
export function rateLimit(cfg: Config) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.header('x-api-key') ?? 'anon'}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + cfg.RATE_LIMIT_WINDOW_MS });
    } else {
      entry.count += 1;
      if (entry.count > cfg.RATE_LIMIT_MAX) {
        res.setHeader('retry-after', Math.ceil((entry.resetAt - now) / 1000));
        return next(new AppError(429, 'RATE_LIMITED', 'Too many requests'));
      }
    }
    next();
  };
}

/** Validate and coerce req.body with a Zod schema; replaces body on success. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

/** Read a required route param, narrowing away `undefined`. */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (value === undefined) {
    throw AppError.badRequest(`Missing route parameter: ${name}`);
  }
  return value;
}

/** Async route wrapper so thrown errors reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export { loadConfig, z };
