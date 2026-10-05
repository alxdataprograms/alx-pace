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
function render(paceStatus, props = {}) {
  root ??= createRoot(container)
  act(() => {
    root.render(
      createElement(
        LanguageProvider,
        null,
        createElement(PaceStatusCard, { paceStatus, ...props }),
      ),
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
    expect(visible(headline())).toBe(en.statusBehind(11, 'item'))
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

/*
  The first week, before anything in the program is ticked. "Right on pace —
  keep the streak alive." spoke of a streak to someone with nothing done, and
  nothing said that lessons are taken on ALX and ticked here. The headline
  now says so, until the first tick; that brings "Right on pace" into the
  same space, so the checklist below stays where the learner's finger is.
*/
describe('the first week, before the first tick', () => {
  const howTo = () => en.statusFirstWeek(1, 'lesson')

  it('says how Pace works, in place of "keep the streak alive"', () => {
    // Day 2 of Data Analytics: Week 1, nothing ticked.
    render(statusAt('da', 2))
    expect(visible(headline())).toBe(howTo())
    expect(card().querySelector('.lucide-circle-check-big')).not.toBeNull()
    expect(subline().textContent).toBe(
      `${en.weekOf(1, 14)} · ${en.doneThisWeek(0, 5)} · ${en.gradedStillDue(2)}`,
    )
  })

  it('turns to "Right on pace" at the first tick, holding the how-to’s size', () => {
    const first = SCHEDULES.da.lessons[0].id
    render(statusAt('da', 2))
    render(statusAt('da', 2, [first]))
    expect(visible(headline())).toBe(en.statusOnTrack)
    expect(heldInPlace(headline())).toEqual([howTo(), en.statusOnTrack])
    // Unticked again, it is the how-to again, in the same space.
    render(statusAt('da', 2))
    expect(visible(headline())).toBe(howTo())
  })

  it('reads exactly as before for a learner who arrives with a tick', () => {
    render(statusAt('da', 2, [SCHEDULES.da.lessons[0].id]))
    expect(headline().textContent).toBe(en.statusOnTrack)
    expect(heldInPlace(card())).toEqual([])
    // Unticking it during the visit does not bring the how-to back.
    render(statusAt('da', 2))
    expect(headline().textContent).toBe(en.statusOnTrack)
  })

  it('leaves the nudge to a learner past Week 1 with nothing ticked', () => {
    render(statusAt('gd', 57))
    expect(visible(headline())).toBe(en.statusBehind(108, 'item'))
    expect(heldInPlace(card())).not.toContain(en.statusFirstWeek(9, 'item'))
  })

  it.each(langs)('speaks the learner’s language, in items for Creative Tech (%s)', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const t = translations[lang]
    render(statusAt('gd', 2))
    expect(visible(headline())).toBe(t.statusFirstWeek(1, 'item'))
  })
})

/*
  The headline through a visit. It holds the size of every wording the
  learner's own ticks on this screen can bring it, as the catch-up week's and
  the first week's do, so the rows being ticked below never move. Measured
  before: the first "Get ahead" tick took the French headline from two lines
  to one, and the last "Catch up first" tick took the Arabic one at 320px from
  three lines to two, each pulling the rows below up by 19px.
*/
describe('the headline through a visit', () => {
  it('behind: holds every count down to none, and the "Right on pace" that clears it', () => {
    render(statusAt('gd', 57))
    expect(heldInPlace(headline())).toEqual([
      en.statusBehind(108, 'item'),
      en.statusBehind(2, 'item'),
      en.statusBehind(1, 'item'),
      en.statusOnTrack,
    ])
    // Weeks 1–8 ticked in one go ("Already started?"): the same space.
    render(statusAt('gd', 57, ids('gd', (l) => l.week < 9)))
    expect(visible(headline())).toBe(en.statusOnTrack)
    expect(heldInPlace(headline())).toContain(en.statusBehind(108, 'item'))
  })

  it('behind and ahead too: clearing the backlog comes to the lead, held from the start', () => {
    // Graphic Design's Week 11 (day 72): 11 of Week 9 open, Week 12's 10 done.
    const week9 = SCHEDULES.gd.weeks.find((w) => w.week === 9).lessons
    const done = [
      ...ids('gd', (l) => l.week < 9 || l.week === 12),
      ...week9.slice(0, 20).map((l) => l.id),
    ]
    render(statusAt('gd', 72, done))
    expect(heldInPlace(headline())).toContain(en.statusAhead(10, 'item'))
    expect(heldInPlace(headline())).not.toContain(en.statusOnTrack)
  })

  it('a week done early: holds the lead each "Get ahead" tick brings, week after week', () => {
    // Data Analytics' Week 4 (day 24), done before the visit; "Get ahead"
    // offers Week 5's one lesson, then Week 6's two, and on: 23 in all.
    const done = ids('da', (l) => l.week <= 4)
    render(statusAt('da', 24, done), { aheadRoom: 23 })
    expect(heldInPlace(headline())).toEqual([
      en.statusOnTrack,
      ...[1, 2, 10, 11].map((n) => en.statusAhead(n, 'lesson')),
    ])
    // Its one lesson ticked, and one of Week 6's: two ahead, in the same space.
    const twoAhead = [...done, ...ids('da', (l) => l.week === 5), SCHEDULES.da.weeks[5].lessons[0].id]
    render(statusAt('da', 24, twoAhead), { aheadRoom: 23 })
    expect(visible(headline())).toBe(en.statusAhead(2, 'lesson'))
  })

  it('holds no lead beyond what is left to get ahead to', () => {
    // Week 13 done; Week 14's one lesson is all that is left.
    render(statusAt('da', 87, ids('da', (l) => l.week <= 13)), { aheadRoom: 1 })
    expect(heldInPlace(headline())).toEqual([en.statusOnTrack, en.statusAhead(1, 'lesson')])
  })

  it.each(langs)('holds the French two lines, and every language’s, for the lead (%s)', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const t = translations[lang]
    // Graphic Design's Week 9 done before the visit: "Get ahead" offers
    // Week 11's 14 items, then the weeks after.
    render(statusAt('gd', 57, ids('gd', (l) => l.week <= 9)), { aheadRoom: 300 })
    expect(heldInPlace(headline())).toEqual([
      t.statusOnTrack,
      t.statusAhead(1, 'item'),
      t.statusAhead(2, 'item'),
      t.statusAhead(10, 'item'),
      t.statusAhead(11, 'item'),
    ])
  })

  it('part-way through a week: holds the lead that finishing the week and "Get ahead" can bring', () => {
    // Week 4 open: finished on the card, it brings "Get ahead", and the lead.
    // The first tick there took the French headline from two lines to one.
    render(statusAt('da', 24, ids('da', (l) => l.week < 4)), { aheadRoom: 23 })
    expect(visible(headline())).toBe(en.statusOnTrack)
    expect(heldInPlace(headline())).toEqual([
      en.statusOnTrack,
      ...[1, 2, 10, 11].map((n) => en.statusAhead(n, 'lesson')),
    ])
  })

  it('says the lead in English in no more words than "Right on pace", so holding it costs no line', () => {
    // Measured in the browser: "…ahead of schedule. Excellent." took a second
    // line at 390px to 414px, where "Right on pace" took one.
    for (const unit of ['lesson', 'item']) {
      for (const n of [1, 2, 12, 99]) {
        expect(en.statusAhead(n, unit).length).toBeLessThanOrEqual(en.statusOnTrack.length)
      }
    }
  })
})
