# AI Waiter — API Reference (`/v1`)

Base URL: `http://localhost:4000` (dev). All customer endpoints require
`x-api-key`; admin endpoints require `x-admin-key`. All bodies are JSON.

## Auth
| Header | Used by | Example (dev) |
| --- | --- | --- |
| `x-api-key` | mobile app | `dev-client-key` |
| `x-admin-key` | admin dashboard | `dev-admin-key` |
| `idempotency-key` | `POST /v1/orders` | any unique string |

## Health
- `GET /health` → `{ status: "ok" }` (no auth)

## Restaurants & menu (customer)
- `GET /v1/restaurants` → list (id, name, currency, branding)
- `GET /v1/restaurants/:restaurantId` → restaurant config + tables
- `GET /v1/restaurants/:restaurantId/menu` → full `Menu`
- `GET /v1/restaurants/:restaurantId/products/:productId` → `Product`

## AI chat (customer)
- `POST /v1/chat`
  ```json
  { "restaurantId": "juniors", "tableId": "t12",
    "message": "something spicy with chicken",
    "history": [{ "role": "user", "content": "hi" }],
    "cartProductIds": ["p_fries"] }
  ```
  → `{ result: { intent, reply, recommendedProductIds, resolvedItems,
       cartOps, serviceRequests, requiresConfirmation, upsell,
       deferredToStaff, actions, provider } }`

  `resolvedItems` are fully-priced cart lines validated against the menu — the
  client adds them directly. `requiresConfirmation` means show the order summary.

## Orders (customer)
- `POST /v1/orders` (send `idempotency-key` header)
  ```json
  { "restaurantId": "juniors", "tableId": "t12",
    "items": [{ "lineId": "l1", "productId": "p_nashville", "quantity": 1,
                "sizeId": "s_meal", "modifierIds": ["m_cheese_american"],
                "notes": "" }] }
  ```
  → `201 { order, deduplicated:false }` — repeat with same key → `200 deduplicated:true`.
  Pricing is computed server-side from the menu; client prices are ignored.
- `GET /v1/restaurants/:restaurantId/orders/:orderId` → `{ order }`

## Service requests (customer)
- `POST /v1/service-requests`
  `{ restaurantId, tableId, type: "request_water", note? }` → `201 { request }`
  Types: `call_waiter | request_water | request_bill | request_assistance |
  request_napkins | other`.

## Analytics (customer)
- `POST /v1/analytics` `{ restaurantId, tableId?, name, properties?, clientTimestamp? }`
  → `202`

## Admin (`x-admin-key`)
- `GET  /v1/admin/:restaurantId/orders`
- `PATCH /v1/admin/:restaurantId/orders/:orderId` `{ status }`
- `GET  /v1/admin/:restaurantId/service-requests`
- `PATCH /v1/admin/:restaurantId/service-requests/:id` `{ status }`
- `GET  /v1/admin/:restaurantId/analytics` → conversion, AOV, upsell rate, top items
- `GET  /v1/admin/:restaurantId/audit` → recent audit-log entries

## Errors
All errors share:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "detail": [...], "requestId": "..." } }
```
Codes: `BAD_REQUEST, VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND,
CONFLICT, RATE_LIMITED, UPSTREAM_UNAVAILABLE, INTERNAL`.
