// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'

/*
  A learner who is behind, in an ordinary week.

  The status card said "Catch-up nudge: 9 lessons from earlier weeks still
  open" and offered nowhere to act on it: the checklist below listed only this
  week's lesson, and in the roadmap the weeks holding the nine wore the same
  grey number as the weeks still to come. Data Analytics has no catch-up
  weeks, so a DA learner never saw the nine anywhere without opening the
  roadmap's weeks one by one.

  Now the checklist opens with "Catch up first" (CurrentFocusCard.test.js
  covers the list itself), the status card's "Catch up now" goes there, and
  the roadmap marks every week gone by that still has items open. A learner on
  track or ahead, and a catch-up week, see none of it.

  Asserted through what a learner reads and can operate, as the other App
  tests are; where the fix is visual, through what produces it.
*/

const langs = Object.keys(translations)
const en = translations.en
const da = SCHEDULES.da
/** A local calendar date `offsetDays` from today, as the date field stores it. */
const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISODateString(d)
}
/** Every milestone already seen, so no dialogue covers the page. */
const allCelebrated = JSON.stringify(
  Object.values(SCHEDULES).flatMap((s) => s.modules.map((m) => `module:${m.code}`)),
)
// Not new URL('./index.css', import.meta.url): under jsdom, Vite rewrites that
// pattern to the dev server's http:// address of the asset.
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8')

let container
let root
let scrolled

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  // jsdom lays nothing out and has no scrollIntoView: record the calls.
  scrolled = []
  Element.prototype.scrollIntoView = function scrollIntoView(options) {
    scrolled.push([this, options])
  }
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
  delete Element.prototype.scrollIntoView
})

function render(storage) {
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

/**
 * A Data Analytics learner 45 days in, which is Week 7, with these ticked.
 * Weeks 1–2 alone leave Weeks 3–6 open: nine lessons behind.
 */
const renderDa = (done, extra = {}) =>
  render({
    program: 'da',
    startDate: iso(-45),
    completedLessons: JSON.stringify(done),
    'alx-celebrated': allCelebrated,
    ...extra,
  })
const before = (week) => da.lessons.filter((l) => l.week < week).map((l) => l.id)

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** As a keyboard user does it: focus the button, then activate it. */
const press = (el) => {
  el.focus()
  click(el)
}
const buttonNamed = (text) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
const heading = (text) => [...container.querySelectorAll('h3')].find((h) => h.textContent === text)

describe('"Catch up now" in the status card', () => {
  it('appears for a learner who is behind, as a 44px button', () => {
    renderDa(before(3))
    const button = buttonNamed(en.catchUpNow)
    expect(region(en.pacingStatusAria).contains(button)).toBe(true)
    expect(button.className).toContain('min-h-[44px]')
  })

  it('brings "Catch up first" to the top of the screen and focuses its heading', () => {
    renderDa(before(3))
    press(buttonNamed(en.catchUpNow))

    const target = heading(en.catchUpFirst)
    expect(document.activeElement).toBe(target)
    expect(region(en.focusAria(en.weekRange(7, 7))).contains(target)).toBe(true)
    expect(scrolled).toEqual([[target, { block: 'start' }]])
  })

  it('scrolls the way the page does: instantly for anyone who asked for reduced motion', () => {
    renderDa(before(3))
    press(buttonNamed(en.catchUpNow))
    // No behaviour of its own, so the root's scroll-behavior decides: smooth,
    // which index.css turns off under prefers-reduced-motion.
    expect(scrolled[0][1].behavior).toBeUndefined()
    expect(css).toMatch(/html\s*{[^}]*scroll-behavior:\s*smooth/)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*html\s*{\s*scroll-behavior:\s*auto;?\s*}/,
    )
  })

  it.each(langs)('speaks the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    renderDa(before(3), { 'alx-lang': lang })
    press(buttonNamed(t.catchUpNow))
    expect(document.activeElement.textContent).toBe(t.catchUpFirst)
  })

  /*
    Ticking the last overdue item turns the card to "Right on pace". Had the
    button simply gone, the card would have shrunk by its row and pulled the
    checklist up, moving the row just ticked out from under the learner's
    finger (52px, measured at 375px).
  */
  it('leaves its row in place, saying "All caught up", once the last overdue item is ticked', () => {
    // Weeks 1–6 done but the very last lesson of Week 6: one lesson behind.
    renderDa(before(7).slice(0, -1))
    const status = region(en.pacingStatusAria)
    const box = heading(en.catchUpFirst).parentElement.querySelector('[role="checkbox"]')

    click(box)
    expect(status.textContent).toContain(en.statusOnTrack)
    expect(buttonNamed(en.catchUpNow)).toBeUndefined()
    const row = [...status.querySelectorAll('p')].find((p) => p.textContent === en.caughtUp)
    expect(row.className).toContain('min-h-[44px]')
    // The tick itself stays where it was, and can be undone there.
    expect(box.isConnected).toBe(true)
    expect(box.getAttribute('aria-checked')).toBe('true')

    click(box)
    expect(buttonNamed(en.catchUpNow)).toBeDefined()
  })

  it('is not offered to a learner on track, who sees the card as before', () => {
    // Day 24 is Week 4; Weeks 1–3 are done.
    render({
      program: 'da',
      startDate: iso(-24),
      completedLessons: JSON.stringify(before(4)),
      'alx-celebrated': allCelebrated,
    })
    expect(buttonNamed(en.catchUpNow)).toBeUndefined()
    expect(region(en.pacingStatusAria).textContent).not.toContain(en.caughtUp)
    expect(heading(en.catchUpFirst)).toBeUndefined()
    expect(heading(en.thisWeek)).toBeUndefined()
  })

  it('is not offered in a catch-up week: its whole card is the catch-up list already', () => {
    // Day 90 is Graphic Design's Week 13.5; Weeks 12 and 13 are still open.
    const gd = SCHEDULES.gd
    render({
      program: 'gd',
      startDate: iso(-90),
      completedLessons: JSON.stringify(gd.lessons.filter((l) => l.week < 12).map((l) => l.id)),
      'alx-celebrated': allCelebrated,
    })
    // The card plans the week instead (App.catchUpWeek.test.js).
    expect(region(en.pacingStatusAria).textContent).toContain(en.statusCatchUpWeek(14, 5, 3))
    expect(buttonNamed(en.catchUpNow)).toBeUndefined()
    expect(heading(en.catchUpFirst)).toBeUndefined()
  })
})

