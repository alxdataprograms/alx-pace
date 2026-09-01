// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { SCHEDULE } from './lib/schedule'
import { translations } from './i18n/translations'

/*
  THE ONLY TEST HERE THAT RENDERS ANYTHING.

  A callback placed above the function it depended on once shipped a blank page
  to this repo: React threw "Cannot access X before initialization" on mount, and
  lint passed, the build passed, and all 115 other tests passed. Nothing in a
  suite of pure functions can see a white screen.

  That failure matters more here than in most apps. There is no backend, so
  there is no server log and no error reporting — a crash is invisible until a
  learner thinks to mention it, and a learner who opens a blank page mostly
  just leaves.

  DELIBERATELY SHALLOW
  These assert that the app MOUNTS, and nothing about how it looks. No markup,
  no class names, no copy. Deep DOM assertions rot on every design change, and
  the things worth looking at — layout, RTL, contrast — are things jsdom cannot
  see anyway. The browser is still where you check whether it looks right; this
  is only there to catch it not existing.

  WHAT THIS CANNOT CATCH: CSS, layout, real browser APIs, and anything visual.
  The Arabic hashtag rendering as "IAmTheStory_ALX#" would sail straight through
  this file. jsdom is a guard against crashes, not a substitute for looking.

  StrictMode is deliberate: it double-invokes render and effects, which surfaces
  the ordering and impurity bugs this file exists to catch.
*/

const DAY = 86400000
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)

let container
let root
let errors

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  // React reports render errors through console.error rather than by rethrowing
  // in every case, so a silent one would otherwise pass as a green test.
  errors = []
  vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')))
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
  vi.restoreAllMocks()
})

function render() {
  root = createRoot(container)
  // createElement rather than JSX: this is the repo's only test that renders,
  // and written this way it needs no JSX transform config of its own.
  act(() => {
    root.render(
      createElement(StrictMode, null, createElement(LanguageProvider, null, createElement(App))),
    )
  })
  return container
}

/** Mounted, produced real content, and logged nothing React considers an error. */
function expectHealthy(el) {
  expect(errors, `React logged: ${errors[0] ?? ''}`).toEqual([])
  expect(el.querySelectorAll('button').length).toBeGreaterThan(0)
  expect(el.textContent.trim().length).toBeGreaterThan(100)
}

describe('the app mounts in every learner state', () => {
  it('renders with no start date set', () => {
    expectHealthy(render())
  })

  it('renders while the course is still in the future', () => {
    window.localStorage.setItem('startDate', iso(14))
    expectHealthy(render())
  })

  it('renders mid-programme', () => {
    window.localStorage.setItem('startDate', iso(-21))
    expectHealthy(render())
  })

  it('renders after the fourteen weeks are over', () => {
    window.localStorage.setItem('startDate', iso(-14 * 7 - 3))
    expectHealthy(render())
  })
})

describe('the app mounts around the milestone feature', () => {
  const moduleOne = SCHEDULE.modules[0].weeks.flatMap((w) => w.lessons).map((l) => l.id)

  it('renders with the celebration dialogue open', () => {
    // The exact path that crashed: the dialogue and its callbacks are only
    // exercised when a milestone is actually pending.
    window.localStorage.setItem('startDate', iso(-21))
    window.localStorage.setItem('completedLessons', JSON.stringify(moduleOne))
    const el = render()
    expectHealthy(el)
    expect(el.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('renders with the milestone already dismissed, offering the re-share', () => {
    window.localStorage.setItem('startDate', iso(-21))
    window.localStorage.setItem('completedLessons', JSON.stringify(moduleOne))
    window.localStorage.setItem('alx-celebrated', JSON.stringify(['module:DA-1']))
    const el = render()
    expectHealthy(el)
    expect(el.querySelector('[role="dialog"]')).toBeNull()
    expect(el.querySelectorAll('button[aria-label^="Share that"]').length).toBe(1)
  })

  it('renders with the whole programme finished', () => {
    window.localStorage.setItem('startDate', iso(-14 * 7))
    window.localStorage.setItem('completedLessons', JSON.stringify(SCHEDULE.lessons.map((l) => l.id)))
    expectHealthy(render())
  })

  it('survives a corrupt alx-celebrated value', () => {
    // localStorage is user-writable and survives deploys, so a bad value is a
    // real input, not a hypothetical.
    window.localStorage.setItem('startDate', iso(-21))
    window.localStorage.setItem('alx-celebrated', '{"not":"an array"}')
    expectHealthy(render())
  })
})

describe('the app mounts in every language', () => {
  it.each(Object.keys(translations))('renders in %s', (lang) => {
    // Arabic flips the document to RTL from a provider effect — a crash there
    // would be invisible to anyone testing only in English.
    window.localStorage.setItem('alx-lang', lang)
    window.localStorage.setItem('startDate', iso(-21))
    expectHealthy(render())
  })
})
