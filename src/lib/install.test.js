import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  _resetInstallState,
  captureInstallPrompt,
  installOffer,
  isIOS,
  isLinkedInInApp,
  isStandalone,
  promptInstall,
  supportsPeriodicSync,
} from './install'

/*
  The install offer must appear exactly where installing is possible, and the
  reminder must be promised exactly where installing makes it work. These are
  run against plain objects shaped like the browser APIs, because each case is
  a different phone and no single test browser is all of them.
*/

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  linkedinIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.8',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
}

const nav = (userAgent, extra = {}) => ({ userAgent, platform: '', maxTouchPoints: 0, ...extra })

/** A window with the two events captureInstallPrompt listens for. */
function fakeWindow({ standalone = false } = {}) {
  const handlers = {}
  return {
    addEventListener: (type, fn) => {
      handlers[type] = fn
    },
    matchMedia: (q) => ({ matches: standalone && q === '(display-mode: standalone)' }),
    navigator: {},
    fire: (type, event = {}) => handlers[type]?.(event),
  }
}

function promptEvent(outcome = 'accepted') {
  return {
    preventDefault: vi.fn(),
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  }
}

afterEach(() => _resetInstallState())

describe('telling phones apart', () => {
  it('knows an iPhone, and an iPad that reports itself as a Mac', () => {
    expect(isIOS(nav(UA.iphone))).toBe(true)
    expect(isIOS(nav(UA.mac, { platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true)
    expect(isIOS(nav(UA.mac, { platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false)
    expect(isIOS(nav(UA.android))).toBe(false)
  })

  it("knows LinkedIn's in-app browser", () => {
    expect(isLinkedInInApp(nav(UA.linkedinIos))).toBe(true)
    expect(isLinkedInInApp(nav(UA.iphone))).toBe(false)
  })

  it('knows when it is already running as an installed app', () => {
    expect(isStandalone(fakeWindow({ standalone: true }))).toBe(true)
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true) // iOS
    expect(isStandalone(fakeWindow())).toBe(false)
  })

  it('knows which browsers can wake an installed app for the reminder', () => {
    function Registration() {}
    Registration.prototype.periodicSync = {}
    expect(supportsPeriodicSync({ ServiceWorkerRegistration: Registration })).toBe(true)
    expect(supportsPeriodicSync({ ServiceWorkerRegistration: function () {} })).toBe(false)
    expect(supportsPeriodicSync({})).toBe(false)
  })
})

describe('the install offer', () => {
  it('offers nothing where there is no way to install', () => {
    expect(installOffer(fakeWindow(), nav(UA.android))).toBeNull()
  })

  it("holds Chromium's prompt and offers it, instead of letting Chromium pick the moment", () => {
    const win = fakeWindow()
    captureInstallPrompt(win)
    const event = promptEvent()
    win.fire('beforeinstallprompt', event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(installOffer(win, nav(UA.android))).toBe('prompt')
  })

  it('opens the prompt once, then withdraws it whatever the answer', async () => {
    const win = fakeWindow()
    captureInstallPrompt(win)
    const event = promptEvent('dismissed')
    win.fire('beforeinstallprompt', event)
    expect(await promptInstall()).toBe('dismissed')
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(installOffer(win, nav(UA.android))).toBeNull()
    expect(await promptInstall()).toBe('unavailable')
  })

  it('describes Add to Home Screen on iOS, where a page cannot trigger it', () => {
    expect(installOffer(fakeWindow(), nav(UA.iphone))).toBe('ios')
  })

  it('offers nothing once installed — from the home screen, or just now', () => {
    const win = fakeWindow({ standalone: true })
    captureInstallPrompt(win)
    win.fire('beforeinstallprompt', promptEvent())
    expect(installOffer(win, nav(UA.android))).toBeNull()

    const tab = fakeWindow()
    captureInstallPrompt(tab)
    tab.fire('appinstalled')
    expect(installOffer(tab, nav(UA.iphone))).toBeNull()
  })

  it("offers nothing inside LinkedIn's browser, which cannot install", () => {
    expect(installOffer(fakeWindow(), nav(UA.linkedinIos))).toBeNull()
  })
})
