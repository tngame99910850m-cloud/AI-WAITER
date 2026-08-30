import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { seed } from '../data/seed.js';

const app = buildApp(loadConfig());
const CLIENT = 'dev-client-key';
const ADMIN = 'dev-admin-key';

describe('API integration', () => {
  beforeEach(() => seed());

  it('serves health without auth', async () => {
    await request(app).get('/health').expect(200);
  });

  it('rejects missing api key', async () => {
    await request(app).get('/v1/restaurants').expect(401);
  });

  it('lists restaurants and returns a menu', async () => {
    const list = await request(app).get('/v1/restaurants').set('x-api-key', CLIENT).expect(200);
    expect(list.body.restaurants.length).toBeGreaterThanOrEqual(2);

    const menu = await request(app)
      .get('/v1/restaurants/juniors/menu')
      .set('x-api-key', CLIENT)
      .expect(200);
    expect(menu.body.menu.products.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown tenant', async () => {
    await request(app).get('/v1/restaurants/nope/menu').set('x-api-key', CLIENT).expect(404);
  });

  it('runs a chat turn', async () => {
    const res = await request(app)
      .post('/v1/chat')
      .set('x-api-key', CLIENT)
      .send({ restaurantId: 'juniors', message: 'what do you recommend that is spicy?' })
      .expect(200);
    expect(res.body.result.recommendedProductIds).toContain('p_nashville');
  });

  it('is idempotent on order creation', async () => {
    const body = {
      restaurantId: 'juniors',
      tableId: 't12',
      items: [{ lineId: 'l1', productId: 'p_fries', quantity: 1, sizeId: 's_reg', modifierIds: [], notes: '' }],
    };
    const first = await request(app)
      .post('/v1/orders')
      .set('x-api-key', CLIENT)
      .set('idempotency-key', 'abc-123')
      .send(body)
      .expect(201);
    const second = await request(app)
      .post('/v1/orders')
      .set('x-api-key', CLIENT)
      .set('idempotency-key', 'abc-123')
      .send(body)
      .expect(200);
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.order.id).toBe(first.body.order.id);
  });

  it('rejects an order for an unavailable modifier', async () => {
    const res = await request(app)
      .post('/v1/orders')
      .set('x-api-key', CLIENT)
      .send({
        restaurantId: 'juniors',
        items: [{ lineId: 'l1', productId: 'p_nashville', quantity: 1, sizeId: null, modifierIds: ['does_not_exist'], notes: '' }],
      })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('creates a service request', async () => {
    const res = await request(app)
      .post('/v1/service-requests')
      .set('x-api-key', CLIENT)
      .send({ restaurantId: 'juniors', tableId: 't12', type: 'request_water' })
      .expect(201);
    expect(res.body.request.status).toBe('open');
  });

  it('guards admin endpoints and returns analytics', async () => {
    await request(app).get('/v1/admin/juniors/analytics').expect(403);
    const res = await request(app)
      .get('/v1/admin/juniors/analytics')
      .set('x-admin-key', ADMIN)
      .expect(200);
    expect(res.body.analytics).toHaveProperty('averageOrderValue');
  });

  it('lets admin advance an order status', async () => {
    const created = await request(app)
      .post('/v1/orders')
      .set('x-api-key', CLIENT)
      .send({ restaurantId: 'juniors', items: [{ lineId: 'l1', productId: 'p_cola', quantity: 1, sizeId: 's_reg', modifierIds: [], notes: '' }] })
      .expect(201);
    const orderId = created.body.order.id;
    const patched = await request(app)
      .patch(`/v1/admin/juniors/orders/${orderId}`)
      .set('x-admin-key', ADMIN)
      .send({ status: 'preparing' })
      .expect(200);
    expect(patched.body.order.status).toBe('preparing');
  });
});
