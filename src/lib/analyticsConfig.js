/**
 * Anonymous usage analytics — activation switch.
 *
 * We use GoatCounter (open-source, cookieless, no personal data). To activate:
 *   1. Create a free site at https://www.goatcounter.com (pick a code,
 *      e.g. "alxpace").
 *   2. Put that code in GOATCOUNTER_SITE below. Done — deploys with the next
 *      push to main.
 *
 * While GOATCOUNTER_SITE is empty, no request of any kind is sent.
 *
 * What gets reported when active (see src/lib/analytics.js — aggregate
 * tallies only, never identities):
 *   - an app-open pageview
 *   - whether the app runs installed (standalone) or in a browser tab
 *   - once per device per day: the learner's program (da / cc / gd),
 *     current week number and pacing status (behind / on-track / ahead)
 *     as bare event names
 * Tracking is skipped entirely for browsers signalling Do Not Track or
 * Global Privacy Control.
 */
export const GOATCOUNTER_SITE = 'alxpace'
