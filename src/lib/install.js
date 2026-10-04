/**
 * Installing Pace as an app: what this browser can do, and Chromium's prompt.
 *
 * WHY THE APP OFFERS IT AT ALL
 * Installed, Pace opens from the home screen like an app and works offline.
 * On Chromium it is also the only way the weekly reminder can fire: periodic
 * background sync is granted to installed apps, not to tabs. A learner who
 * enables reminders in a tab gets permission, no registration and no nudge,
 * and nothing told them why (see ReminderToggle).
 *
 * WHY IT LISTENS AT IMPORT TIME
 * Chromium fires `beforeinstallprompt` once, whenever it decides the page is
 * installable, and that can be before the footer that offers the button has
 * mounted. main.jsx calls captureInstallPrompt() before React renders, so the
 * event is held here until someone asks for it.
 *
 * HONESTY RULES
 * - The offer appears only where an install path really exists: the deferred
 *   Chromium prompt, or iOS, where Add to Home Screen is a Share-sheet step
 *   the page can describe but not trigger.
 * - It never appears once installed, nor inside LinkedIn's in-app browser,
 *   which cannot install anything (App.jsx tells those learners to open Pace
 *   in their real browser instead).
 * - Reminders are promised only where installing makes them work. On iOS
 *   there is no periodic sync and Web Push is dormant (pushConfig.js), so an
 *   installed iPhone app would send nothing; the iOS offer says so by not
 *   mentioning reminders.
 *
 * Nothing here persists anything: whether the app is installed is read from
 * the browser every time, so there is no storage key and nothing for the
 * origin handoff to decide.
 */

let deferredPrompt = null
let installedThisVisit = false
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn()
}

/** Re-render subscribers (useSyncExternalStore) when the offer changes. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Running from the home screen rather than a browser tab. */
export function isStandalone(win = typeof window === 'undefined' ? undefined : window) {
  if (!win) return false
  return (
    (typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches) ||
    win.navigator?.standalone === true // iOS Safari
  )
}

/** iPhone, iPod or iPad — iPadOS reports itself as a Mac with a touchscreen. */
export function isIOS(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!nav) return false
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent || '') ||
    (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1)
  )
}

/** LinkedIn's own in-app browser, where storage is LinkedIn's, not the phone's. */
export function isLinkedInInApp(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  return /LinkedInApp/i.test(nav?.userAgent || '')
}

/** Whether this browser can wake an installed app for the weekly reminder. */
export function supportsPeriodicSync(win = typeof window === 'undefined' ? undefined : window) {
  return Boolean(
    win?.ServiceWorkerRegistration && 'periodicSync' in win.ServiceWorkerRegistration.prototype,
  )
}

/**
 * Hold Chromium's install prompt for later, and hide the offer once the app
 * is installed. Call once, before the first render.
 */
export function captureInstallPrompt(win = window) {
  win.addEventListener('beforeinstallprompt', (event) => {
    // Without this, Chromium may show its own mini-infobar at a moment of its
    // choosing; the footer button is where the learner asks for it.
    event.preventDefault()
    deferredPrompt = event
    notify()
  })
  win.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installedThisVisit = true
    notify()
  })
}

/**
 * Which offer to show, if any:
 *   'prompt'  Chromium handed us a prompt; the button opens it.
 *   'ios'     iOS, not installed; the button explains Share → Add to Home Screen.
 *   null      Installed, or no install path in this browser.
 */
export function installOffer(
  win = typeof window === 'undefined' ? undefined : window,
  nav = typeof navigator === 'undefined' ? undefined : navigator,
) {
  if (installedThisVisit || isStandalone(win) || isLinkedInInApp(nav)) return null
  if (deferredPrompt) return 'prompt'
  if (isIOS(nav)) return 'ios'
  return null
}

/**
 * Open Chromium's install dialog. A deferred prompt can be used once, so it
 * is dropped afterwards whatever the learner chose; Chromium fires a fresh
 * `beforeinstallprompt` later if the page is still installable.
 *
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  deferredPrompt = null
  notify()
  try {
    await event.prompt()
    const choice = await event.userChoice
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
  } catch {
    return 'dismissed'
  }
}

/** Test seam: forget any captured prompt and install. */
export function _resetInstallState() {
  deferredPrompt = null
  installedThisVisit = false
  notify()
}
