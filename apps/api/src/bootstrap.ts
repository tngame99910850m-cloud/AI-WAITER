import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { seed } from './data/seed.js';
import { pingDb } from './db/pool.js';
import { loadTenantsIntoStore } from './db/menuRepo.js';

/**
 * Initialize the data layer. In `postgres` mode we load all tenants from the
 * database into the in-memory read projection; writes are mirrored back via the
 * persistence port. In `memory` mode we seed the reference demo tenants.
 *
 * If Postgres is configured but unreachable, we fall back to in-memory seed data
 * (so local dev keeps working) unless DB_REQUIRED=true, which fails fast.
 */
export async function bootstrapData(): Promise<{ mode: 'postgres' | 'memory' }> {
  const cfg = loadConfig();
  if (cfg.PERSISTENCE === 'postgres') {
    try {
      await pingDb();
      const count = await loadTenantsIntoStore();
      logger.info({ tenants: count }, 'Postgres persistence active');
      return { mode: 'postgres' };
    } catch (err) {
      if (cfg.DB_REQUIRED) {
        logger.error({ err }, 'Postgres required but unavailable — aborting');
        throw err;
      }
      logger.warn({ err }, 'Postgres unavailable — falling back to in-memory seed data');
    }
  }
  seed();
  return { mode: 'memory' };
}
