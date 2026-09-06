import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { PosError } from '@ai-waiter/shared';
import { PricingError } from '@ai-waiter/shared';
import { logger } from './logger.js';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL';

/** Application error with an HTTP status and a stable, client-safe code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(msg: string, detail?: unknown) {
    return new AppError(400, 'BAD_REQUEST', msg, detail);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(401, 'UNAUTHORIZED', msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(403, 'FORBIDDEN', msg);
  }
  static notFound(msg = 'Not found') {
    return new AppError(404, 'NOT_FOUND', msg);
  }
  static conflict(msg: string, detail?: unknown) {
    return new AppError(409, 'CONFLICT', msg, detail);
  }
}

function mapPosCode(code: PosError['code']): { status: number; appCode: ErrorCode } {
  switch (code) {
    case 'ORDER_NOT_FOUND':
      return { status: 404, appCode: 'NOT_FOUND' };
    case 'PRODUCT_UNAVAILABLE':
    case 'MODIFIER_UNAVAILABLE':
    case 'ORDER_REJECTED':
      return { status: 409, appCode: 'CONFLICT' };
    case 'MENU_UNAVAILABLE':
    case 'POS_UNAVAILABLE':
      return { status: 503, appCode: 'UPSTREAM_UNAVAILABLE' };
    default:
      return { status: 500, appCode: 'INTERNAL' };
  }
}

/** Express error handler. Always returns a structured, non-leaky error body. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = (req as { requestId?: string }).requestId;

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, detail: err.detail, requestId },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        detail: err.issues.map((i) => ({ path: i.path, message: i.message })),
        requestId,
      },
    });
    return;
  }

  if (err instanceof PricingError) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: err.message, detail: { pricing: err.code, ...err.detail }, requestId },
    });
    return;
  }

  if (err instanceof PosError) {
    const { status, appCode } = mapPosCode(err.code);
    res.status(status).json({
      error: { code: appCode, message: err.message, detail: { pos: err.code }, requestId },
    });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong', requestId },
  });
}
