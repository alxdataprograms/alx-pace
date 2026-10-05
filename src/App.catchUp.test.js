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

  /*
    Offered on arrival, as "Catch up first" is. A learner who falls behind
    during the visit, unticking an earlier lesson in the roadmap, finds both on
    the next visit: arriving mid-visit, they pushed the roadmap down under the
    finger that unticked it.
  */
  it('is not offered mid-visit to a learner who falls behind in the roadmap', () => {
    // Day 24 is Week 4; Weeks 1–3 are done.
    render({
      program: 'da',
      startDate: iso(-24),
      completedLessons: JSON.stringify(before(4)),
      'alx-celebrated': allCelebrated,
    })
    click(container.querySelector('button[aria-controls="week-panel-1"]'))
    const box = document.getElementById('week-panel-1').querySelector('[role="checkbox"]')
    click(box)
    expect(box.getAttribute('aria-checked')).toBe('false')
    // The status card says so, and nothing comes in above the roadmap.
    expect(region(en.pacingStatusAria).textContent).toContain(en.statusBehind(1, 'lesson'))
    expect(buttonNamed(en.catchUpNow)).toBeUndefined()
    expect(heading(en.catchUpFirst)).toBeUndefined()
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
  /** A row's chips as a learner sees them: none held unseen, each wording once. */
  const chips = (row) =>
    [...row.querySelectorAll('.alx-chip:not([aria-hidden="true"])')].map((chip) => {
      const copy = chip.cloneNode(true)
      for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
      return copy.textContent.trim()
    })
  const overdueChip = (row) => row.querySelector('.alx-chip.bg-amber\\/15')
  /** Opens a week in the roadmap and returns its boxes. */
  const boxesOf = (week) => {
    click(container.querySelector(`button[aria-controls="week-panel-${week}"]`))
    return [...document.getElementById(`week-panel-${week}`).querySelectorAll('[role="checkbox"]')]
  }

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

  /*
    The chip is taller than the week's label (68px against 64px), and in
    Arabic at 320px it wraps onto a line of its own (92px). Coming and going
    with the ticks, it moved the rows below it: the last overdue lesson ticked
    in the roadmap pulled its row up 4px, or 28px, under the finger.
  */
  it('holds a week’s chip in place, unseen, once its overdue lessons are ticked in the roadmap', () => {
    renderDa(before(3))
    const row = weekRow(en.weekRange(5, 5))
    const chip = overdueChip(row)
    const [box] = boxesOf(5)
    click(box)

    expect(tile(row).className).toContain('bg-alxgreen')
    expect(chips(row)).toEqual([])
    // The same chip, holding the row's height: unseen and unread.
    expect(overdueChip(row)).toBe(chip)
    expect(chip.className).toContain('invisible')
    expect(chip.getAttribute('aria-hidden')).toBe('true')

    click(box)
    expect(chips(row)).toEqual([en.overdueChip(1)])
    expect(chip.getAttribute('aria-hidden')).toBeNull()
  })

  it('holds the chip at the size of every count its week can come to', () => {
    renderDa(before(3))
    // Week 3: four lessons, all open. The count runs down as they are ticked,
    // and "2 en retard" wrapped at 320px where "1 en retard" fitted.
    for (const lang of langs) {
      const t = translations[lang]
      if (lang !== 'en') {
        act(() => root.unmount())
        container.innerHTML = ''
        renderDa(before(3), { 'alx-lang': lang })
      }
      const row = [...container.querySelectorAll('button[aria-controls^="week-panel-"]')].find(
        (b) => b.querySelector('p')?.textContent === t.weekRange(3, 3),
      )
      const held = [...overdueChip(row).querySelectorAll('.invisible[aria-hidden="true"]')].map(
        (span) => span.textContent,
      )
      expect(held, lang).toEqual([1, 2, 3, 4].map((n) => t.overdueChip(n, 'lesson')))
    }
  })

  it('turns a week amber when it comes undone during the visit, and chips it on the next', () => {
    // Day 24 is Week 4; Weeks 1–3 done.
    const storage = {
      program: 'da',
      startDate: iso(-24),
      completedLessons: JSON.stringify(before(4)),
      'alx-celebrated': allCelebrated,
    }
    render(storage)
    const row = () => weekRow(en.weekRange(2, 2))
    click(boxesOf(2)[0])

    expect(tile(row()).className).toContain('bg-amber')
    expect(overdueChip(row())).toBeNull()

    // The next visit lays the week out with its chip.
    const done = window.localStorage.getItem('completedLessons')
    act(() => root.unmount())
    container.innerHTML = ''
    render({ ...storage, completedLessons: done })
    expect(chips(row())).toEqual([en.overdueChip(1)])
  })

  it('chips the week just gone when the week turns at midnight, in a tab left open', () => {
    // 23:58 on day 27, the last day of Week 4, with Weeks 1–3 done.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 31, 23, 58))
      render({
        program: 'da',
        startDate: '2026-10-04',
        completedLessons: JSON.stringify(before(4)),
        'alx-celebrated': allCelebrated,
      })
      const week4 = () => weekRow(en.weekRange(4, 4))
      expect(chips(week4())).toEqual([en.current])

      // App re-reads the clock every minute: Week 5 is this week now.
      act(() => vi.advanceTimersByTime(4 * 60_000))
      expect(chips(week4())).toEqual([en.overdueChip(2)])
      expect(chips(weekRow(en.weekRange(5, 5)))).toEqual([en.current])
    } finally {
      vi.useRealTimers()
    }
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
