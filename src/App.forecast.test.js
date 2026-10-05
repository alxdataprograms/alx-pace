// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { formatHumanDate } from './lib/formatDate'
import { plannedEndDate, toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'

/*
  "Your pace" agrees with the status card above it.

  It extrapolated ticks per day across weeks of very different weight (Data
  Analytics' Weeks 1–4 hold 13 of its 27 lessons), so the two cards
  contradicted each other: "Right on pace" over "≈ 5 weeks ahead", "9 lessons
  from earlier weeks still open" over "≈ 11 weeks behind plan", and "≈ 27
  weeks behind" on a 22-week course. Its "Target" row repeated the hero's
  finish date.

  Now both read the learner's place in the schedule (paceStatus.test.js has
  the arithmetic). Asserted through what a learner reads, as the other App
  tests are.
*/

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

function render(program, startDate, done) {
  window.localStorage.setItem('program', program)
  window.localStorage.setItem('startDate', startDate)
  window.localStorage.setItem('completedLessons', JSON.stringify(done))
  window.localStorage.setItem('alx-celebrated', allCelebrated)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

/** Every item of `program` in the weeks before `week`. */
const upTo = (week, program = 'da') =>
  SCHEDULES[program].lessons.filter((l) => l.week < week).map((l) => l.id)
const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
/**
 * Text as a learner reads it: no aria-hidden parts (the chip's held wordings),
 * and the no-break spaces that hold words together are spaces.
 */
const read = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent.replace(/\u00a0/g, ' ')
}
const status = () => read(region(en.pacingStatusAria))
const pace = () => read(region(en.yourPace))
/** The card's forecast: its projected finish, if any, and its verdict chip. */
const forecast = () => {
  const card = region(en.yourPace)
  const finishRow = card.querySelector('dd')
  return [finishRow && read(finishRow), read([...card.querySelectorAll('p')].at(-1))]
}
/** The planned finish of a Data Analytics course begun on `startDate`, moved by `days`. */
const finish = (startDate, days = 0) => {
  const d = plannedEndDate(startDate, da.totalDays)
  d.setDate(d.getDate() + days)
  return formatHumanDate(d, 'en')
}

describe('"Your pace" beside the status card', () => {
  it('is on track for the planned date when the status card says "Right on pace"', () => {
    // Day 24 is Week 4; Weeks 1–3 done. It said "≈ 5 weeks ahead of plan".
    render('da', iso(-24), upTo(4))
    expect(status()).toContain(en.statusOnTrack)
    expect(pace()).toContain(`On track for ${finish(iso(-24))}`)
    expect(pace()).not.toMatch(/ahead|behind/)
  })

  it('names the week to catch up from when the status card nudges', () => {
    // Day 45 is Week 7, with Weeks 3–6 open. It said "≈ 11 weeks behind plan".
    render('da', iso(-45), upTo(3))
    expect(status()).toContain(en.statusBehind(9))
    expect(pace()).toContain('≈ 4 weeks behind · oldest open: Week 3')
    expect(pace()).toContain(`${en.projectedFinishLabel}${finish(iso(-45), 28)}`)
  })

  it('stays on track for a week finished early, where the checklist offers "Get ahead"', () => {
    // Day 21 is Week 4's first; Weeks 1–4 done. It said "≈ 7 weeks ahead of plan".
    render('da', iso(-21), upTo(5))
    expect(status()).toContain(en.statusOnTrack)
    expect(pace()).toContain(`On track for ${finish(iso(-21))}`)
  })

  it('counts weeks a 22-week course can have: 4 behind, not 27', () => {
    // Day 40 is Week 6 of Content Creation, with 30 of Weeks 1–2's 42 items done.
    render('cc', iso(-40), upTo(3, 'cc').slice(0, 30))
    expect(status()).toContain(en.statusBehind(51, 'item'))
    expect(pace()).toContain('≈ 4 weeks behind · oldest open: Week 2')
  })

  it('no longer repeats the hero’s finish date in a "Target" row', () => {
    render('da', iso(-45), upTo(3))
    expect(pace()).not.toContain('Target')
  })

  it('turns on track with the status card when the last overdue lesson is ticked', () => {
    // Week 4, with Week 3's last lesson still open.
    render('da', iso(-24), upTo(4).slice(0, -1))
    expect(status()).toContain(en.statusBehind(1))
    expect(pace()).toContain('≈ 1 week behind · oldest open: Week 3')

    const catchUp = [...container.querySelectorAll('h3')].find(
      (h) => h.textContent === en.catchUpFirst,
    )
    click(catchUp.parentElement.querySelector('[role="checkbox"]'))
    expect(status()).toContain(en.statusOnTrack)
    expect(pace()).toContain(`On track for ${finish(iso(-24))}`)
  })

  it('moves when the week turns, not from one day to the next', () => {
    // 23:58 on day 46, in Week 7 (days 42–48); App re-reads the clock every minute.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 11, 23, 58))
    render('da', '2026-08-26', upTo(3))
    expect(status()).toContain(en.statusBehind(9))
    const inWeek7 = ['Dec 29, 2026', '≈ 4 weeks behind · oldest open: Week 3']
    expect(forecast()).toEqual(inWeek7)

    // Midnight into day 47: the same week, the same verdict and finish.
    act(() => vi.advanceTimersByTime(4 * 60_000))
    expect(forecast()).toEqual(inWeek7)

    // Midnight into day 49: Week 8, and Week 7's lesson is overdue too.
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58))
    act(() => vi.advanceTimersByTime(4 * 60_000))
    expect(status()).toContain(en.statusBehind(10))
    expect(forecast()).toEqual(['Jan 5, 2027', '≈ 5 weeks behind · oldest open: Week 3'])
  })
})
