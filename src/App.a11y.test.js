// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'
import { PROGRAMS } from './lib/programs'

/*
  The accessibility failures the UX review measured in Chromium at 375px, by
  keyboard and as a screen reader announces the page, in both themes and all
  three languages:

    - a week in the roadmap reached by Tab showed no focus ring;
    - the ring on the navy hero was cobalt, 2.87:1 against it;
    - after each setup step focus fell to the page body;
    - the language buttons were 36px tall;
    - with the phone in dark mode and the app light, the date field's
      calendar icon vanished;
    - the French roadmap cut the current week down to "Sem…";
    - screen-reader labels stayed English ("Language", "ALX Pace") and one
      read "Switch to Dark mode mode".

  (The milestone dialogue and the dark-mode chip have their own files.)

  jsdom lays nothing out and paints nothing, so where a fix is visual this
  checks what produces it, as App.firstScreens.test.js does: the class that
  draws a ring inside a card, the rule that makes it lime, the class that
  lets a row wrap.
*/

const langs = Object.keys(translations)
const en = translations.en
/** A local calendar date `offsetDays` from today, as the date field stores it. */
const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISODateString(d)
}
// Not new URL('./index.css', import.meta.url): under jsdom, Vite rewrites that
// pattern to the dev server's http:// address of the asset.
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8')

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
  vi.useRealTimers()
})

function render(storage) {
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

/** Every milestone already seen, so no dialogue covers the page. */
const allCelebrated = JSON.stringify(
  Object.values(SCHEDULES).flatMap((s) => s.modules.map((m) => `module:${m.code}`)),
)
const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** As a keyboard user does it: focus the button, then activate it. */
const press = (el) => {
  el.focus()
  click(el)
}
const button = (start) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(start))
const hero = () => container.querySelector('h1').closest('section')
const focused = () => document.activeElement
/** A controlled input changed the way React hears it. */
const type = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}
const statusHeadline = () =>
  container.querySelector(`section[aria-label="${en.pacingStatusAria}"] [tabindex="-1"]`)

describe('a setup step hands focus to the heading of the card that replaces it', () => {
  it.skipIf(PROGRAMS.cc?.hidden)('through Creative Tech, a track and a start date', () => {
    render({ program: '' })
    expect(focused()).toBe(document.body)

    press(button(en.creativeTech))
    expect(focused().tagName).toBe('H2')
    expect(focused().textContent).toBe(en.pickerTrackTitle)

    press(button(en.back))
    expect(focused().textContent).toBe(en.pickerTitle)

    press(button(en.creativeTech))
    press(button(en.programs.gd))
    expect(focused().tagName).toBe('H2')
    expect(focused().textContent).toBe(en.promptTitle)

    press(button(en.startPacing))
    expect(focused()).toBe(statusHeadline())
    expect(focused().textContent.trim().length).toBeGreaterThan(0)
  })

  it('through Data Analytics and "I started today"', () => {
    render({ program: '' })
    press(button(en.programs.da))
    expect(focused().textContent).toBe(en.promptTitle)
    press(button(en.startedToday))
    expect(focused()).toBe(statusHeadline())
  })

  it.each([
    ['ahead, to the countdown', 10, en.beginsIn],
    ['past the final week, to the graduation card', -200, en.finishLineTitle],
  ])('to a start date %s', (_, offset, heading) => {
    render({ program: 'da' })
    type(container.querySelector('main input[type="date"]'), iso(offset))
    press(button(en.startPacing))
    expect(focused().tagName).toBe('H2')
    expect(focused().textContent).toContain(heading)
  })

  it('opens the picker from "change" on its heading, and Cancel goes back to "change"', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    const change = [...hero().querySelectorAll('button')].find((b) =>
      b.textContent.includes(en.change),
    )
    press(change)
    expect(focused().textContent).toBe(en.pickerTitle)
    press(button(en.cancel))
    expect(focused()).toBe(change)
  })

  it('starts over on the picker after a reset', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    press(button(en.resetButton))
    press(button(en.resetYes))
    expect(focused().textContent).toBe(en.pickerTitle)
  })

  it('moves nothing on load', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    expect(focused()).toBe(document.body)
  })

  it('moves nothing when a countdown reaches its start day in a tab left open', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58))
    render({ program: 'da', startDate: '2026-10-14' })
    const edit = hero().querySelector(`button[aria-label="${en.editName}"]`)
    edit.focus()
    act(() => vi.advanceTimersByTime(4 * 60_000))
    expect(statusHeadline()).not.toBeNull()
    expect(focused()).toBe(edit)
  })
})

