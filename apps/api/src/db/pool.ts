import pg from 'pg';
import { loadConfig } from '../config.js';
import { logger } from '../logger.js';

let pool: pg.Pool | null = null;

/**
 * Lazily create the Postgres connection pool. `search_path` is pinned to the
 * configured schema so unqualified table names resolve to the AI Waiter schema.
 */
export function getPool(): pg.Pool {
  if (pool) return pool;
  const cfg = loadConfig();
  if (!cfg.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when PERSISTENCE=postgres');
  }
  pool = new pg.Pool({
    connectionString: cfg.DATABASE_URL,
    ssl: cfg.DB_SSL ? { rejectUnauthorized: false } : undefined,
    max: 10,
    // Pin the schema for every pooled connection.
    options: `-c search_path=${cfg.DB_SCHEMA},public`,
  });
  pool.on('error', (err) => logger.error({ err }, 'Postgres pool error'));
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Simple connectivity check used at startup. */
export async function pingDb(): Promise<void> {
  const res = await getPool().query('select 1 as ok');
  if (res.rows[0]?.ok !== 1) throw new Error('Unexpected ping result');
}
