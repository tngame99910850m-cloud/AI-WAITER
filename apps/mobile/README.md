# AI Waiter — Mobile App (Expo / React Native)

Premium, mobile-first customer app for the AI Waiter platform.

## Run

```bash
npm install
cp .env.example .env         # point EXPO_PUBLIC_API_URL at your API
npm start                    # then press i (iOS), a (Android), or scan the QR
```

> On a physical device, `localhost` is the phone itself — set
> `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.20:4000`)
> and make sure the API (`apps/api`) is running.

## Flow

Welcome → Restaurant (branding + table select) → bottom tabs:
- **AI Waiter** — chat with recommendation cards, upsell CTAs, sticky cart bar,
  and a voice button (native STT lands in a dev build).
- **Menu** — categories, product cards, customize screen with modifier/size
  validation.
- **Service** — Call Waiter / Water / Bill / Assistance / Napkins.

Then Cart → Confirmation (idempotent order submit) → Order Status (live steps).

## Structure

```
src/
  api/client.ts        Typed API client (timeouts, structured errors)
  store/               zustand app + cart state, client-side pricing, actions
  components/          Design-system UI (Button, Card, ProductCard, ChatBubble…)
  screens/             One file per screen
  navigation/          Stack + bottom tabs
  theme.ts             Colors, spacing, typography, money formatting
  types.ts             DTOs mirroring the @ai-waiter/shared API contracts
```

## Build a downloadable app (EAS)

To get a standalone **APK** (installs like a normal Android app — no computer or
Metro bundler needed at runtime):

```bash
npm install -g eas-cli
eas login                         # free Expo account
cd apps/mobile
eas init                          # links the project, writes extra.eas.projectId
# Point the build at your deployed API (edit apps/mobile/eas.json → preview.env
# → EXPO_PUBLIC_API_URL), then:
eas build -p android --profile preview
```

When the cloud build finishes, Expo prints a **download link** for the `.apk`.
Open it on your Android phone to install.

Build profiles live in `eas.json`:
- **development** — dev client, points at an emulator host (`10.0.2.2`).
- **preview** — internal-distribution **APK**; set `EXPO_PUBLIC_API_URL` to your
  deployed API (see `docs/DEPLOY.md`).
- **production** — Play Store **app bundle** (`.aab`) with auto-incrementing
  version code.

> The standalone app can't reach `localhost` — it needs a **deployed** API URL.
> Until the API is deployed, the app installs and opens but shows a connection
> error on data screens. iOS builds need a paid Apple Developer account.

## Notes

- Prices shown in the cart are computed client-side for instant feedback; the
  **server re-prices authoritatively** on order creation.
- Orders use an **idempotency key** so a double-tapped Confirm can't duplicate.
- Analytics calls never throw into the UI.
- Only the client API key ships in the app; all secrets stay on the server.
