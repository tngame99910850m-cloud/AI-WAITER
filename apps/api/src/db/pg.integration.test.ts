import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Postgres round-trip integration test. It is SKIPPED unless you opt in with a
 * real database:
 *
 *   PG_INTEGRATION=1 PERSISTENCE=postgres DATABASE_URL=postgresql://... \
 *     npm run test --workspace @ai-waiter/api
 *
 * It loads tenants from Postgres, creates an order through the write-through
 * path, and confirms the row landed in the database.
 */
const RUN = process.env.PG_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('postgres persistence (integration)', () => {
  let loadTenantsIntoStore: typeof import('./menuRepo.js').loadTenantsIntoStore;
  let createOrder: typeof import('../services/orderService.js').createOrder;
  let getPool: typeof import('./pool.js').getPool;
  let closePool: typeof import('./pool.js').closePool;
  let store: typeof import('../data/store.js').store;

  beforeAll(async () => {
    process.env.PERSISTENCE = 'postgres';
    const config = await import('../config.js');
    config.__resetConfig();
    ({ loadTenantsIntoStore } = await import('./menuRepo.js'));
    ({ getPool, closePool } = await import('./pool.js'));
    ({ createOrder } = await import('../services/orderService.js'));
    ({ store } = await import('../data/store.js'));
    await loadTenantsIntoStore();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  it('loads the juniors menu from Postgres with correct pricing', () => {
    const t = store.tenant('juniors');
    const nashville = t.menu.products.find((p) => p.id === 'p_nashville');
    expect(nashville?.basePrice.amount).toBe(2200);
    const bread = nashville?.modifierGroups.find((g) => g.name === 'Bread');
    expect(bread?.minSelect).toBe(1);
  });

  it('persists a created order to the database (write-through)', async () => {
    const key = 'itest_' + Date.now();
    const { order } = await createOrder(
      {
        restaurantId: 'juniors',
        tableId: 't5',
        items: [{ lineId: 'l1', productId: 'p_fries', quantity: 2, sizeId: 's_reg', modifierIds: ['m_cheese_sauce'], notes: '' }],
      },
      key,
    );
    const res = await getPool().query('select id, total_minor from orders where id = $1', [order.id]);
    expect(res.rowCount).toBe(1);
    expect(res.rows[0].total_minor).toBe(order.totals.total.amount);
    // Clean up the test order.
    await getPool().query('delete from orders where id = $1', [order.id]);
  });
});
