// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MilestoneCelebration } from './MilestoneCelebration'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { achievedMilestones, buildPostText } from '../lib/milestones'
import { SCHEDULES } from '../lib/schedule'

/*
  What a learner reads before posting, rendered.

  jsdom cannot see the bidirectional algorithm at work — only a browser can —
  but it can see whether each English run sits in its own isolate, and whether
  the text on screen is, character for character, the text that gets posted.
*/

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(milestone, lang) {
  // LanguageProvider reads the stored language once, on mount.
  window.localStorage.setItem('alx-lang', lang)
  root = createRoot(container)
  act(() => {
    root.render(
      createElement(
        LanguageProvider,
        null,
        createElement(MilestoneCelebration, { milestone, onDismiss: () => {} }),
      ),
    )
  })
}

const gd = SCHEDULES.gd
const graduated = achievedMilestones(gd, new Set(gd.lessons.map((l) => l.id)), 'gd')
const milestone = (id) => graduated.find((m) => m.id === id)
const postIn = (lang, m) =>
  buildPostText(m, {
    moduleDone: translations[lang].postModuleDone,
    programmeDone: translations[lang].postProgrammeDone,
  })

describe('the milestone dialogue', () => {
  it('isolates every English run of an Arabic post, and shows exactly what is posted', () => {
    const m = milestone('module:GD-3')
    render(m, 'ar')
    const quote = container.querySelector('blockquote')
    const isolated = [...quote.querySelectorAll('bdi')].map((b) => [b.getAttribute('dir'), b.textContent])
    expect(isolated).toEqual([
      ['ltr', 'Poster Design & Visual Composition'],
      ['ltr', 'Poster Design'],
      ['ltr', 'https://alxprograms.github.io/alx-pace/share/gd/'],
      ['ltr', '#LifeAtALX'],
    ])
    expect(quote.textContent).toBe(postIn('ar', m))
  })

  it('tells a Graphic Design graduate the programme’s real length, counted in items', () => {
    const m = milestone('programme:gd')
    render(m, 'en')
    expect(container.querySelector('[role="dialog"]').textContent).toContain(
      'All 10 modules, 373 items, 32 weeks.',
    )
    expect(container.querySelector('blockquote').textContent).toBe(postIn('en', m))
  })

  /*
    The post's link has no break a line can take for its first 273px, so it ran
    past the grey box at 375px and past the screen's edge at 320px: off the
    right in English and French, off the left in Arabic. It may now break
    between any two characters where nothing else fits (overflow-wrap), and is
    still read left to right. jsdom lays out no line, so this checks the two
    attributes that do it.
  */
  it.each(Object.keys(translations))('lets the link wrap anywhere, still left to right (%s)', (lang) => {
    render(milestone('module:GD-3'), lang)
    const link = [...container.querySelectorAll('blockquote bdi')].find((b) =>
      b.textContent.startsWith('https://'),
    )
    expect(link.getAttribute('dir')).toBe('ltr')
    expect(link.classList).toContain('break-words')
  })
})

/*
  Focus, while the dialogue is open and after it closes.

  Measured in Chromium before this was fixed: the third Tab left the dialogue
  for the page it covers, which stayed reachable underneath, and closing it
  dropped focus on the page body, so a keyboard or screen-reader user started
  again from the top. jsdom has no Tab navigation and ignores `inert`, so this
  checks what produces the behaviour: the attribute on the page, the wrap at
  each end, and where focus is handed back.
*/
describe('focus while the dialogue is open', () => {
  const m = milestone('module:GD-3')
  let open

  /** A page with an opener button, and the dialogue laid over it as a sibling. */
  function renderPage({ show, onDismiss = () => {} }) {
    window.localStorage.setItem('alx-lang', 'en')
    root ??= createRoot(container)
    act(() => {
      root.render(
        createElement(
          LanguageProvider,
          null,
          createElement('main', null, createElement('button', { type: 'button', id: 'opener' }, 'Share')),
          show ? createElement(MilestoneCelebration, { milestone: m, onDismiss }) : null,
        ),
      )
    })
  }
  const dialog = () => container.querySelector('[role="dialog"]')
  const buttons = () => [...dialog().querySelectorAll('button')]
  const press = (key, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
    act(() => document.activeElement.dispatchEvent(event))
    return event
  }

  beforeEach(() => {
    root = undefined
    renderPage({ show: false })
    open = () => {
      container.querySelector('#opener').focus()
      renderPage({ show: true })
    }
  })

  it('opens on its primary action and makes the page behind it inert', () => {
    open()
    expect(document.activeElement.textContent).toBe(translations.en.milestoneShare)
    expect(container.querySelector('main').hasAttribute('inert')).toBe(true)
  })

  it('wraps Tab from its last control to its first, and Shift+Tab back again', () => {
    open()
    const [first, , , last] = buttons()
    expect(first.getAttribute('aria-label')).toBe(translations.en.milestoneDismiss)
    expect(last.textContent).toBe(translations.en.milestoneDismiss)

    last.focus()
    expect(press('Tab').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    expect(press('Tab', true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    // In between, Tab is the browser's: nothing is intercepted.
    buttons()[1].focus()
    expect(press('Tab').defaultPrevented).toBe(false)
  })

  it('hands focus back to whatever opened it, and lifts the inert page, on closing', () => {
    open()
    renderPage({ show: false })
    expect(container.querySelector('main').hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(container.querySelector('#opener'))
  })

  it('leaves focus where the learner put it when its dismiss handler changes', () => {
    // A tick in another tab gives App a new dismiss handler. That used to
    // re-run the effect that focuses the share button, mid-dialogue.
    open()
    const community = buttons()[2]
    community.focus()
    renderPage({ show: true, onDismiss: () => {} })
    expect(document.activeElement).toBe(community)
  })

  it('gives its close X the 44px tap target', () => {
    // 34×34 before. The class is the app's 44×44 minimum (index.css).
    open()
    expect(buttons()[0].classList).toContain('tap-target')
  })
})
