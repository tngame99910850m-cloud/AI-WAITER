# AI Waiter — Architecture & Analysis

This document answers the "FIRST TASK" analysis and records the architecture the
codebase implements.

## 1. Starting point (repository analysis)

- **Current project structure:** the repository was **empty** (no commits, no
  code) at the start of this work — a greenfield build.
- **Current technology stack:** none pre-existing. Node.js 22 / npm are
  available in the environment.
- **What already exists:** nothing to reuse; no lock-in to respect.
- **What is missing:** everything — so the architecture below was chosen freely
  for the product goals (multi-tenant AI ordering, POS-agnostic, secure).

## 2. Chosen architecture (overview)

A TypeScript monorepo with three deployables and one shared contract package:

```
ai-waiter/
├─ packages/shared     # Domain models + Zod schemas + pricing engine (source of truth)
├─ apps/api            # Backend REST API: multi-tenant, POS-abstracted, AI orchestration
├─ apps/mobile         # Bare React Native (no Expo) customer app
├─ db/migrations       # PostgreSQL schema (production persistence)
└─ docs                # This document + API reference
```

The **shared** package is the heart: menu/order/AI/POS types are defined once as
Zod schemas and consumed by both the API and the mobile app, so client and server
can never drift. Money is always integer minor units + currency (no floats).

## 3. Database recommendation

**PostgreSQL** (Supabase-compatible). Rationale: relational menu/order data with
strong constraints, JSONB for flexible branding/AI config, row-level security for
tenant isolation, and easy analytics with SQL. Schema in
`db/migrations/0001_init.sql`. Every tenant-scoped table carries `restaurant_id`
and is protected by RLS. The API currently ships a fully-working in-memory store
(`apps/api/src/data/store.ts`) that mirrors this schema behind the same repository
shape — swapping to Postgres is a persistence-layer change, not an API change.

## 4. AI architecture recommendation

A **pipeline**, not "dump the DB into a prompt":

```
customer message
  → context retrieval (compact, grounded menu slice — buildMenuContext)
  → provider reasoning (LLM or deterministic rules)
  → structured actions (typed AiAction[])
  → validation against the REAL menu (priceLine / resolveAddItem)
  → safe, resolved result (priced cart lines, service requests, upsell)
```

Key properties:
- **Grounding:** the model only sees an allow-listed, structured menu context and
  is instructed never to invent products, prices or allergen facts. Unknowns are
  `deferredToStaff = true` ("Let me check with the restaurant").
- **Provider abstraction (`AiProvider`):** `RuleBasedProvider` (offline,
  deterministic, fully tested, zero external calls) and `AnthropicProvider`
  (Claude Messages API). Selected by config; on any LLM error we fall back to
  rules so the app never hard-fails.
- **Safety:** the AI **never** mutates state. It proposes actions; the backend
  validates them; irreversible actions (confirm order) require explicit customer
  confirmation on the client. User input is delimited to reduce prompt injection.

## 5. API architecture

REST over HTTPS, versioned under `/v1`. Express + Zod validation + Helmet + CORS +
rate limiting + structured errors + request ids + audit logging.

- **Customer API** (`x-api-key`): restaurants, menu, products, chat, orders
  (idempotent), service requests, analytics.
- **Admin API** (`x-admin-key`): orders + status, service requests + status,
  analytics summary, audit log.

See `docs/API.md` for the endpoint reference.

## 6. POS integration architecture

All menu/order persistence goes through the `PosAdapter` interface
(`getMenu / getProduct / createOrder / updateOrder / cancelOrder /
getOrderStatus`). The built-in `InMemoryPosAdapter` is the reference
implementation and the contract new adapters (Foodics, Toast, Square, a bespoke
ERP) must satisfy. Nothing in the platform hard-codes a specific POS. Order
creation is **idempotent** (idempotency key), so a double-tapped "Confirm" can
never create two orders.

## 7. Mobile UI architecture

Bare React Native (React Native Community CLI) + TypeScript — no Expo runtime,
with fully editable `android/`/`ios/` native projects. State via a small store; a
typed API client against the shared schemas; a design-system layer (theme, spacing,
typography) driven by per-restaurant branding. Screens: Welcome → Restaurant →
Chat (with recommendation & upsell cards) → Menu → Product/modifiers → Cart →
Confirmation → Order status, plus Table Service actions. Offline/poor-Wi-Fi
handling: cached menu, loading skeletons, retry, and idempotent order submission.

## 8. Security model

- Secrets (LLM keys, admin key) live only on the server; the mobile app holds
  only a client API key and talks solely to this API.
- Zod validation on every request body; Helmet headers; CORS allow-list; fixed
  window rate limiting; structured, non-leaky errors.
- Tenant isolation everywhere (`restaurantId` scoping + Postgres RLS).
- Prompt-injection mitigation (grounding + delimited untrusted input + never
  trusting the model to execute actions).
- Audit log for orders, status changes and admin actions.

## 9. Development phases

1. ✅ Architecture, shared domain model & pricing engine (tested)
2. ✅ Database schema (Postgres) + in-memory reference store
3. ✅ POS adapter abstraction + reference adapter (idempotent orders)
4. ✅ AI orchestration pipeline (rules + Claude providers, grounded & safe)
5. ✅ Backend API (auth, validation, rate limit, errors, audit) + tests
6. ✅ Admin API (orders, service requests, analytics, audit)
7. ✅ Mobile app (core customer flow, chat, cart, confirmation, service, status)
8. ✅ Admin web dashboard UI (`apps/admin`) — live orders board with status
   transitions, service-request queue, analytics overview (KPIs + top items),
   and audit log; served by the API at `/admin`
9. ✅ Postgres-backed persistence (`PERSISTENCE=postgres`) — tenants loaded from
   an isolated `ai_waiter` schema into an in-memory read projection, with
   write-through of orders/service-requests/analytics/audit; schema + demo data
   applied to the attached Supabase project. See [`docs/PERSISTENCE.md`](PERSISTENCE.md).
10. ⏳ Real-time order status (websocket/SSE) + push notifications
11. ⏳ Admin menu editing (CRUD for categories/products/modifiers/images)
12. ⏳ Voice STT integration on device + payments adapter
13. ⏳ E2E tests, load testing, observability, CI/CD hardening

## 10. Testing

- `packages/shared`: pricing/money unit tests.
- `apps/api`: orchestrator behavior tests + full HTTP integration tests
  (auth, menu, chat, idempotency, validation failures, admin flows).
- Run everything with `npm test` at the repo root.
