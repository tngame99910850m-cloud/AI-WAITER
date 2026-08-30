// Vercel serverless entry for the AI Waiter API.
//
// Vercel treats files in /api as serverless functions. This one wraps the same
// Express app used everywhere else, so every route (/health, /v1/*, /admin, …)
// is served by one function. A root vercel.json rewrites all paths here.
//
// The app is built to apps/api/dist by the vercel.json buildCommand; we import
// the compiled output (real .js) to avoid TS path-resolution issues.
import type { IncomingMessage, ServerResponse } from 'node:http';
// @ts-expect-error — resolved from the built output at deploy time.
import { buildApp } from '../apps/api/dist/app.js';
// @ts-expect-error — resolved from the built output at deploy time.
import { bootstrapData } from '../apps/api/dist/bootstrap.js';
// @ts-expect-error — resolved from the built output at deploy time.
import { seed } from '../apps/api/dist/data/seed.js';

const app = buildApp();

// Load tenants once per warm instance (Postgres if configured, else seed).
let ready: Promise<unknown> | null = null;
function ensureData() {
  if (!ready) {
    ready = Promise.resolve()
      .then(() => bootstrapData())
      .catch(() => seed());
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureData();
  return (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
}

export const config = { maxDuration: 30 };
