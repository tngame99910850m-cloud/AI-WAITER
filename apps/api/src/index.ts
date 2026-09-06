import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { bootstrapData } from './bootstrap.js';
import { closePool } from './db/pool.js';

const cfg = loadConfig();

async function main() {
  // Load tenants from Postgres (PERSISTENCE=postgres) or seed in-memory demo data.
  const { mode } = await bootstrapData();

  const app = buildApp(cfg);
  const server = app.listen(cfg.PORT, () => {
    logger.info(
      { port: cfg.PORT, env: cfg.NODE_ENV, pos: cfg.POS_ADAPTER, ai: cfg.AI_PROVIDER, persistence: mode },
      'AI Waiter API listening',
    );
  });

  function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
