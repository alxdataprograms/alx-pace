// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { formatShortDate } from './lib/formatDate'
import { dateOfDay, toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'

/*
  Creative Tech's catch-up weeks, calmer.

  The week the curriculum sets aside for catching up greeted a learner with the
  amber alarm clock, "Catch-up nudge: 14 items from earlier weeks still open",
  over a list whose every row repeated its week in the sheet's English and
  which ended on "+8 more open — see the roadmap below". A learner behind in
  an ordinary week never heard that such a week was coming.

  Now the status card plans the week ("Catch-up week: 14 items to clear · 5
  days left (about 3 a day)") and counts down with every tick in the list,
  which is grouped by week and opens in full where it is; and "Catch up first"
  names the next catch-up week. Data Analytics, which has none, reads as it
  did. Asserted through what a learner reads and can operate, as the other App
  tests are; PaceStatusCard.test.js and CurrentFocusCard.test.js have the
  details.
*/

const langs = Object.keys(translations)
const en = translations.en
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
const idsWhere = (program, keep) => SCHEDULES[program].lessons.filter(keep).map((l) => l.id)

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

/** A `program` learner who started on `startDate`, with `done` ticked, in `lang`. */
function render(program, startDate, done, lang = 'en') {
  const storage = {
    program,
    startDate,
    completedLessons: JSON.stringify(done),
    'alx-celebrated': allCelebrated,
    'alx-lang': lang,
  }
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}
/** Graphic Design 90 days in: Week 13.5, a catch-up week, with Weeks 12 and 13 open. */
const gdCatchUpWeek = (lang) => render('gd', iso(-90), idsWhere('gd', (l) => l.week < 12), lang)

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
/** The no-break spaces that hold words together, read as spaces. */
const plain = (text) => text.replace(/\u00a0/g, ' ')
/** Text as a learner sees it, and a screen reader reads it: no aria-hidden parts. */
const visible = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return plain(copy.textContent)
}
const headline = (t = en) => visible(region(t.pacingStatusAria).querySelector('p[tabindex="-1"]'))
const focusCard = () => container.querySelectorAll('main > section')[2]
const open = () =>
  [...focusCard().querySelectorAll('[role="checkbox"]')].filter(
    (b) => b.getAttribute('aria-checked') === 'false',
  )
const catchUpFirst = (t = en) =>
  [...container.querySelectorAll('h3')].find((h) => h.textContent === t.catchUpFirst)?.parentElement

describe('a Creative Tech catch-up week', () => {
  it('plans the open items over the days left, where the status card sounded the alarm', () => {
    gdCatchUpWeek()
    expect(headline()).toBe('Catch-up week: 14 items to clear · 5 days left (about 3 a day)')
    const status = region(en.pacingStatusAria)
    expect(status.textContent).not.toContain(en.statusBehind(14, 'item'))
    expect(status.querySelector('.lucide-alarm-clock')).toBeNull()
  })

  it('counts down with every tick in the list, to the all-clear in the same place', () => {
    gdCatchUpWeek()
    click(open()[0])
    expect(headline()).toBe('Catch-up week: 13 items to clear · 5 days left (about 3 a day)')

    click(focusCard().querySelector('button[aria-expanded]'))
    while (open().length > 0) click(open()[0])
    expect(headline()).toBe("Catch-up week: you're all caught up.")
    // The ticks stay where they were, all fourteen, struck through.
    expect(focusCard().querySelectorAll('[role="checkbox"]')).toHaveLength(14)
  })

  it('counts the days of the calendar: one fewer at midnight', () => {
    // 23:58 on day 90 of a course begun on July 13; App re-reads the clock every minute.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 11, 23, 58))
    render('gd', '2026-07-13', idsWhere('gd', (l) => l.week < 12))
    expect(headline()).toBe('Catch-up week: 14 items to clear · 5 days left (about 3 a day)')

    act(() => vi.advanceTimersByTime(4 * 60_000))
    expect(headline()).toBe('Catch-up week: 14 items to clear · 4 days left (about 4 a day)')
  })

  it.each(langs)('groups the list by week, and plans the week, in %s', (lang) => {
    const t = translations[lang]
    gdCatchUpWeek(lang)
    expect(headline(t)).toBe(plain(t.statusCatchUpWeek(14, 5, 3)))
    const headings = [...focusCard().querySelectorAll('h3')].map(visible)
    expect(headings).toEqual([`${t.weekRange(12, 12)} · GD-4 — ${t.catchUpWeekOpen(10)}`])
    const showAll = focusCard().querySelector('button[aria-expanded]')
    expect(showAll.textContent).toBe(t.catchUpShowAll(14))
  })
})

describe('the next catch-up week, for a learner who is behind', () => {
  it('is named under "Catch up first" in Content Creation', () => {
    // Day 40 is Week 6, with 51 items of Weeks 1–2 open; Week 10 begins on day 63.
    const start = iso(-40)
    render('cc', start, idsWhere('cc', (l) => l.week < 3).slice(0, 30))
    const date = formatShortDate(dateOfDay(start, 63), 'en')
    expect(visible(catchUpFirst())).toContain(`Next catch-up week: Week 10, from ${date}`)
    // The status card is as it was: the line is the checklist's.
    expect(region(en.pacingStatusAria).textContent).not.toContain('Next catch-up week')
  })

  it.each(langs)('names Graphic Design’s Week 13.5 and its date in %s', (lang) => {
    const t = translations[lang]
    // Day 72 is Week 11, with 11 of Week 9's items open; Week 13.5 begins on day 88.
    const start = iso(-72)
    const week9 = SCHEDULES.gd.weeks.find((w) => w.week === 9).lessons
    const done = [...idsWhere('gd', (l) => l.week < 9), ...week9.slice(0, 20).map((l) => l.id)]
    render('gd', start, done, lang)
    const date = formatShortDate(dateOfDay(start, 88), lang)
    expect(visible(catchUpFirst(t))).toContain(plain(t.nextCatchUpWeek(13.5, date)))
  })

  it('is never there for Data Analytics, which has no catch-up weeks', () => {
    // Day 45 is Week 7, with Weeks 3–6 open.
    render('da', iso(-45), idsWhere('da', (l) => l.week < 3))
    const section = catchUpFirst()
    expect(section).toBeDefined()
    expect(section.querySelector('.lucide-calendar-clock')).toBeNull()
    expect(container.textContent).not.toContain('Next catch-up week')
  })
})
