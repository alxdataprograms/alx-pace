// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Footer from './Footer'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { _resetInstallState, captureInstallPrompt } from '../lib/install'

/*
  What the footer offers on each kind of phone.

  The install row must appear only where installing is possible and promise
  the weekly reminder only where installing makes it work; the reminder line
  must stop saying "Notifications allowed" to a learner in a tab, where
  Chromium will never fire one. Each case below is a different phone, so the
  browser APIs are shaped per test rather than taken from jsdom as found.
*/

const en = translations.en
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  linkedin:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.8',
}

let container
let root
const restore = []

/** Define a property on an object for this test only. */
function stub(obj, key, value) {
  const had = Object.prototype.hasOwnProperty.call(obj, key)
  const before = Object.getOwnPropertyDescriptor(obj, key)
  Object.defineProperty(obj, key, { value, configurable: true, writable: true })
  restore.push(() => {
    if (had) Object.defineProperty(obj, key, before)
    else delete obj[key]
  })
}

function phone({ ua = UA.android, standalone = false, periodicSync = false, notifications = false } = {}) {
  stub(window.navigator, 'userAgent', ua)
  stub(window, 'matchMedia', (q) => ({
    matches: standalone && q === '(display-mode: standalone)',
    addEventListener() {},
    removeEventListener() {},
  }))
  function Registration() {}
  if (periodicSync) Registration.prototype.periodicSync = {}
  stub(window, 'ServiceWorkerRegistration', Registration)
  if (notifications) {
    stub(window, 'Notification', function Notification() {})
    stub(window.navigator, 'serviceWorker', { ready: new Promise(() => {}) })
  }
}

function render(props = {}) {
  root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        LanguageProvider,
        null,
        createElement(Footer, { theme: 'light', onToggleTheme() {}, showReminders: true, ...props }),
      ),
    )
  })
}

const installButton = () =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.includes(en.installApp))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  window.localStorage.setItem('alx-lang', 'en')
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
  while (restore.length) restore.pop()()
  _resetInstallState()
})

describe('the install row', () => {
  it('is absent where there is no way to install', () => {
    phone({ ua: UA.android })
    render()
    expect(installButton()).toBeUndefined()
  })

  it('on an iPhone, explains Add to Home Screen — without promising reminders', () => {
    phone({ ua: UA.iphone })
    render()
    const button = installButton()
    expect(button).toBeDefined()
    expect(container.textContent).toContain(en.installWhy)
    expect(container.textContent).not.toContain(en.installWhyReminders)

    const steps = document.getElementById(button.getAttribute('aria-controls'))
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(steps.hidden).toBe(true)
    act(() => button.click())
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(steps.hidden).toBe(false)
    expect(steps.textContent).toContain(en.installIosSteps)
  })

  it("on Android, opens Chromium's own prompt and promises the reminder it enables", async () => {
    phone({ ua: UA.android, periodicSync: true })
    captureInstallPrompt(window)
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = vi.fn(() => Promise.resolve())
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    act(() => window.dispatchEvent(event))
    render()

    expect(event.defaultPrevented).toBe(true)
    expect(container.textContent).toContain(en.installWhyReminders)
    const button = installButton()
    expect(button.getAttribute('aria-describedby')).toBeTruthy()
    await act(async () => button.click())
    expect(event.prompt).toHaveBeenCalledTimes(1)
    // Used once: the offer goes with it.
    expect(installButton()).toBeUndefined()
  })

  it('hides itself the moment the app is installed', () => {
    phone({ ua: UA.iphone })
    captureInstallPrompt(window)
    render()
    expect(installButton()).toBeDefined()
    act(() => window.dispatchEvent(new Event('appinstalled')))
    expect(installButton()).toBeUndefined()
  })

  it("is absent inside LinkedIn's browser, which cannot install", () => {
    phone({ ua: UA.linkedin })
    render()
    expect(installButton()).toBeUndefined()
  })

  it('is absent once running as the installed app', () => {
    phone({ ua: UA.iphone, standalone: true })
    render()
    expect(installButton()).toBeUndefined()
  })
})

describe('the reminder line after permission was granted', () => {
  it('in a Chromium tab, says installing is what makes reminders arrive', () => {
    phone({ ua: UA.android, periodicSync: true, notifications: true })
    window.localStorage.setItem('alx-reminders', 'granted')
    render()
    expect(container.textContent).toContain(en.remindersNeedInstall)
    expect(container.textContent).not.toContain(en.notificationsAllowed)
  })

  it('once installed, offers to set reminders up again, now that they can be', () => {
    phone({ ua: UA.android, periodicSync: true, notifications: true, standalone: true })
    window.localStorage.setItem('alx-reminders', 'granted')
    render()
    const enable = [...container.querySelectorAll('button')].find((b) =>
      b.textContent.includes(en.enableReminders),
    )
    expect(enable).toBeDefined()
    expect(container.textContent).not.toContain(en.remindersNeedInstall)
  })

  it('where installing would not help, keeps the plain statement', () => {
    phone({ ua: UA.android, periodicSync: false, notifications: true })
    window.localStorage.setItem('alx-reminders', 'granted')
    render()
    expect(container.textContent).toContain(en.notificationsAllowed)
  })

  it('leaves a working reminder exactly as it was', () => {
    phone({ ua: UA.android, periodicSync: true, notifications: true, standalone: true })
    window.localStorage.setItem('alx-reminders', 'periodic')
    render()
    expect(container.textContent).toContain(en.remindersOn)
  })
})
