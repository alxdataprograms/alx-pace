// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { toISODateString } from './lib/pacing'
import { SCHEDULES } from './lib/schedule'

/*
  A learner with nothing in the program ticked yet.

  In the first week, the status card told someone who had done nothing "Right
  on pace — keep the streak alive.", and nothing anywhere said that lessons are
  taken on the ALX platform and ticked here. Now its headline says so, until
  the first tick.

  Past the first week, the learner has most often found Pace part-way through
  the course, and did the weeks before on ALX. The app's first words to them
  were "Catch-up nudge: 108 items from earlier weeks still open", and the only
  way to say otherwise was "Mark week complete", one roadmap week at a time.
  Now "Already started?" asks, under the status card, and "Yes, tick Weeks
  1–8" does it in one tap, without a LinkedIn dialogue for modules finished
  weeks ago, and with an Undo that takes back exactly that.

  A learner with anything ticked in the program sees neither. Asserted through
  what a learner reads and can operate, and what is saved, as the other App
  tests are. (AlreadyStartedCard.test.js covers the card on its own.)
*/

const langs = Object.keys(translations)
const en = translations.en
const { da, cc, gd } = SCHEDULES
/** A local calendar date `offsetDays` from today, as the date field stores it. */
const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISODateString(d)
}
const before = (schedule, week) => schedule.lessons.filter((l) => l.week < week).map((l) => l.id)

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
/** The next visit: the page loaded afresh over what is saved. */
function revisit() {
  act(() => root.unmount())
  render({})
}

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** As a keyboard user does it: focus the button, then activate it. */
const press = (el) => {
  el.focus()
  click(el)
}
const buttonNamed = (text) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
const status = () => region(en.pacingStatusAria)
const headline = () => status().querySelector('p[tabindex="-1"]')
/** The question card, by its heading. */
const card = (t = en) =>
  [...container.querySelectorAll('main > section h2')].find(
    (h) => h.textContent === t.alreadyStarted,
  )?.closest('section')
/** What a learner sees and a screen reader reads: no aria-hidden parts. */
const visible = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent
}
/** The wordings held in place, invisible and unread. */
const heldInPlace = (el) =>
  [...el.querySelectorAll('.invisible[aria-hidden="true"]')].map((s) => s.textContent)
