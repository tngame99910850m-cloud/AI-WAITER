# Postgres Persistence

The API runs in one of two persistence modes, chosen by `PERSISTENCE`:

- **`memory`** (default) — seeds the reference demo tenants in-process. Great for
  local dev, tests, and demos. No database required.
- **`postgres`** — at startup, loads every tenant (restaurants, tables, menu,
  upsell rules) plus existing transactional data (orders, service requests,
  analytics, audit) from Postgres into the in-memory **read projection**; all
  writes are **mirrored back** to Postgres via the persistence port.

## Architecture

```
                 ┌──────────────── in-memory store (fast read projection) ───────────────┐
  boot ─ load ──►│ restaurants · tables · menu · upsell · orders · service · analytics    │
                 └───────────────────────────────────────────────────────────────────────┘
                              ▲                                   │ write-through
  reads (menu, chat, cart) ───┘                                   ▼
                                                     ┌──────────────────────────┐
                                                     │  Postgres (ai_waiter)     │
                                                     │  durable system of record │
                                                     └──────────────────────────┘
```

- Menu/restaurant data is read-heavy and changes rarely → served from memory.
- Orders, service requests, analytics and audit are written through to Postgres
  synchronously (orders/requests) or best-effort async (analytics/audit).
- On restart, the projection is rebuilt from Postgres, so nothing is lost.
- Order creation is idempotent at both layers (idempotency key + a unique
  `(restaurant_id, idempotency_key)` constraint).

Code: `src/db/pool.ts` (pool), `src/db/menuRepo.ts` (loader),
`src/db/txnRepo.ts` (write-through port), `src/bootstrap.ts` (mode selection),
`src/db/push.ts` (reproducible seed writer).

## Schema

Everything lives in a dedicated **`ai_waiter`** schema (see
`db/migrations/0001_init.sql`) so the platform can share a database with other
apps without collisions. Tenant isolation is enforced by `restaurant_id` on
every table plus row-level security policies keyed on `app.restaurant_id`.

## Setup (Supabase or any Postgres)

1. **Apply the schema** — run `db/migrations/0001_init.sql` against your database
   (Supabase SQL editor, `psql`, or the Supabase MCP `apply_migration`).
2. **Seed it** — either run the migration's companion seed, or from the app:
   ```bash
   PERSISTENCE=postgres DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres \
     npm run db:push --workspace @ai-waiter/api
   ```
   `db:push` writes the same tenants/menu as the in-memory seed (idempotent).
3. **Run the API against Postgres**:
   ```bash
   PERSISTENCE=postgres DATABASE_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres \
     npm run start --workspace @ai-waiter/api
   ```
   Use the **direct/session** connection (port 5432) so the pinned `search_path`
   is honored. The password comes from Supabase → Project Settings → Database.

## Verify (integration test)

An opt-in round-trip test loads the menu from Postgres and confirms an order is
persisted:

```bash
PG_INTEGRATION=1 PERSISTENCE=postgres DATABASE_URL=postgresql://... \
  npm run test --workspace @ai-waiter/api
```

It is skipped by default, so CI and normal `npm test` never need a database.

## Notes on the reference environment

The schema and demo data for both tenants ("Juniors", "Sarah's Kitchen") have
been applied to the attached Supabase project under the `ai_waiter` schema. The
app connects with a direct Postgres connection string; provide it via
`DATABASE_URL` (never shipped to the mobile client). RLS protects any non-owner
role; the API's trusted server connection is the system of record.
