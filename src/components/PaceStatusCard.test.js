// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import PaceStatusCard from './PaceStatusCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { computePaceStatus } from '../lib/paceStatus'
import { computePacing } from '../lib/pacing'
import { SCHEDULES } from '../lib/schedule'

/*
  A Creative Tech catch-up week, in the status card.

  The curriculum sets the week aside for the items still open, and the card
  greeted it with the amber alarm clock: "Catch-up nudge: 14 items from
  earlier weeks still open." Now it reads as the week's plan, in the lime of
  the focus card's catch-up icon: "Catch-up week: 14 items to clear · 5 days
  left (about 3 a day)", and "Catch-up week: you're all caught up." once
  nothing is left. Every other week's card is as it was.
*/

const langs = Object.keys(translations)
const en = translations.en
const START = new Date(2026, 2, 2)

/** The status of `program`, `day` days in, with these ticked. */
const statusAt = (program, day, done = []) => {
  const sch = SCHEDULES[program]
  const now = new Date(START)
  now.setDate(now.getDate() + day)
  return computePaceStatus(sch, new Set(done), computePacing(START, now, sch))
}
const ids = (program, keep) => SCHEDULES[program].lessons.filter(keep).map((l) => l.id)
/** Graphic Design's catch-up week 13.5 (days 88–94), with Weeks 12 and 13 open. */
const catchUpWeek = (day = 90, done = ids('gd', (l) => l.week < 12)) => statusAt('gd', day, done)

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
})

/** Renders the card, or updates the one on screen, as App re-renders it. */
function render(paceStatus) {
  root ??= createRoot(container)
  act(() => {
    root.render(
      createElement(LanguageProvider, null, createElement(PaceStatusCard, { paceStatus })),
    )
  })
}

const card = () => container.querySelector('section')
const headline = () => card().querySelector('p[tabindex="-1"]')
const subline = () => headline().nextElementSibling
/** What a learner sees and a screen reader reads: no aria-hidden parts. */
const visible = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent
}
/** The wordings held in place, invisible and unread. */
const heldInPlace = (el) =>
  [...el.querySelectorAll('.invisible[aria-hidden="true"]')].map((s) => s.textContent)
const plain = (text) => text.replace(/\u00a0/g, ' ')

describe('a catch-up week in the status card', () => {
  it('plans the open items over the days left, where it sounded the alarm', () => {
    render(catchUpWeek())
    expect(plain(visible(headline()))).toBe(
      'Catch-up week: 14 items to clear · 5 days left (about 3 a day)',
    )
    expect(visible(headline())).toBe(en.statusCatchUpWeek(14, 5, 3))
    expect(card().textContent).not.toContain(en.statusBehind(14, 'item'))
  })

  it('wears the focus card’s catch-up icon on a lime chip, and no amber', () => {
    render(catchUpWeek())
    expect(card().querySelector('.lucide-alarm-clock')).toBeNull()
    const icon = card().querySelector('.lucide-refresh-ccw')
    expect(icon.parentElement.className).toContain('bg-lime')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(card().className).not.toContain('amber')
    // The calm card of "Right on pace": the lime border is the checklist's.
    expect(card().className).not.toContain('border-lime')
  })

  it('names the week without saying "Catch-up week" twice', () => {
    render(catchUpWeek())
    expect(subline().textContent).toBe(en.weekOf(13.5, 32))
  })

  it('says the learner is all caught up once nothing is open, ahead or not', () => {
    render(catchUpWeek(90, ids('gd', (l) => l.week <= 13)))
    expect(visible(headline())).toBe(en.statusCatchUpWeekClear)
    expect(plain(en.statusCatchUpWeekClear)).toBe("Catch-up week: you're all caught up.")
    act(() => root.unmount())
    root = null

    // Three of Week 14.5 done as well: "ahead", but this week is for clearing.
    const next = SCHEDULES.gd.weeks.find((w) => w.week === 14.5).lessons.slice(0, 3)
    const ahead = catchUpWeek(90, [...ids('gd', (l) => l.week <= 13), ...next.map((l) => l.id)])
    expect(ahead.status).toBe('ahead')
    render(ahead)
    expect(visible(headline())).toBe(en.statusCatchUpWeekClear)
  })

  it('counts the days of the calendar, and drops the daily share on the last', () => {
    render(catchUpWeek(88))
    expect(visible(headline())).toBe(en.statusCatchUpWeek(14, 7, 2))
    act(() => root.unmount())
    root = null

    render(catchUpWeek(94))
    expect(plain(visible(headline()))).toBe('Catch-up week: 14 items to clear · 1 day left')
  })

  /*
    Ticks in the catch-up list below count the headline down, and its length
    changes with it. It holds the size of every wording it can come to this
    visit, so the list never moves under the learner's finger.
  */
  it('holds its size as the count drops, every wording it can come to in place and unread', () => {
    const arrival = catchUpWeek()
    render(arrival)
    const held = [
      en.statusCatchUpWeek(14, 5, 3),
      en.statusCatchUpWeek(2, 5, 1),
      en.statusCatchUpWeek(1, 5, 0),
      en.statusCatchUpWeekClear,
    ]
    expect(heldInPlace(headline())).toEqual(held)

    for (const left of [13, 1, 0]) {
      render({ ...arrival, behindCount: left })
      const say =
        left > 0 ? en.statusCatchUpWeek(left, 5, left > 1 ? 3 : 0) : en.statusCatchUpWeekClear
      expect(visible(headline()), `${left} left`).toBe(say)
      expect(heldInPlace(headline()), `${left} left`).toEqual(held)
    }
  })

  it.each(langs)('speaks the learner’s language (%s)', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const t = translations[lang]
    render(catchUpWeek())
    expect(visible(headline())).toBe(t.statusCatchUpWeek(14, 5, 3))
    expect(subline().textContent).toBe(t.weekOf(13.5, 32))
  })
})

describe('every other week', () => {
  it('keeps the amber nudge for a learner behind in an ordinary week', () => {
    // Graphic Design's Week 11 (day 72), with 11 of Week 9's items open.
    const week9 = SCHEDULES.gd.weeks.find((w) => w.week === 9).lessons
    const done = [...ids('gd', (l) => l.week < 9), ...week9.slice(0, 20).map((l) => l.id)]
    render(statusAt('gd', 72, done))
    expect(card().querySelector('.lucide-alarm-clock')).not.toBeNull()
    expect(card().className).toContain('amber')
    expect(headline().textContent).toBe(en.statusBehind(11, 'item'))
    expect(subline().textContent).toBe(`${en.weekOf(11, 32)} · ${en.doneThisWeek(0, 14)}`)
  })

  it('reads exactly as before for Data Analytics', () => {
    // Week 4, with Weeks 1–3 done: on track.
    render(statusAt('da', 24, ids('da', (l) => l.week < 4)))
    expect(card().querySelector('.lucide-circle-check-big')).not.toBeNull()
    expect(headline().textContent).toBe(en.statusOnTrack)
    expect(subline().textContent).toBe(
      `${en.weekOf(4, 14)} · ${en.doneThisWeek(0, 2)} · ${en.gradedStillDue(2)}`,
    )
  })
})
