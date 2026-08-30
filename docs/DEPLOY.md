# Deploying the AI Waiter API (container)

The API ships as a container image (`Dockerfile` at the repo root). It builds the
`@ai-waiter/shared` package and the API, then runs a slim production image as a
non-root user. The server listens on `$PORT` (default `4000`) and also serves the
operator dashboard at `/admin`.

> Vercel auto-deploy is disabled for `apps/api` (`apps/api/vercel.json` →
> `github.enabled: false`) because the API is a long-running server, not a
> serverless/static target. Deploy it as a container instead.

## Build & run locally

```bash
docker build -t ai-waiter-api .
docker run --rm -p 4000:4000 \
  -e CLIENT_API_KEYS=prod-client-key \
  -e ADMIN_API_KEY=prod-admin-key \
  ai-waiter-api
# http://localhost:4000/health  ·  http://localhost:4000/admin
```

## Environment variables

| Var | Required | Notes |
| --- | --- | --- |
| `PORT` | no | Host injects it (Render/Fly/Railway set it automatically). Default 4000. |
| `CLIENT_API_KEYS` | yes (prod) | Comma-separated keys the mobile app sends as `x-api-key`. |
| `ADMIN_API_KEY` | yes (prod) | Admin dashboard key (`x-admin-key`). |
| `CORS_ORIGINS` | recommended | Comma-separated allowed origins (avoid `*` in prod). |
| `PERSISTENCE` | no | `memory` (default) or `postgres`. |
| `DATABASE_URL` | if postgres | Postgres connection string (port 5432 / session pooler). |
| `DB_SCHEMA` | no | Defaults to `ai_waiter`. |
| `AI_PROVIDER` | no | `rules` (default, offline) or `anthropic`. |
| `ANTHROPIC_API_KEY` | if anthropic | Server-only; never shipped to the app. |

## Render

1. New → **Web Service** → connect this repo.
2. Runtime: **Docker** (Render auto-detects the root `Dockerfile`).
3. Health check path: `/health`.
4. Add the environment variables above. `PORT` is provided by Render.
5. Deploy. The service URL is what you set as `EXPO_PUBLIC_API_URL` in the app.

A `render.yaml` blueprint (optional):

```yaml
services:
  - type: web
    name: ai-waiter-api
    env: docker
    dockerfilePath: ./Dockerfile
    healthCheckPath: /health
    envVars:
      - key: CLIENT_API_KEYS
        sync: false
      - key: ADMIN_API_KEY
        sync: false
      - key: PERSISTENCE
        value: memory
```

## Fly.io

```bash
fly launch --no-deploy            # detects the Dockerfile; creates fly.toml
fly secrets set CLIENT_API_KEYS=... ADMIN_API_KEY=...
# In fly.toml set internal_port = 4000 and a [[services.http_checks]] on /health
fly deploy
```

## Railway

New Project → Deploy from repo → Railway builds the root `Dockerfile`. Add the
env vars in the service settings; Railway injects `PORT`. Expose the service and
use its public URL as the app's `EXPO_PUBLIC_API_URL`.

## Notes

- The image excludes `apps/mobile` (the bare React Native app is built and
  distributed separately via Gradle/Xcode or the "Build Android APK" workflow).
- For `PERSISTENCE=postgres`, apply `db/migrations/0001_init.sql` and seed the
  database first (see [`PERSISTENCE.md`](PERSISTENCE.md)).
