/**
 * Web Push activation switch.
 *
 * The app ships with true Web Push fully wired but DORMANT. To activate
 * (enables reminders with the app closed on Android, desktop, and iOS 16.4+
 * home-screen installs):
 *
 *   1. Deploy `push/worker.js` as a (free) Cloudflare Worker:
 *      - bind a KV namespace as `SUBS`
 *      - set vars `SENDER_TOKEN` (long random string — same value as the
 *        repo secret PUSH_SENDER_TOKEN) and `ALLOWED_ORIGIN`
 *        (https://alxdataprograms.github.io) — both required, no defaults
 *   2. Put the worker URL in PUSH_ENDPOINT below (and in the repo secret
 *      PUSH_ENDPOINT so the weekly GitHub Action can read subscriptions).
 *   3. Done — the VAPID keys already exist as repo secrets, the public half
 *      is below, and .github/workflows/remind.yml sends every Monday 08:00 WAT.
 *
 * While PUSH_ENDPOINT is empty, the app automatically falls back to local
 * Periodic Background Sync reminders (no infrastructure, Chromium only).
 */
export const PUSH_ENDPOINT = ''
export const VAPID_PUBLIC_KEY =
  'BBDfayQNBuH97bjlSR3crs4Oec55mr548RlMZyg0M6PUmY-FoOG0iWKDvkEL-9T-m6-jFLiK1SsyJj3NSlPdEIY'