const saved = (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null')
const focusBoxes = () =>
  [...region(en.focusAria(en.weekRange(1, 1))).querySelectorAll('[role="checkbox"]')]

describe('the first week, before anything in the program is ticked', () => {
  it.each(langs)('says how Pace works, where it said "keep the streak alive" (%s)', (lang) => {
    const t = translations[lang]
    render({ program: 'da', startDate: iso(-2), 'alx-lang': lang })
    const card = container.querySelector(`main > section[aria-label="${t.pacingStatusAria}"]`)
    const line = card.querySelector('p[tabindex="-1"]')
    expect(visible(line)).toBe(t.statusFirstWeek(1, 'lesson'))
    expect(visible(card)).not.toContain(t.statusOnTrack)
  })

  it('reads as plain English, true on the start date and on the week’s last day', () => {
    for (const day of [0, 6]) {
      render({ program: 'da', startDate: iso(-day) })
      expect(visible(headline()).replace(/\u00a0/g, ' ')).toBe(
        'Week 1 is under way. Study each lesson on ALX, then tick it off here.',
      )
      act(() => root.unmount())
      window.localStorage.clear()
    }
  })

  it('says "item" in Creative Tech, whose weeks hold activities and quizzes too', () => {
    render({ program: 'cc', startDate: iso(-2) })
    expect(visible(headline())).toBe(en.statusFirstWeek(1, 'item'))
    expect(visible(headline()).replace(/\u00a0/g, ' ')).toBe(
      'Week 1 is under way. Do each item on ALX, then tick it off here.',
    )
  })

  it('keeps the card’s figures and quote, and its focus on a setup step', () => {
    render({ program: 'da', startDate: iso(-2) })
    expect(status().textContent).toContain(en.weekOf(1, 14))
    expect(status().textContent).toContain(en.doneThisWeek(0, 5))
    expect(status().textContent).toContain(en.statusProgress(0, 0, 27))
    // The headline is still the place a setup step hands focus to.
    expect(headline().getAttribute('tabindex')).toBe('-1')
  })

  it('gives way to "Right on pace" at the first tick, in the place the how-to held', () => {
    render({ program: 'da', startDate: iso(-2) })
    click(focusBoxes()[0])
    expect(visible(headline())).toBe(en.statusOnTrack)
    // Held at the how-to's size, so the checklist below does not move up
    // under the finger that just ticked.
    expect(heldInPlace(headline())).toEqual([en.statusFirstWeek(1, 'lesson'), en.statusOnTrack])

    click(focusBoxes()[0])
    expect(visible(headline())).toBe(en.statusFirstWeek(1, 'lesson'))
  })

  it('counts only this program’s ticks', () => {
    render({ program: 'gd', startDate: iso(-2), completedLessons: JSON.stringify(da.lessons.map((l) => l.id)) })
    expect(visible(headline())).toBe(en.statusFirstWeek(1, 'item'))
  })

  it('leaves the card exactly as it was for a learner with a tick', () => {
    render({ program: 'da', startDate: iso(-2), completedLessons: JSON.stringify([da.lessons[0].id]) })
    expect(headline().textContent).toBe(en.statusOnTrack)
    expect(heldInPlace(status())).toEqual([])
    // Unticking it later in the visit does not bring the how-to back.
    click(focusBoxes()[0])
    expect(headline().textContent).toBe(en.statusOnTrack)
  })

  it('does not ask "Already started?": there is nothing before Week 1', () => {
    render({ program: 'da', startDate: iso(-2) })
    expect(card()).toBeUndefined()
  })
})

describe('"Already started?" for a learner who joins mid-course', () => {
  // Day 57 is Graphic Design's Week 9. Weeks 1–8 hold 108 items.
  const joinGd = (extra = {}) => render({ program: 'gd', startDate: iso(-57), ...extra })
  const weeks1to8 = before(gd, 9)

  it('asks, under the status card, which still counts the backlog', () => {
    joinGd()
    const sections = [...container.querySelectorAll('main > section')]
    const at = sections.indexOf(card())
    expect(sections[at - 1]).toBe(status())
    expect(sections[at + 1].getAttribute('aria-label')).toBe(en.focusAria(en.weekRange(9, 9)))
    expect(visible(headline())).toBe(en.statusBehind(108, 'item'))
    expect(card().querySelector('p').textContent).toBe(en.alreadyStartedAsk(9, en.programs.gd, 1, 8))
  })

  it('ticks every item of Weeks 1–8 with one tap, and nothing else', () => {
    joinGd()
    expect(weeks1to8).toHaveLength(108)
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    expect(saved('completedLessons')).toEqual(weeks1to8)
    // The status card above turns, and the card says what was done.
    expect(visible(headline())).toBe(en.statusOnTrack)
    expect(card().textContent).toContain(en.alreadyStartedDone(108, 'item'))
    expect(document.activeElement.textContent).toBe('Marked 108 items done')
  })

  it('opens no LinkedIn dialogue for the modules that completes, and keeps their Share button', () => {
    joinGd()
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(saved('alx-celebrated')).toEqual(['module:GD-1', 'module:GD-2'])
    for (const module of gd.modules.slice(0, 2)) {
      expect(container.querySelector(`button[aria-label="${en.roadmapShareAria(module.title)}"]`)).not.toBeNull()
    }
  })

  it('undoes exactly that: other programs’ ticks and celebrations stay as they were', () => {
    const daDone = da.lessons.map((l) => l.id)
    const daSeen = ['module:DA-1', 'module:DA-2', 'module:DA-3', 'module:DA-4', 'programme']
    joinGd({ completedLessons: JSON.stringify(daDone), 'alx-celebrated': JSON.stringify(daSeen) })
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    expect(saved('completedLessons')).toEqual([...daDone, ...weeks1to8])
    expect(saved('alx-celebrated')).toEqual([...daSeen, 'module:GD-1', 'module:GD-2'])

    press(buttonNamed(en.undo))
    expect(saved('completedLessons')).toEqual(daDone)
    expect(saved('alx-celebrated')).toEqual(daSeen)
    expect(visible(headline())).toBe(en.statusBehind(108, 'item'))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    // And asks again, with focus on the question.
    expect(document.activeElement).toBe(card().querySelector('p[tabindex="-1"]'))
  })

  it('lays the checklist out afresh: "Catch up first" goes with Yes, and comes back with Undo', () => {
    joinGd()
    const catchUp = () =>
      [...container.querySelectorAll('h3')].find((h) => h.textContent === en.catchUpFirst)
    expect(catchUp()).toBeDefined()
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    // Not left on screen, every row struck through, for weeks just said done.
    expect(catchUp()).toBeUndefined()
    press(buttonNamed(en.undo))
    expect(catchUp()).toBeDefined()
  })

  it('leaves a tick made after Yes when undoing', () => {
    joinGd()
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    const focus = region(en.focusAria(en.weekRange(9, 9)))
    click(focus.querySelector('[role="checkbox"]'))
    const week9First = gd.weeks.find((w) => w.week === 9).lessons[0].id
    press(buttonNamed(en.undo))
    expect(saved('completedLessons')).toEqual([week9First])
  })

  it('keeps the card for the visit when the learner ticks something else instead', () => {
    joinGd()
    const catchUp = [...container.querySelectorAll('h3')].find((h) => h.textContent === en.catchUpFirst)
    click(catchUp.parentElement.querySelector('[role="checkbox"]'))
    // Still asking: had it gone, everything below would have moved up under
    // the finger that ticked.
    expect(card().querySelector('p').textContent).toBe(en.alreadyStartedAsk(9, en.programs.gd, 1, 8))

    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    expect(card().textContent).toContain(en.alreadyStartedDone(107, 'item'))
    press(buttonNamed(en.undo))
    // The learner's own tick stays.
    expect(saved('completedLessons')).toEqual([weeks1to8[0]])
  })

  it('is gone on the next visit once anything is ticked, with nothing saved to say so', () => {
    joinGd()
    press(buttonNamed(en.alreadyStartedYes(1, 8)))
    revisit()
    expect(card()).toBeUndefined()
    expect(Object.keys(window.localStorage).sort()).toEqual([
      'alx-celebrated',
      'completedLessons',
      'program',
      'startDate',
    ])
  })

  it('"Not yet" puts it away for the visit and goes to "Catch up first"', () => {
    joinGd()
    press(buttonNamed(en.alreadyStartedNotYet))
    expect(card()).toBeUndefined()
    const target = [...container.querySelectorAll('h3')].find((h) => h.textContent === en.catchUpFirst)
    expect(document.activeElement).toBe(target)
    expect(scrolled).toEqual([[target, { block: 'start' }]])
    expect(saved('completedLessons')).toBeNull()

    // The next visit asks again: nothing is ticked yet.
    revisit()
    expect(card()).toBeDefined()
  })

  it('"Not yet" in a catch-up week goes to the list’s opening sentence', () => {
    // Day 90 is Graphic Design's Week 13.5, a catch-up week; Weeks 1–13 hold 167.
    render({ program: 'gd', startDate: iso(-90) })
    expect(card().querySelector('p').textContent).toBe(en.alreadyStartedAsk(13.5, en.programs.gd, 1, 13))
    press(buttonNamed(en.alreadyStartedNotYet))
    // The sentence holds its size with unread copies (SteadyText): what is read.
    expect(visible(document.activeElement)).toBe(en.catchUpBody(167))
    expect(document.activeElement.tagName).toBe('P')
    expect(scrolled).toEqual([[document.activeElement, { block: 'start' }]])
  })

  it('reaches the whole programme in its last week, and celebrates none of it', () => {
    // Day 150 is Content Creation's Week 22, a catch-up week after the last content.
    render({ program: 'cc', startDate: iso(-150) })
    press(buttonNamed(en.alreadyStartedYes(1, 21)))
    expect(saved('completedLessons')).toHaveLength(cc.totalLessons)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(saved('alx-celebrated')).toEqual([...cc.modules.map((m) => `module:${m.code}`), 'programme:cc'])
  })

  it('asks a Data Analytics learner in Week 6 about Weeks 1–5, in lessons', () => {
    render({ program: 'da', startDate: iso(-36) })
    expect(card().querySelector('p').textContent).toBe(en.alreadyStartedAsk(6, en.programs.da, 1, 5))
    press(buttonNamed(en.alreadyStartedYes(1, 5)))
    expect(document.activeElement.textContent).toBe('Marked 14 lessons done')
    expect(saved('completedLessons')).toEqual(before(da, 6))
  })

  it.each(langs)('asks in the learner’s language, naming the program in it (%s)', (lang) => {
    const t = translations[lang]
    joinGd({ 'alx-lang': lang })
    expect(card(t).querySelector('p').textContent).toBe(t.alreadyStartedAsk(9, t.programs.gd, 1, 8))
    press(buttonNamed(t.alreadyStartedYes(1, 8)))
    expect(document.activeElement.textContent).toBe(t.alreadyStartedDone(108, 'item'))
  })

  it('is not asked of a learner with a tick in this program, whose page is as it was', () => {
    // Day 45 is Data Analytics' Week 7, with Weeks 1–2 done: behind.
    render({ program: 'da', startDate: iso(-45), completedLessons: JSON.stringify(before(da, 3)) })
    expect(card()).toBeUndefined()
    expect(container.querySelectorAll('main > section[aria-labelledby]')).toHaveLength(0)
  })

  it('is asked when only another program has ticks', () => {
    joinGd({ completedLessons: JSON.stringify([da.lessons[0].id]) })
    expect(card()).toBeDefined()
  })

  it('follows a setup step: focus on the status card’s headline, the question next', () => {
    render({ program: 'gd' })
    const input = container.querySelector('main input[type="date"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, iso(-57))
    act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
    press(buttonNamed(en.startPacing))
    expect(document.activeElement).toBe(headline())
    expect(status().nextElementSibling).toBe(card())
  })
})
