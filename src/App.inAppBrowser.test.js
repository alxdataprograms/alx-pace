// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'

/*
  The line telling a learner in LinkedIn's built-in browser to open Pace in
  their real browser: progress saved inside LinkedIn's browser stays there,
  and is missing the next time they open Pace from Chrome, Safari or the home
  screen. Shown on the first screen only, and only in that browser.
*/

const LINKEDIN =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.8'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
  delete window.navigator.userAgent // back to jsdom's own, on the prototype
})

function render({ ua, storage = {} }) {
  if (ua) Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

describe("the LinkedIn browser line", () => {
  it.each(Object.keys(translations))('shows on the first screen inside LinkedIn, in %s', (lang) => {
    render({ ua: LINKEDIN, storage: { 'alx-lang': lang } })
    expect(container.textContent).toContain(translations[lang].openInBrowser)
    // Before the greeting, so it is read first.
    const hint = [...container.querySelectorAll('main p')].find((p) =>
      p.textContent.includes(translations[lang].openInBrowser),
    )
    expect(hint.compareDocumentPosition(container.querySelector('h1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('never shows in an ordinary browser', () => {
    render({})
    expect(container.textContent).not.toContain(translations.en.openInBrowser)
  })

  it('is gone once a program is chosen, so it never nags a learner mid-course', () => {
    render({ ua: LINKEDIN, storage: { program: 'da' } })
    expect(container.textContent).not.toContain(translations.en.openInBrowser)
  })
})