describe('the roadmap marks the weeks gone by that still have items open', () => {
  /** Each week's row in the roadmap, by its label. */
  const weekRow = (label) =>
    [...region(en.fullCurriculumAria).querySelectorAll('button[aria-controls^="week-panel-"]')].find(
      (b) => b.querySelector('p')?.textContent === label,
    )
  const tile = (row) => row.querySelector('span')
  const chips = (row) => [...row.querySelectorAll('.alx-chip')].map((c) => c.textContent.trim())

  it('in amber, with how many are overdue, where they wore the grey of weeks to come', () => {
    renderDa(before(3))
    // Week 3 has four lessons, Week 4 two, Week 5 one, Week 6 two.
    for (const [week, open] of [[3, 4], [4, 2], [5, 1], [6, 2]]) {
      const row = weekRow(en.weekRange(week, week))
      expect(tile(row).className, `Week ${week}`).toContain('bg-amber')
      expect(chips(row), `Week ${week}`).toEqual([en.overdueChip(open)])
    }
  })

  it('leaves finished weeks green, this week current and weeks to come grey', () => {
    renderDa(before(3))
    const done = weekRow(en.weekRange(1, 1))
    expect(tile(done).className).toContain('bg-alxgreen')
    expect(chips(done)).toEqual([])

    const current = weekRow(en.weekRange(7, 7))
    expect(tile(current).className).toContain('bg-lime')
    expect(chips(current)).toEqual([en.current])

    const ahead = weekRow(en.weekRange(8, 8))
    expect(tile(ahead).className).not.toContain('bg-amber')
    expect(chips(ahead)).toEqual([])
  })

  it('marks nothing overdue for a learner on track, or before the course begins', () => {
    const overdueChips = () =>
      [...region(en.fullCurriculumAria).querySelectorAll('.alx-chip')].filter((c) =>
        c.textContent.includes('overdue'),
      )
    render({
      program: 'da',
      startDate: iso(-24),
      completedLessons: JSON.stringify(before(4)),
      'alx-celebrated': allCelebrated,
    })
    expect(overdueChips()).toHaveLength(0)
    act(() => root.unmount())
    window.localStorage.clear()

    render({ program: 'da', startDate: iso(10) })
    expect(overdueChips()).toHaveLength(0)
  })

  it.each(langs)('counts them in the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    renderDa(before(3), { 'alx-lang': lang })
    const row = [
      ...container.querySelectorAll('button[aria-controls^="week-panel-"]'),
    ].find((b) => b.querySelector('p')?.textContent === t.weekRange(3, 3))
    expect(chips(row)).toEqual([t.overdueChip(4, 'lesson')])
  })
})
