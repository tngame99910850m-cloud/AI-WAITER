# AI Waiter API — production container image.
# Builds the shared package + API in a builder stage, then ships a slim runtime
# with only production dependencies. Suitable for Render, Fly.io, Railway, or any
# container host. The app listens on $PORT (default 4000).

# ---- Builder ----------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install workspace deps using only the manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci

# Copy sources needed to build the API (mobile app is not part of this image).
COPY packages/shared packages/shared
COPY apps/api apps/api
# Admin dashboard static assets (served by the API at /admin).
COPY apps/admin apps/admin

RUN npm run build --workspace @ai-waiter/shared \
 && npm run build --workspace @ai-waiter/api \
 && npm prune --omit=dev

# ---- Runtime ----------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

# Non-root user for safety.
RUN useradd --system --create-home --uid 1001 appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Admin dashboard static assets are served by the API at /admin.
COPY --from=builder /app/apps/admin/public ./apps/admin/public

USER appuser
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
