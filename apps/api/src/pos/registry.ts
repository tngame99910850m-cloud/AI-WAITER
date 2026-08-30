import type { PosAdapter } from '@ai-waiter/shared';
import { loadConfig } from '../config.js';
import { InMemoryPosAdapter } from './inMemoryAdapter.js';

let adapter: PosAdapter | null = null;

/**
 * Resolve the configured POS adapter. New integrations register here; the rest
 * of the platform only depends on the PosAdapter interface.
 */
export function getPosAdapter(): PosAdapter {
  if (adapter) return adapter;
  const cfg = loadConfig();
  switch (cfg.POS_ADAPTER) {
    case 'memory':
    default:
      adapter = new InMemoryPosAdapter();
      return adapter;
  }
}

/** Test helper. */
export function __setPosAdapter(a: PosAdapter | null): void {
  adapter = a;
}
