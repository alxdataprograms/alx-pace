// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'

/*
  A learner who finished the week early.

  They came back the next day to a checklist of crossed-out rows, with nothing
  saying the week was done (Data Analytics weeks are short, and only long weeks
  said so) and no next step: getting ahead, which is what turns the status card
  green, meant scrolling to the roadmap and opening next week. Below that, the
  graded card listed the week's finished assessments, struck through, in about
  300px.

  Now the week folds behind "Show N done", says it is done, and "Get ahead"
  offers the next week's first open items; the graded card is one green line.
  CurrentFocusCard.test.js and GradedMilestonesAlert.test.js cover the parts;
  this covers what App gives them: the weeks to look ahead to, and a graded
  card that decides afresh each visit and each week.

  Asserted through what a learner reads and can operate, as the other App
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

function render(storage) {
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}
/** Leaves the app and opens it again, with whatever it saved: the next visit. */
function revisit() {
  act(() => root.unmount())
  render({})
}

/** Every item of `program` up to and including `week`. */
const through = (week, program = 'da') =>
  SCHEDULES[program].lessons.filter((l) => l.week <= week).map((l) => l.id)
/** A Data Analytics learner `days` in, with these ticked. */
const renderDa = (days, done) =>
  render({
    program: 'da',
    startDate: iso(-days),
    completedLessons: JSON.stringify(done),
    'alx-celebrated': allCelebrated,
  })

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
const focusCard = (week) => region(en.focusAria(en.weekRange(week, week)))
const aheadHeading = () =>
  [...container.querySelectorAll('h3')].find((h) => h.textContent.startsWith(en.getAhead))
/** A card in <main> that reads exactly `text`: the graded card as one line. */
const lineCard = (text) => [...container.querySelector('main').children].find((el) => el.textContent === text)

describe('a learner who finished the week early', () => {
  // Day 24 is Data Analytics' Week 4, which holds two lessons.
  it('meets the week folded, the week-done note, "Get ahead" and a one-line graded card', () => {
    renderDa(24, through(4))
    const focus = focusCard(4)
    const toggle = focus.querySelector('button[aria-expanded]')
    expect(toggle.textContent).toBe(en.showDone(2))
    expect(focus.textContent).toContain(en.weekAllDone)
    expect(aheadHeading().textContent).toBe(`${en.getAhead} · ${en.weekRange(5, 5)} · DA-2`)
    expect(focus.contains(aheadHeading())).toBe(true)

    expect(region(en.milestonesAria)).toBeNull()
    expect(lineCard(en.milestonesAllDone(2, 4))).toBeDefined()
  })

  it('turns the status card to "ahead" with one tick under "Get ahead"', () => {
    // Day 3 is Week 1, done in full; Week 2 holds two lessons.
    renderDa(3, through(1))
    const status = region(en.pacingStatusAria)
    expect(status.textContent).toContain(en.statusOnTrack)
    expect(aheadHeading().textContent).toBe(`${en.getAhead} · ${en.weekRange(2, 2)} · DA-1`)

    click(aheadHeading().parentElement.querySelector('[role="checkbox"]'))
    expect(status.textContent).toContain(en.statusAhead(1, 'lesson'))
  })

  it('looks past a catch-up week: Content Creation’s Week 3 leads to Week 5', () => {
    // Day 16 is Week 3; Week 4 is a catch-up week with nothing of its own.
    render({
      program: 'cc',
      startDate: iso(-16),
      completedLessons: JSON.stringify(through(3, 'cc')),
      'alx-celebrated': allCelebrated,
    })
    expect(aheadHeading().textContent).toBe(`${en.getAhead} · ${en.weekRange(5, 5)} · CC-2`)
  })

  it('shows a learner part-way through the week the page exactly as before', () => {
    // Weeks 1–3 done, Week 4 not yet.
    renderDa(24, through(3))
    const focus = focusCard(4)
    expect(focus.querySelector('button[aria-expanded]')).toBeNull()
    expect(focus.textContent).not.toContain(en.weekAllDone)
    expect(aheadHeading()).toBeUndefined()
    expect(region(en.milestonesAria)).not.toBeNull()
  })
})

describe('the graded card, once the week’s graded items are done', () => {
  it('keeps its full size for the rest of the visit in which the last one is ticked, and is one line the next', () => {
    // Week 4's second lesson, and the Integrated Project it carries, still open.
    renderDa(24, through(4).slice(0, -1))
    const boxes = [...focusCard(4).querySelectorAll('[role="checkbox"]')]
    click(boxes[boxes.length - 1])
    // Shrinking now would pull the roadmap, open on this week too, up under
    // the learner's finger.
    expect(region(en.milestonesAria)).not.toBeNull()
    expect(lineCard(en.milestonesAllDone(2, 4))).toBeUndefined()

    revisit()
    expect(region(en.milestonesAria)).toBeNull()
    expect(lineCard(en.milestonesAllDone(2, 4))).toBeDefined()
  })

  it('decides afresh when the week turns at midnight in a tab left open', () => {
    // 23:58 on day 27, Week 4's last day; App re-reads the clock every minute.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58))
    // Weeks 1–3 done, and Week 5's one lesson, ahead of time; Week 4 open.
    const done = [...through(3), ...da.lessons.filter((l) => l.week === 5).map((l) => l.id)]
    render({
      program: 'da',
      startDate: '2026-09-16',
      completedLessons: JSON.stringify(done),
      'alx-celebrated': allCelebrated,
    })
    const week4 = da.weeks.find((w) => w.week === 4)
    expect(region(en.milestonesAria).textContent).toContain(en.milestonesDue(2, week4))

    act(() => vi.advanceTimersByTime(4 * 60_000))
    // Week 5's graded item was done before it began.
    expect(region(en.milestonesAria)).toBeNull()
    expect(lineCard(en.milestonesAllDone(1, 5))).toBeDefined()
  })
})
