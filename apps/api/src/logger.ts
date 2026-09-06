import pino from 'pino';
import { loadConfig } from './config.js';

const cfg = loadConfig();

export const logger = pino({
  level: cfg.LOG_LEVEL,
  // Never log secrets or full request bodies containing PII by default.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
    ],
    remove: true,
  },
});
