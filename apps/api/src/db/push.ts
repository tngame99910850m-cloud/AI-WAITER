import { getPool, closePool } from './pool.js';
import { store } from '../data/store.js';
import { seed } from '../data/seed.js';
import { logger } from '../logger.js';

/**
 * Idempotently write every in-memory tenant (from seed.ts) into Postgres. This
 * keeps the database seed reproducible from the same source of truth as the
 * in-memory demo. Safe to re-run (ON CONFLICT DO NOTHING).
 *
 * Usage: PERSISTENCE=postgres DATABASE_URL=... npm run db:push --workspace @ai-waiter/api
 */
export async function pushTenantsToDb(): Promise<void> {
  const pool = getPool();
  for (const restaurant of store.listRestaurants()) {
    const t = store.tenant(restaurant.id);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into restaurants (id,name,currency,timezone,tax_rate_bps,branding,ai_config,policies)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
        [restaurant.id, restaurant.name, restaurant.currency, restaurant.timezone,
         restaurant.taxRateBps, restaurant.branding, restaurant.aiConfig, restaurant.policies],
      );
      for (const tab of t.tables.values()) {
        await client.query(
          `insert into tables (id,restaurant_id,number,active) values ($1,$2,$3,$4) on conflict do nothing`,
          [tab.id, restaurant.id, tab.number, tab.active],
        );
      }
      const m = t.menu;
      for (const c of m.categories) {
        await client.query(
          `insert into categories (id,restaurant_id,name,description,sort_order) values ($1,$2,$3,$4,$5) on conflict do nothing`,
          [c.id, restaurant.id, c.name, c.description, c.sortOrder],
        );
      }
      for (const a of m.allergens) {
        await client.query(
          `insert into allergens (id,restaurant_id,key,label) values ($1,$2,$3,$4) on conflict do nothing`,
          [a.id, restaurant.id, a.key, a.label],
        );
      }
      for (const ing of m.ingredients) {
        await client.query(
          `insert into ingredients (id,restaurant_id,name,allergen_ids) values ($1,$2,$3,$4) on conflict do nothing`,
          [ing.id, restaurant.id, ing.name, ing.allergenIds],
        );
      }
      for (const p of m.products) {
        await client.query(
          `insert into products (id,restaurant_id,category_id,name,description,base_amount_minor,currency,
             image_url,available,rating,dietary_tags,allergen_ids,ingredient_ids,popularity_score)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) on conflict do nothing`,
          [p.id, restaurant.id, p.categoryId, p.name, p.description, p.basePrice.amount, p.basePrice.currency,
           p.imageUrl, p.available, p.rating, p.dietaryTags, p.allergenIds, p.ingredientIds, p.popularityScore],
        );
        for (const s of p.sizes) {
          await client.query(
            `insert into product_sizes (id,restaurant_id,product_id,name,delta_amount_minor)
             values ($1,$2,$3,$4,$5) on conflict do nothing`,
            [s.id, restaurant.id, p.id, s.name, s.priceDelta.amount],
          );
        }
        for (let gi = 0; gi < p.modifierGroups.length; gi++) {
          const g = p.modifierGroups[gi]!;
          await client.query(
            `insert into modifier_groups (id,restaurant_id,product_id,name,min_select,max_select,sort_order)
             values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
            [g.id, restaurant.id, p.id, g.name, g.minSelect, g.maxSelect, gi],
          );
          for (const mod of g.modifiers) {
            await client.query(
              `insert into modifiers (id,restaurant_id,product_id,group_id,name,delta_amount_minor,available,
                 adds_ingredient_ids,removes_ingredient_ids)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
              [mod.id, restaurant.id, p.id, g.id, mod.name, mod.priceDelta.amount, mod.available,
               mod.addsIngredientIds, mod.removesIngredientIds],
            );
          }
        }
      }
      for (const promo of m.promotions) {
        await client.query(
          `insert into promotions (id,restaurant_id,title,description,product_ids,active)
           values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
          [promo.id, restaurant.id, promo.title, promo.description, promo.productIds, promo.active],
        );
      }
      for (const u of t.upsellRules) {
        await client.query(
          `insert into upsell_rules (id,restaurant_id,when_product_ids,when_category_ids,
             suggest_product_id,suggest_modifier_id,message,priority)
           values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing`,
          [u.id, restaurant.id, u.whenProductIds, u.whenCategoryIds, u.suggestProductId, u.suggestModifierId, u.message, u.priority],
        );
      }
      await client.query('commit');
      logger.info({ restaurant: restaurant.id }, 'Pushed tenant to Postgres');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

// CLI entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  pushTenantsToDb()
    .then(() => closePool())
    .then(() => {
      logger.info('db:push complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'db:push failed');
      process.exit(1);
    });
}
