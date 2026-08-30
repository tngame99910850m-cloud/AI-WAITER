import { z } from 'zod';

/**
 * Environment configuration, validated at startup. Secrets (API keys, JWT
 * secrets) are only ever read here on the server — never shipped to the mobile
 * app. The mobile app talks only to this API.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  /** Comma-separated allowed origins for CORS. */
  CORS_ORIGINS: z.string().default('*'),
  /** Static API keys accepted by the client (comma separated). Demo/dev only. */
  CLIENT_API_KEYS: z.string().default('dev-client-key'),
  /** Secret used to sign admin sessions / verify admin tokens. */
  ADMIN_API_KEY: z.string().default('dev-admin-key'),
  /** Which POS adapter to use. `memory` is the built-in reference adapter. */
  POS_ADAPTER: z.enum(['memory']).default('memory'),
  /**
   * Persistence backend. `memory` seeds in-process demo data. `postgres` loads
   * tenants from Postgres at boot and write-through persists orders, service
   * requests, analytics and audit entries.
   */
  PERSISTENCE: z.enum(['memory', 'postgres']).default('memory'),
  /** Postgres connection string (server only — never shipped to the client). */
  DATABASE_URL: z.string().optional(),
  /** Schema the AI Waiter tables live in. */
  DB_SCHEMA: z.string().default('ai_waiter'),
  /** When true, a failed Postgres connection aborts startup instead of falling
   * back to in-memory seed data. */
  DB_REQUIRED: z.coerce.boolean().default(false),
  /** Enable TLS to Postgres (Supabase requires TLS). */
  DB_SSL: z.coerce.boolean().default(true),
  /** LLM provider for the AI orchestrator. `rules` needs no external API. */
  AI_PROVIDER: z.enum(['rules', 'anthropic']).default('rules'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  /** Rate limit: max requests per window per key. */
  RATE_LIMIT_MAX: z.coerce.number().int().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default(
    'info',
  ),
});

export type Config = z.infer<typeof configSchema>;

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    // Fail fast with a clear message.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: clear the cached config so a new env can be picked up. */
export function __resetConfig(): void {
  cached = null;
}

export function clientApiKeys(cfg: Config): Set<string> {
  return new Set(
    cfg.CLIENT_API_KEYS.split(',').map((s) => s.trim()).filter(Boolean),
  );
}

export function corsOrigins(cfg: Config): string[] | '*' {
  const raw = cfg.CORS_ORIGINS.trim();
  if (raw === '*' || raw === '') return '*';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
