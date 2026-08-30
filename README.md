# AI Waiter 🍽️🤖

A production-shaped, multi-tenant **AI waiter platform** for restaurants:
customers chat (text/voice) with an AI waiter that recommends dishes, answers
menu questions, builds and prices orders, upsells tastefully, and sends confirmed
orders to the restaurant's POS/KDS — with a clean POS abstraction, strong typing,
security, and tests.

> The business goal is not "a chatbot" — it is **helping restaurants sell more
> while giving guests a faster, better experience.**

## Monorepo layout

| Path | What |
| --- | --- |
| `packages/shared` | Domain models, Zod schemas, and the pricing engine (single source of truth) |
| `apps/api` | Backend REST API — multi-tenant, POS-abstracted, AI orchestration, tested |
| `apps/mobile` | Expo / React Native customer app |
| `apps/admin` | Restaurant operator dashboard (static web app, served at `/admin`) |
| `db/migrations` | PostgreSQL schema (production persistence) |
| `docs` | [Architecture & analysis](docs/ARCHITECTURE.md), [API reference](docs/API.md) |

## Quick start

```bash
# 1. Install (root workspaces: shared + api)
npm install

# 2. Build the shared package (api depends on it)
npm run build --workspace @ai-waiter/shared

# 3. Run all tests
npm test

# 4. Start the API (seeds the demo "Juniors" + "Sarah's Kitchen" tenants)
cp apps/api/.env.example apps/api/.env
npm run dev:api          # http://localhost:4000

# 5. Try it
curl -s localhost:4000/health
# Admin dashboard: open http://localhost:4000/admin  (admin key: dev-admin-key)
curl -s -X POST localhost:4000/v1/chat \
  -H 'content-type: application/json' -H 'x-api-key: dev-client-key' \
  -d '{"restaurantId":"juniors","message":"I want something spicy with chicken, no onions, add cheese, make it a meal"}'
```

The mobile app is a separate, self-contained Expo project:

```bash
cd apps/mobile
npm install
npm start                # Expo — scan QR with Expo Go, or press i / a
```
Point it at your API by setting `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`).

## Highlights

- **AI orchestration pipeline** — intent → grounded retrieval → structured
  actions → validation against the real menu → safe result. The AI never invents
  menu data and never executes irreversible actions without customer confirmation.
- **POS abstraction** — everything goes through `PosAdapter`; add Foodics/Toast/
  Square/ERP without touching the rest of the platform.
- **Idempotent orders** — a double-tapped "Confirm" can't create duplicates.
- **Multi-tenant** — isolated menu, branding, AI persona, orders and analytics per
  restaurant (two demo tenants prove it).
- **Server-authoritative pricing** — client prices are never trusted.
- **Offline provider** — the deterministic `rules` AI provider needs no API key,
  so the app works and is fully testable out of the box; set
  `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` to use Claude.
- **Pluggable persistence** — `PERSISTENCE=memory` (default, zero-setup) or
  `PERSISTENCE=postgres` to load tenants from Postgres and write-through orders,
  service requests, analytics and audit. See [`docs/PERSISTENCE.md`](docs/PERSISTENCE.md).

## Deployment

The API ships as a container (`Dockerfile` at the repo root) — deploy to Render,
Fly.io, or Railway. See [`docs/DEPLOY.md`](docs/DEPLOY.md). The Expo app is
distributed separately via EAS / the app stores.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design and roadmap.

## License
UNLICENSED — private project.
