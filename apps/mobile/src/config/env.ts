/**
 * Runtime configuration for the app.
 *
 * Bare React Native has no built-in `.env` injection, so the API endpoint lives
 * here as an explicit, buildable config. For per-environment builds (dev / prod)
 * wire a native env library such as `react-native-config` and read from it here,
 * or override these at build time in your CI.
 *
 * Notes:
 *  - Android emulator reaches the host machine at 10.0.2.2 (not localhost).
 *  - iOS simulator can use localhost.
 *  - A real device needs your machine's LAN IP or a deployed API URL.
 *  - Only a public client key belongs here — never a server secret.
 */
// Deployed API (Vercel). For local dev against a machine, use http://10.0.2.2:4000
// on the Android emulator or your LAN IP on a real device.
export const API_URL: string =
  'https://ai-waiter-api-git-claude-31bc34-tngame99910850m-clouds-projects.vercel.app';
export const API_KEY: string = 'dev-client-key';
