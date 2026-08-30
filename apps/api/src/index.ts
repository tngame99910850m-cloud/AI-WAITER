import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { seed } from './data/seed.js';

const cfg = loadConfig();

// Seed the reference tenants. In production, data lives in Postgres and this is
// replaced by migrations + real menu management.
seed();

const app = buildApp(cfg);

const server = app.listen(cfg.PORT, () => {
  logger.info(
    { port: cfg.PORT, env: cfg.NODE_ENV, pos: cfg.POS_ADAPTER, ai: cfg.AI_PROVIDER },
    'AI Waiter API listening',
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