describe('every focus ring can be seen', () => {
  it('draws a roadmap week’s ring inside its card, which clips anything outside', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    const weeks = [...container.querySelectorAll('button[aria-controls^="week-panel-"]')]
    expect(weeks).toHaveLength(SCHEDULES.da.weeks.length)
    for (const week of weeks) {
      expect(week.closest('.alx-card').classList).toContain('overflow-hidden')
      expect(week.classList).toContain('focus-visible:outline-offset-[-3px]')
      // The card's corner, so the ring follows the curve that clips it; an
      // open week's header has square bottom corners above its lessons.
      const open = week.getAttribute('aria-expanded') === 'true'
      expect(week.classList).toContain(open ? 'rounded-t-[15px]' : 'rounded-[15px]')
    }
  })

  it('turns the ring lime on navy surfaces, in the light theme too', () => {
    expect(css).toMatch(/:where\(\.on-navy\) :focus-visible\s*\{\s*outline-color:\s*#c4e878;?\s*\}/)
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    expect(hero().classList).toContain('on-navy')
  })

  it('counts the graduation card as a navy surface', () => {
    render({ program: 'da', startDate: iso(-200), 'alx-celebrated': allCelebrated })
    const card = [...container.querySelectorAll('main > section')].find((s) =>
      s.querySelector('h2')?.textContent.includes(en.finishLineTitle),
    )
    expect(card.classList).toContain('bg-navy-900')
    expect(card.classList).toContain('on-navy')
  })
})

describe('native controls follow the app’s theme, not the phone’s', () => {
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  }

  it('is light unless the app is dark, so the date field’s icon stays visible', () => {
    // "light dark" let a phone in dark mode draw the icon light, on the app's
    // white field.
    expect(rule(':root')).toMatch(/color-scheme:\s*light;/)
    expect(rule('html.dark')).toMatch(/color-scheme:\s*dark;/)
  })

  it('is dark on navy surfaces, whose date editor sits on navy in both themes', () => {
    expect(rule('.on-navy')).toMatch(/color-scheme:\s*dark;/)
  })
})

describe('the language buttons', () => {
  it('are 44px tall, the app’s tap target', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    const options = [...container.querySelectorAll('[role="group"] button')]
    expect(options).toHaveLength(langs.length)
    for (const option of options) expect(option.classList).toContain('min-h-[44px]')
  })
})

describe('the roadmap wraps rather than cutting a label short', () => {
  it('shows French Graphic Design’s current catch-up week in full', () => {
    // Day 90 is GD's Week 13.5, a catch-up week. Its label read "Sem…" beside
    // the "Rattrapage" and "En cours" chips at 375px.
    const fr = translations.fr
    render({ program: 'gd', startDate: iso(-90), 'alx-lang': 'fr', 'alx-celebrated': allCelebrated })
    const label = [...container.querySelectorAll('p')].find(
      (p) => p.textContent === fr.weekRange(13.5, 13.5),
    )
    expect(label.classList).not.toContain('truncate')
    expect(label.parentElement.classList).toContain('flex-wrap')
    const note = [...container.querySelectorAll('p')].find((p) => p.textContent === fr.bufferRoadmapNote)
    expect(note.classList).not.toContain('truncate')
  })

  it('cuts no roadmap text short in any program', () => {
    for (const program of Object.keys(SCHEDULES)) {
      render({ program, startDate: iso(-30), 'alx-celebrated': allCelebrated })
      const roadmap = container.querySelector(`section[aria-label="${en.fullCurriculumAria}"]`)
      expect(roadmap.querySelectorAll('.truncate'), program).toHaveLength(0)
      act(() => root.unmount())
      root = null
      window.localStorage.clear()
    }
  })
})

describe('screen-reader labels speak the learner’s language', () => {
  const labels = () => new Set([...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label')))
  // A brand name is the same word in every language.
  const SAME_EVERYWHERE = new Set(['ALX'])

  it.each(langs.filter((l) => l !== 'en'))('leave no English label behind in %s', (lang) => {
    for (const storage of [
      { program: '' },
      { program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated },
    ]) {
      render({ ...storage, 'alx-lang': 'en' })
      const english = labels()
      act(() => root.unmount())
      window.localStorage.clear()
      render({ ...storage, 'alx-lang': lang })
      const shared = [...labels()].filter((l) => english.has(l) && !SAME_EVERYWHERE.has(l))
      expect(shared).toEqual([])
      act(() => root.unmount())
      root = null
      window.localStorage.clear()
    }
  })

  it.each(langs)('names the hero, the language group and this week’s focus in %s', (lang) => {
    const t = translations[lang]
    render({ program: '', 'alx-lang': lang })
    expect(hero().getAttribute('aria-label')).toBe(t.introAria)
    act(() => root.unmount())
    window.localStorage.clear()

    render({ program: 'da', startDate: iso(-24), 'alx-lang': lang, 'alx-celebrated': allCelebrated })
    expect(hero().getAttribute('aria-label')).toBe(t.profileAria)
    expect(container.querySelector('[role="group"]').getAttribute('aria-label')).toBe(t.languageAria)
    // The sheet's week label is English ("Week 4"); the region names the week
    // in the learner's language.
    expect(container.querySelector(`main > section[aria-label="${t.focusAria(t.weekRange(4, 4))}"]`)).not.toBeNull()
  })

  it('says "Switch to Dark mode", not "Switch to Dark mode mode"', () => {
    render({ program: 'da', startDate: iso(-24), 'alx-celebrated': allCelebrated })
    const toggle = button(en.darkMode)
    expect(toggle.getAttribute('aria-label')).toBe('Switch to Dark mode')
    // Label in Name: the visible text is part of what a voice user says.
    for (const lang of langs) {
      const t = translations[lang]
      expect(t.switchTheme(t.darkMode)).toContain(t.darkMode)
      expect(t.switchTheme(t.lightMode)).toContain(t.lightMode)
    }
  })
})
