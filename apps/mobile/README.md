# AI Waiter — Mobile App (bare React Native)

Premium, mobile-first customer app for the AI Waiter platform. Built with **bare
React Native** (React Native Community CLI) — no Expo runtime or SDK. You get
full, editable `android/` and `ios/` native projects and can add any native
module.

## Configure the API endpoint

Bare RN has no `.env` injection, so the API address lives in
[`src/config/env.ts`](src/config/env.ts):

```ts
export const API_URL = 'http://10.0.2.2:4000'; // Android emulator → host machine
export const API_KEY = 'dev-client-key';
```

- **Android emulator** → `http://10.0.2.2:4000` (reaches your PC's localhost).
- **iOS simulator** → `http://localhost:4000`.
- **Real device** → your PC's LAN IP, or a deployed API URL (see `docs/DEPLOY.md`).

Only a public client key belongs here — never a server secret.

## Run in development

Prereqs: Node 20+, JDK 17, Android Studio (Android SDK) and/or Xcode. Follow the
official [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).

```bash
cd apps/mobile
npm install
npm start                 # Metro bundler (leave running)

# in another terminal:
npm run android           # build + run on an emulator/device
# or
npm run ios               # macOS + Xcode
```

Also start the backend so the app has data: from the repo root,
`npm run dev:api`.

## Build a downloadable APK

**Easiest — GitHub Actions (no local Android setup):** in the repo on GitHub,
open **Actions → "Build Android APK" → Run workflow**. When it finishes, download
the `ai-waiter-android-apk` artifact and install the `.apk` on your Android phone.
(Set `src/config/env.ts` to a deployed API URL and push first, or the app can't
reach the backend from a real device.)

**Locally:**
```bash
cd apps/mobile/android
./gradlew assembleRelease
# APK at: android/app/build/outputs/apk/release/app-release.apk
```
The release build is signed with the debug keystore (installable for testing).
For the Play Store, generate a real keystore and point the `release`
`signingConfig` at it, then `./gradlew bundleRelease` for an `.aab`.

## Structure

```
android/, ios/          Native projects (fully editable)
index.js                AppRegistry entry
App.tsx                 Root component
src/
  api/client.ts         Typed API client (timeouts, structured errors)
  config/env.ts         API endpoint config
  store/                zustand app + cart state, client-side pricing
  components/           Design-system UI (Button, Card, ProductCard, ChatBubble…)
  screens/              One file per screen
  navigation/           Stack + bottom tabs
  theme.ts, types.ts    Design tokens + DTOs mirroring the API
```

## Notes

- The screens, flows, state, and API client are unchanged from before — only the
  app's foundation moved from Expo to bare React Native.
- Prices shown in the cart are computed client-side for instant feedback; the
  **server re-prices authoritatively** on order creation.
- Orders use an **idempotency key** so a double-tapped Confirm can't duplicate.
- iOS release builds require a macOS machine with Xcode and an Apple Developer
  account.
