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
export const API_URL: string = 'http://10.0.2.2:4000';
export const API_KEY: string = 'dev-client-key';
