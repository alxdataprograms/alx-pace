// @vitest-environment jsdom
import { act, createElement, createRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import CurrentFocusCard from './CurrentFocusCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { withKept } from '../hooks/useKeptInPlace'
import { SCHEDULES, contentWeeksAfter } from '../lib/schedule'
import { formatShortDate } from '../lib/formatDate'

/*
  Behaviour, not markup: what a learner can still reach after ticking.
  A row that vanished on tick could not be unticked from where it was, and the
  focused button disappeared from under keyboard and screen-reader users.
*/

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/**
 * Holds completion state the way useLearnerProfile does, and recomputes
 * `catchUp` from it. Any other prop goes to the card as it is.
 */
function Harness({ week, pool, ...rest }) {
  const [done, setDone] = useState(() => new Set())
  const toggle = (id) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return createElement(CurrentFocusCard, {
    week,
    completedSet: done,
    onToggle: toggle,
    catchUp: pool.filter((l) => !done.has(l.id)),
    ...rest,
  })
}

function render(props) {
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(Harness, props)))
  })
}

const boxes = () => [...container.querySelectorAll('[role="checkbox"]')]
const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** A box's accessible name: the lesson title its aria-labelledby points at. */
const nameOf = (box) => document.getElementById(box.getAttribute('aria-labelledby'))?.textContent
/**
 * What a learner sees and a screen reader reads: an element's text without
 * its aria-hidden parts, among them the wordings a changing text holds its
 * size with (SteadyText).
 */
const visible = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent
}

describe('the catch-up list', () => {
  const gd = SCHEDULES.gd
  const buffer = gd.weeks.find((w) => w.week === 13.5)
  const pool = gd.lessons.filter((l) => l.week < 13.5).slice(0, 10)

  it('keeps a ticked item on screen, struck through, so it can be unticked in place', () => {
    render({ week: buffer, pool })
    const first = boxes()[0]
    const name = nameOf(first)
    expect(name).toBe(pool[0].title)
    click(first)

    const again = boxes()[0]
    expect(again.getAttribute('aria-checked')).toBe('true')
    // Same row, same place — not replaced by the next open item.
    expect(again.closest('li').textContent).toContain(pool[0].title)

    click(again)
    expect(boxes()[0].getAttribute('aria-checked')).toBe('false')
    expect(nameOf(boxes()[0])).toBe(name)
  })

  it('keeps an item ticked by tapping its title in place, the same as by its box', () => {
    render({ week: buffer, pool })
    const title = document.getElementById(boxes()[0].getAttribute('aria-labelledby'))
    click(title)
    expect(boxes()[0].getAttribute('aria-checked')).toBe('true')
    expect(nameOf(boxes()[0])).toBe(pool[0].title)

    click(title)
    expect(boxes()[0].getAttribute('aria-checked')).toBe('false')
    expect(nameOf(boxes()[0])).toBe(pool[0].title)
  })

  it('still pulls the next open item in, so six stay open to work on', () => {
    render({ week: buffer, pool })
    click(boxes()[0])
    const open = boxes().filter((b) => b.getAttribute('aria-checked') === 'false')
    expect(open).toHaveLength(6)
  })

  it('shows the all-clear AND the last ticks once nothing is left open', () => {
    render({ week: buffer, pool: pool.slice(0, 2) })
    expect(visible(container)).not.toMatch(/all caught up/i)
    click(boxes()[0])
    click(boxes()[1])
    expect(boxes()).toHaveLength(2)
    expect(visible(container)).toMatch(/all caught up/i)
  })
})

/*
  "Catch up first": an ordinary week, for a learner with items still open from
  earlier weeks. Only a catch-up week listed them, and Data Analytics has none,
  so a behind DA learner read "9 lessons from earlier weeks still open" above a
  checklist holding this week's one lesson, and nothing to tick for the nine.
*/
describe('catch up first, in an ordinary week', () => {
  const en = translations.en
  const da = SCHEDULES.da
  const week7 = da.weeks.find((w) => w.week === 7)
  // Everything before Week 7, oldest first: 16 lessons when nothing is done.
  const overdue = da.lessons.filter((l) => l.week < 7)

  const headings = () => [...container.querySelectorAll('h3')].map((h) => h.textContent)
  /** The amber section: everything under its heading, the card's first h3. */
  const section = () => container.querySelector('h3')?.parentElement
  const boxesIn = (el) => [...el.querySelectorAll('[role="checkbox"]')]
  const titleOf = (box) => document.getElementById(box.getAttribute('aria-labelledby'))
  /** A row's week-and-module line: the paragraph above its title. */
  const metaOf = (box) => titleOf(box).previousElementSibling
  const open = (el) => boxesIn(el).filter((b) => b.getAttribute('aria-checked') === 'false')

  it('opens with the three oldest, above this week’s lessons under their own heading', () => {
    render({ week: week7, pool: overdue })
    expect(headings()).toEqual([en.catchUpFirst, en.thisWeek])
    expect(boxes().map(nameOf)).toEqual([
      ...overdue.slice(0, 3).map((l) => l.title),
      ...week7.lessons.map((l) => l.title),
    ])
    expect(boxesIn(section())).toHaveLength(3)
    expect(section().textContent).toContain(en.catchUpFirstMore(overdue.length - 3))
  })

  it('keeps a tick in place, struck through, and pulls the next oldest in, so three stay open', () => {
    render({ week: week7, pool: overdue })
    const first = boxes()[0]
    click(first)

    // The same row, still first, can be unticked where it is.
    expect(boxesIn(section())[0]).toBe(first)
    expect(first.getAttribute('aria-checked')).toBe('true')
    expect(titleOf(first).className).toContain('line-through')
    expect(open(section()).map(nameOf)).toEqual(overdue.slice(1, 4).map((l) => l.title))
    expect(section().textContent).toContain(en.catchUpFirstMore(overdue.length - 4))

    // Unticked, it is open again where it was, and the row it pulled in stays
    // too: nothing leaves the section during the visit.
    click(first)
    expect(boxesIn(section())[0]).toBe(first)
    expect(open(section()).map(nameOf)).toEqual(overdue.slice(0, 4).map((l) => l.title))
  })

  it.each(Object.keys(translations))('labels each item with its week and module in %s', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const t = translations[lang]
    render({ week: week7, pool: overdue })
    const meta = metaOf(boxes()[0])
    const { week, moduleCode } = overdue[0]
    // The week in the learner's language, not the sheet's English "Week 1".
    expect(meta.textContent).toBe(`${t.weekRange(week, week)} · ${moduleCode}`)
    // The line takes the language's direction; the code keeps its own, so
    // Arabic cannot reorder "DA-1" into "1-DA".
    expect(meta.getAttribute('dir')).toBe('auto')
    expect(meta.querySelector('[dir="ltr"]').textContent).toBe(moduleCode)
    expect(section().textContent).toContain(t.catchUpFirstMore(overdue.length - 3, 'lesson'))
  })

  it('says the learner is all caught up below the ticked rows, which stay', () => {
    render({ week: week7, pool: overdue.slice(0, 2) })
    const status = section().querySelector('[role="status"]')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')

    click(boxes()[0])
    click(boxes()[1])
    expect(boxesIn(section())).toHaveLength(2)
    expect(open(section())).toHaveLength(0)
    expect(status.textContent).toBe(en.catchUpFirstDone)
    // Below the rows, never above the ones just ticked.
    const list = section().querySelector('ul')
    expect(list.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // This week's lessons still follow under their heading.
    expect(headings()).toEqual([en.catchUpFirst, en.thisWeek])
  })

  it('hands its heading to the status card’s "Catch up now", ready to take focus', () => {
    const ref = createRef()
    render({ week: week7, pool: overdue, catchUpRef: ref })
    expect(ref.current.textContent).toBe(en.catchUpFirst)
    expect(ref.current.tabIndex).toBe(-1)
  })

  it('leaves the card exactly as it was for a learner with nothing overdue', () => {
    render({ week: week7, pool: [] })
    expect(headings()).toEqual([])
    expect(boxes().map(nameOf)).toEqual(week7.lessons.map((l) => l.title))
  })

  it('heads a long week too, above its "Show N done"', () => {
    const gd = SCHEDULES.gd
    const week9 = gd.weeks.find((w) => w.week === 9) // 31 items
    function Seeded() {
      const [done, setDone] = useState(() => new Set([week9.lessons[0].id]))
      const toggle = (id) => setDone((prev) => new Set(prev).add(id))
      const pool = gd.lessons.filter((l) => l.week < 9 && !done.has(l.id))
      return createElement(CurrentFocusCard, {
        week: week9,
        completedSet: done,
        onToggle: toggle,
        catchUp: pool,
        unit: 'item',
      })
    }
    root = createRoot(container)
    act(() => {
      root.render(createElement(LanguageProvider, null, createElement(Seeded)))
    })
    expect(headings()).toEqual([en.catchUpFirst, en.thisWeek])
    const thisWeek = [...container.querySelectorAll('h3')][1]
    const showDone = container.querySelector('button[aria-expanded]')
    expect(thisWeek.compareDocumentPosition(showDone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Three overdue, then the week's 30 still open; the done one is folded.
    expect(boxes()).toHaveLength(3 + 30)
  })

  it('stays out of a catch-up week, whose whole card is the catch-up list', () => {
    window.localStorage.setItem('alx-lang', 'ar')
    const t = translations.ar
    const gd = SCHEDULES.gd
    const buffer = gd.weeks.find((w) => w.week === 13.5)
    const pool = gd.lessons.filter((l) => l.week < 13.5).slice(0, 10)
    render({ week: buffer, pool })
    expect(headings()).not.toContain(t.catchUpFirst)
    expect(headings()).not.toContain(t.thisWeek)
    expect(boxes()).toHaveLength(6)
  })

  /*
    Creative Tech sets whole weeks aside for catching up, and they sat as
    dashed rows deep in the roadmap while a learner 51 items behind read only
    the count. The section now ends by naming the next of them, under the
    count of the rest: where a learner meets the size of the backlog, and
    without growing the status card above.
  */
  describe('the next catch-up week', () => {
    const cc = SCHEDULES.cc
    const week6 = cc.weeks.find((w) => w.week === 6)
    const ccOverdue = cc.lessons.filter((l) => l.week < 6)
    const nextCatchUp = { week: 10, date: new Date(2026, 9, 27) }
    const renderCc = (pool = ccOverdue) =>
      render({ week: week6, pool, unit: 'item', nextCatchUp })
    const line = () =>
      [...section().querySelectorAll('p')].find((p) => p.querySelector('.lucide-calendar-clock'))

    it.each(Object.keys(translations))('says which and from when, in %s', (lang) => {
      window.localStorage.setItem('alx-lang', lang)
      const t = translations[lang]
      renderCc()
      const date = formatShortDate(nextCatchUp.date, lang)
      expect(line().textContent).toBe(t.nextCatchUpWeek(10, date))
    })

    it('reads "Next catch-up week: Week 10, from Oct 27" under the count of the rest', () => {
      renderCc()
      expect(line().textContent.replace(/\u00a0/g, ' ')).toBe(
        'Next catch-up week: Week 10, from Oct 27',
      )
      const more = [...section().querySelectorAll('p')].find(
        (p) => p.textContent === en.catchUpFirstMore(ccOverdue.length - 3, 'item'),
      )
      expect(more.compareDocumentPosition(line()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('gives way to the all-clear with the last overdue item, the rows staying put', () => {
      renderCc(ccOverdue.slice(0, 2))
      expect(line()).toBeDefined()
      const [first, second] = boxesIn(section())
      click(first)
      expect(line()).toBeDefined()
      click(second)
      expect(line()).toBeUndefined()
      expect(boxesIn(section())).toEqual([first, second])
      expect(section().querySelector('[role="status"]').textContent).toBe(en.catchUpFirstDone)
    })

    it('is not there without a catch-up week ahead, so never in Data Analytics', () => {
      render({ week: week7, pool: overdue })
      expect(section().querySelector('.lucide-calendar-clock')).toBeNull()
      expect(section().textContent).not.toContain('Next catch-up week')
    })
  })
})

/*
  A catch-up week's list, grouped by week.

  Every row repeated its week above its title, "WEEK 12 · GD-4", in the
  sheet's English whatever the learner's language, and the list ended on plain
  text, "+8 more open — see the roadmap below". Now one heading per week names
  it in the learner's language with how many of its items are open, and a 44px
  "Show all 14" opens the whole list where it is.
*/
describe('a catch-up week’s list, grouped by week', () => {
  const en = translations.en
  const gd = SCHEDULES.gd
  const buffer = gd.weeks.find((w) => w.week === 13.5)
  // Weeks 12 (10 items) and 13 (4) open: what Week 13.5 asks to clear.
  const pool = gd.lessons.filter((l) => l.week === 12 || l.week === 13)
  const week12 = pool.filter((l) => l.week === 12)

  const headings = () => [...container.querySelectorAll('h3')].map(visible)
  const heading = (n) => container.querySelectorAll('h3')[n]
  const toggle = () => container.querySelector('button[aria-expanded]')
  const open = () => boxes().filter((b) => b.getAttribute('aria-checked') === 'false')

  it.each(Object.keys(translations))(
    'heads each week’s rows with the week and how many of its items are open, in %s',
    (lang) => {
      window.localStorage.setItem('alx-lang', lang)
      const t = translations[lang]
      render({ week: buffer, pool })
      const expected = `${t.weekRange(12, 12)} · GD-4\u00a0— ${t.catchUpWeekOpen(10)}`
      expect(headings()).toEqual([expected])
      // The module code keeps its own direction, so Arabic cannot turn it round.
      expect(heading(0).querySelector('[dir="ltr"]').textContent).toBe('GD-4')
    },
  )

  it('reads "Week 12 · GD-4 — 10 open", and no longer labels every row from the sheet', () => {
    render({ week: buffer, pool })
    expect(headings()[0].replace(/\u00a0/g, ' ')).toBe('Week 12 · GD-4 — 10 open')
    expect(boxes()).toHaveLength(6)
    // The rows carry their titles alone: the week line above each is gone.
    for (const box of boxes()) {
      const title = document.getElementById(box.getAttribute('aria-labelledby'))
      expect(title.previousElementSibling, nameOf(box)).toBeNull()
      expect(box.closest('li').textContent, nameOf(box)).not.toContain('GD-4')
    }
  })

  it('keeps a tick in place under its week, and counts the week down to "all done"', () => {
    render({ week: buffer, pool })
    const first = boxes()[0]
    click(first)
    expect(boxes()[0]).toBe(first)
    expect(first.getAttribute('aria-checked')).toBe('true')
    expect(headings()[0]).toContain(en.catchUpWeekOpen(9))
    // The next oldest joins below, so six stay open.
    expect(open()).toHaveLength(6)

    while (week12.some((l) => open().map(nameOf).includes(l.title))) {
      click(open().find((b) => week12.some((l) => l.title === nameOf(b))))
    }
    expect(headings()[0]).toContain(en.catchUpWeekOpen(0))
    expect(en.catchUpWeekOpen(0)).toBe('all done')
    // Week 13's own heading has joined, with its rows.
    expect(headings()[1]).toContain(en.catchUpWeekOpen(4))
  })

  it('opens in full from a 44px "Show all 14", in place, and closes again', () => {
    render({ week: buffer, pool })
    const button = toggle()
    expect(button.textContent).toBe(en.catchUpShowAll(14))
    expect(button.textContent).toBe('Show all 14')
    expect(button.className).toContain('min-h-[44px]')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    // It controls the list it sits under.
    const list = document.getElementById(button.getAttribute('aria-controls'))
    expect(list.contains(boxes()[0])).toBe(true)
    const shownFirst = boxes()

    click(button)
    expect(toggle()).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.textContent).toBe(en.catchUpShowFewer)
    expect(boxes()).toHaveLength(14)
    // In place: the six it showed are the six it starts with, still first.
    expect(boxes().slice(0, 6)).toEqual(shownFirst)
    expect(headings().map((h) => h.split('\u00a0')[0])).toEqual([
      `${en.weekRange(12, 12)} · GD-4`,
      `${en.weekRange(13, 13)} · GD-4`,
    ])
    expect(boxes().every((b) => list.contains(b))).toBe(true)

    click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.textContent).toBe(en.catchUpShowAll(14))
    expect(boxes()).toEqual(shownFirst)
  })

  it('keeps a row ticked in the open list when it closes, struck through where it was', () => {
    render({ week: buffer, pool })
    click(toggle())
    const later = boxes()[12] // Week 13's third item
    click(later)
    click(toggle())
    expect(boxes()).toHaveLength(7)
    expect(boxes()[6]).toBe(later)
    expect(later.getAttribute('aria-checked')).toBe('true')
    expect(toggle().textContent).toBe(en.catchUpShowAll(13))
  })

  it('brings "Show fewer" back on screen when closing the list lifts it above the top', () => {
    const scrolled = []
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      scrolled.push([this, options])
    }
    try {
      render({ week: buffer, pool })
      const button = toggle()
      click(button)
      // Still on screen after closing: nothing scrolls.
      click(button)
      expect(scrolled).toEqual([])

      // Lifted above the top of the screen: back up to its bottom edge.
      click(button)
      button.getBoundingClientRect = () => ({ top: -900, bottom: -856, height: 44 })
      click(button)
      expect(scrolled).toEqual([[button, { block: 'end' }]])
    } finally {
      delete Element.prototype.scrollIntoView
    }
  })

  it('offers no button while everything open fits in the list', () => {
    render({ week: buffer, pool: pool.slice(0, 6) })
    expect(toggle()).toBeNull()
    expect(boxes()).toHaveLength(6)
  })

  it('holds its sizes as the counts drop, every wording they can come to held, unread', () => {
    render({ week: buffer, pool })
    const held = (el) =>
      [...el.querySelectorAll('.invisible[aria-hidden="true"]')].map((s) => s.textContent)
    const intro = container.querySelector('section > p')
    const introHeld = [en.catchUpBody(14), en.catchUpBody(2), en.catchUpBody(1), en.catchUpAllClear]
    const countHeld = [10, 2, 1, 0].map((n) => en.catchUpWeekOpen(n))
    expect(held(intro)).toEqual(introHeld)
    expect(held(heading(0))).toEqual(countHeld)

    click(boxes()[0])
    expect(visible(intro)).toBe(en.catchUpBody(13))
    expect(held(intro)).toEqual(introHeld)
    expect(held(heading(0))).toEqual(countHeld)
  })
})

describe('withKept', () => {
  const a = { id: 'a', sequence: 1 }
  const b = { id: 'b', sequence: 2 }
  const c = { id: 'c', sequence: 3 }

  it('returns the visible list untouched when nothing was kept', () => {
    const visible = [a, c]
    expect(withKept(visible, new Map())).toBe(visible)
  })

  it('merges kept rows back in curriculum order, without duplicates', () => {
    expect(withKept([a, c], new Map([['b', b], ['a', a]]))).toEqual([a, b, c])
  })
})

describe('a long focus week', () => {
  const gd = SCHEDULES.gd
  const week9 = gd.weeks.find((w) => w.week === 9) // 31 items

  // Lets a test tick something "elsewhere" (the roadmap) while the card is up.
  let setFromOutside
  /** Like Harness, but starting with some of the week already done. */
  function Seeded({ week, initiallyDone }) {
    const [done, setDone] = useState(() => new Set(initiallyDone))
    setFromOutside = setDone
    const toggle = (id) =>
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    return createElement(CurrentFocusCard, { week, completedSet: done, onToggle: toggle })
  }
  const renderSeeded = (props) => {
    root = createRoot(container)
    act(() => {
      root.render(createElement(LanguageProvider, null, createElement(Seeded, props)))
    })
  }
  const toggleButton = () => container.querySelector('button[aria-expanded]')

  it('puts the next open item first, with finished ones folded away', () => {
    const doneIds = week9.lessons.slice(0, 10).map((l) => l.id)
    renderSeeded({ week: week9, initiallyDone: doneIds })
    expect(boxes()).toHaveLength(21)
    expect(boxes()[0].closest('li').textContent).toContain(week9.lessons[10].title)
    expect(toggleButton().getAttribute('aria-expanded')).toBe('false')
    expect(toggleButton().textContent).toContain('10')
  })

  it('unfolds back to the full week in curriculum order', () => {
    renderSeeded({ week: week9, initiallyDone: week9.lessons.slice(0, 10).map((l) => l.id) })
    click(toggleButton())
    expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
    expect(boxes()).toHaveLength(31)
    expect(boxes()[0].closest('li').textContent).toContain(week9.lessons[0].title)
    // The toggle controls the list it sits above.
    expect(document.getElementById(toggleButton().getAttribute('aria-controls'))).not.toBeNull()
  })

  it('does not fold away an item ticked on this visit', () => {
    renderSeeded({ week: week9, initiallyDone: [] })
    expect(toggleButton()).toBeNull()
    click(boxes()[0])
    expect(boxes()).toHaveLength(31)
    expect(boxes()[0].getAttribute('aria-checked')).toBe('true')
  })

  it('leaves a short week (every Data Analytics week) exactly as it was', () => {
    const da = SCHEDULES.da.weeks[0]
    renderSeeded({ week: da, initiallyDone: [da.lessons[0].id] })
    expect(toggleButton()).toBeNull()
    expect(boxes()).toHaveLength(da.lessons.length)
  })

  it('does not fold away an item ticked in the roadmap during this visit', () => {
    renderSeeded({ week: week9, initiallyDone: [] })
    act(() => setFromOutside(new Set([week9.lessons[0].id])))
    expect(toggleButton()).toBeNull()
    expect(boxes()[0].getAttribute('aria-checked')).toBe('true')
  })

  it('says the WEEK is done — not "all caught up" — below the list, in a live region', () => {
    const allButLast = week9.lessons.slice(0, -1).map((l) => l.id)
    renderSeeded({ week: week9, initiallyDone: allButLast })
    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(status.textContent).toBe('')

    const last = boxes()[0]
    click(last)
    // The row just ticked is still there and still first: nothing moved above it.
    expect(boxes()[0]).toBe(last)
    expect(status.textContent).toMatch(/this week is done/i)
    expect(status.textContent).not.toMatch(/caught up/i)
    // Below the list, never above the rows being ticked.
    const list = container.querySelector('ul')
    expect(list.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps the week-done note visible whether the done items are folded or not', () => {
    renderSeeded({ week: week9, initiallyDone: week9.lessons.map((l) => l.id) })
    expect(container.textContent).toMatch(/this week is done/i)
    click(toggleButton())
    expect(container.textContent).toMatch(/this week is done/i)
  })
})

/*
  A week done early. A learner who finished it came back the next day to a card
  of crossed-out rows and no next step; Data Analytics' short weeks did not even
  say the week was done. Now a week done before the visit folds behind "Show N
  done", says so, and "Get ahead" lists the first open items of the next week
  with anything to tick.
*/
describe('a week done early', () => {
  const en = translations.en
  const da = SCHEDULES.da
  const week4 = da.weeks.find((w) => w.week === 4) // two lessons
  const week5 = da.weeks.find((w) => w.week === 5) // one lesson
  /** Every Data Analytics lesson up to and including `week`. */
  const doneThrough = (week) => da.lessons.filter((l) => l.week <= week).map((l) => l.id)

  // Lets a test untick something "elsewhere" (the roadmap) while the card is up.
  let setFromOutside
  /**
   * A learner with `initiallyDone` ticked on arrival. `overdue` is what App
   * counts as open from earlier weeks, recomputed from the ticks as App does.
   */
  function Learner({ week, initiallyDone, overdue = [], ...rest }) {
    const [done, setDone] = useState(() => new Set(initiallyDone))
    setFromOutside = setDone
    const toggle = (id) =>
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    return createElement(CurrentFocusCard, {
      week,
      completedSet: done,
      onToggle: toggle,
      catchUp: overdue.filter((l) => !done.has(l.id)),
      ...rest,
    })
  }
  const renderLearner = (props) => {
    root = createRoot(container)
    act(() => {
      root.render(createElement(LanguageProvider, null, createElement(Learner, props)))
    })
  }
  /** DA's Week 4, as App passes it: everything after it with something to tick. */
  const daWeek4 = (initiallyDone) =>
    renderLearner({ week: week4, initiallyDone, upcoming: contentWeeksAfter(da, 4), unit: 'lesson' })

  const gd = SCHEDULES.gd
  const week11 = gd.weeks.find((w) => w.week === 11) // after Week 10, a catch-up week
  /** Graphic Design's Week 9, all 31 items done before the visit. */
  const gdWeek9Done = () =>
    renderLearner({
      week: gd.weeks.find((w) => w.week === 9),
      initiallyDone: gd.lessons.filter((l) => l.week <= 9).map((l) => l.id),
      upcoming: contentWeeksAfter(gd, 9),
      unit: 'item',
    })

  const toggleButton = () => container.querySelector('button[aria-expanded]')
  /** This week's live region: the one under the week's own list. */
  const weekNote = () => [...container.querySelectorAll('[role="status"]')].pop()
  const aheadHeading = (t = en) =>
    [...container.querySelectorAll('h3')].find((h) => h.textContent.startsWith(t.getAhead))
  const aheadSection = () => aheadHeading()?.parentElement
  const boxesIn = (el) => [...el.querySelectorAll('[role="checkbox"]')]
  const titleOf = (box) => document.getElementById(box.getAttribute('aria-labelledby'))
  const open = (el) => boxesIn(el).filter((b) => b.getAttribute('aria-checked') === 'false')
  const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it('folds a short week done before the visit behind "Show 2 done", and says the week is done', () => {
    daWeek4(doneThrough(4))
    expect(toggleButton().textContent).toBe(en.showDone(2))
    expect(toggleButton().getAttribute('aria-expanded')).toBe('false')
    // No crossed-out rows of this week: the only row is next week's.
    expect(boxes().map(nameOf)).toEqual(week5.lessons.map((l) => l.title))
    expect(weekNote().textContent).toBe(en.weekAllDone)

    click(toggleButton())
    expect(boxes().map(nameOf)).toEqual([...week4.lessons, ...week5.lessons].map((l) => l.title))
    expect(weekNote().textContent).toBe(en.weekAllDone)
  })

  it('follows the note with "Get ahead · Week 5 · DA-2" and next week’s lesson, without the lime of a lesson due', () => {
    daWeek4(doneThrough(4))
    const heading = aheadHeading()
    expect(heading.textContent).toBe(`${en.getAhead} · ${en.weekRange(5, 5)} · DA-2`)
    expect(follows(weekNote(), heading)).toBe(true)
    const rows = boxesIn(aheadSection())
    expect(rows.map(nameOf)).toEqual(week5.lessons.map((l) => l.title))
    for (const box of rows) {
      expect(box.getAttribute('aria-checked')).toBe('false')
      expect(box.closest('li').className).not.toContain('bg-lime')
    }
    // This week's own rows keep it.
    click(toggleButton())
    expect(boxes()[0].closest('li').className).toContain('bg-lime/10')
  })

  it.each(Object.keys(translations))('names the week and counts lessons in the learner’s language (%s)', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const t = translations[lang]
    daWeek4(doneThrough(4))
    expect(toggleButton().textContent).toBe(t.showDone(2, 'lesson'))
    const heading = aheadHeading(t)
    expect(heading.textContent).toBe(`${t.getAhead} · ${t.weekRange(5, 5)} · DA-2`)
    // The code keeps its own direction, so Arabic cannot turn "DA-2" into "2-DA".
    expect(heading.querySelector('[dir="ltr"]').textContent).toBe('DA-2')
  })

  it('skips a catch-up week, lists three, and says how many more wait in that week', () => {
    gdWeek9Done()
    expect(aheadHeading().textContent).toBe(`${en.getAhead} · ${en.weekRange(11, 11)} · GD-4`)
    expect(boxesIn(aheadSection()).map(nameOf)).toEqual(week11.lessons.slice(0, 3).map((l) => l.title))
    expect(aheadSection().textContent).toContain(en.getAheadMore(week11.lessons.length - 3, 11, 'item'))
  })

  it('keeps a tick in place, struck through, and pulls the next item in, as the catch-up lists do', () => {
    gdWeek9Done()
    const first = boxesIn(aheadSection())[0]
    click(first)

    expect(boxesIn(aheadSection())[0]).toBe(first)
    expect(first.getAttribute('aria-checked')).toBe('true')
    expect(titleOf(first).className).toContain('line-through')
    expect(open(aheadSection()).map(nameOf)).toEqual(week11.lessons.slice(1, 4).map((l) => l.title))
    expect(aheadSection().textContent).toContain(en.getAheadMore(week11.lessons.length - 4, 11, 'item'))

    // Unticked, it is open again where it was, and the row it pulled in stays.
    click(first)
    expect(boxesIn(aheadSection())[0]).toBe(first)
    expect(open(aheadSection()).map(nameOf)).toEqual(week11.lessons.slice(0, 4).map((l) => l.title))
  })

  it('moves on past a week already done', () => {
    daWeek4(doneThrough(5))
    expect(aheadHeading().textContent).toBe(`${en.getAhead} · ${en.weekRange(6, 6)} · DA-3`)
  })

  it('offers nothing ahead after the programme’s last week with content, but still says it is done', () => {
    const cc = SCHEDULES.cc
    const week21 = cc.weeks.find((w) => w.week === 21) // Week 22 is a catch-up week
    renderLearner({
      week: week21,
      initiallyDone: week21.lessons.map((l) => l.id),
      upcoming: contentWeeksAfter(cc, 21),
      unit: 'item',
    })
    expect(weekNote().textContent).toBe(en.weekAllDone)
    expect(aheadHeading()).toBeUndefined()
  })

  it('is not offered while anything is overdue: that learner catches up first', () => {
    const week7 = da.weeks.find((w) => w.week === 7)
    renderLearner({
      week: week7,
      initiallyDone: [...doneThrough(2), ...week7.lessons.map((l) => l.id)],
      overdue: da.lessons.filter((l) => l.week < 7),
      upcoming: contentWeeksAfter(da, 7),
      unit: 'lesson',
    })
    expect([...container.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      en.catchUpFirst,
      en.thisWeek,
    ])
    expect(weekNote().textContent).toBe(en.weekAllDone)
    expect(aheadHeading()).toBeUndefined()
  })

  it('finished during the visit: the rows stay put, and the note and "Get ahead" appear below them', () => {
    daWeek4(doneThrough(4).slice(0, -1))
    expect(weekNote().textContent).toBe('')
    expect(aheadHeading()).toBeUndefined()
    const [first, last] = boxes()

    click(last)
    // Nothing folds on a tick: both rows are where they were, the last one
    // ticked, so a mis-tap can be undone on the spot.
    expect(toggleButton()).toBeNull()
    expect(boxes().slice(0, 2)).toEqual([first, last])
    expect(last.getAttribute('aria-checked')).toBe('true')
    expect(weekNote().textContent).toBe(en.weekAllDone)
    expect(follows(last, weekNote())).toBe(true)
    expect(follows(weekNote(), aheadHeading())).toBe(true)

    click(last)
    expect(weekNote().textContent).toBe('')
    expect(aheadHeading()).toBeUndefined()
  })

  it('leaves a week part-way through exactly as it was: no fold, no note, nothing ahead', () => {
    daWeek4(doneThrough(3))
    expect(toggleButton()).toBeNull()
    expect(boxes().map(nameOf)).toEqual(week4.lessons.map((l) => l.title))
    expect(weekNote().textContent).toBe('')
    expect(aheadHeading()).toBeUndefined()
  })

  /** Ticks or unticks `id` as the roadmap below would: from outside the card. */
  const fromRoadmap = (id) =>
    act(() =>
      setFromOutside((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    )

  it('keeps the place of "Show 1 done" when its one lesson is unticked, so the row stays put', () => {
    renderLearner({
      week: week5,
      initiallyDone: doneThrough(5),
      upcoming: contentWeeksAfter(da, 5),
      unit: 'lesson',
    })
    click(toggleButton())
    const row = boxes()[0]
    expect(nameOf(row)).toBe(week5.lessons[0].title)
    const slot = row.closest('ul').previousElementSibling
    expect(slot).toBe(toggleButton())

    click(row)
    // Nothing left to fold: the toggle is gone from sight and from the
    // keyboard, its 48px kept, so the row just unticked does not move up.
    expect(row.isConnected).toBe(true)
    expect(row.getAttribute('aria-checked')).toBe('false')
    expect(toggleButton()).toBeNull()
    const held = row.closest('ul').previousElementSibling
    expect(held.getAttribute('aria-hidden')).toBe('true')
    expect(held.className).toContain('invisible')
    expect(held.className).toContain('min-h-[44px]')
    expect(held.querySelector('button, [tabindex]')).toBeNull()
  })

  describe('a tick in the roadmap below changes no section of the card', () => {
    it('finishing the week there brings neither the note nor "Get ahead" until the next visit', () => {
      daWeek4(doneThrough(4).slice(0, -1))
      fromRoadmap(week4.lessons[1].id)
      expect(boxes().every((b) => b.getAttribute('aria-checked') === 'true')).toBe(true)
      expect(visible(weekNote())).toBe('')
      expect(aheadHeading()).toBeUndefined()
    })

    it('unticking a lesson there of a week done on arrival keeps it in the fold, which counts what is done', () => {
      daWeek4(doneThrough(4))
      expect(toggleButton().textContent).toBe(en.showDone(2))
      fromRoadmap(week4.lessons[0].id)
      // Not back in the list above the roadmap: the fold holds it still.
      expect(boxes().map(nameOf)).toEqual(week5.lessons.map((l) => l.title))
      expect(toggleButton().textContent).toBe(en.showDone(1))
      // Opened, the week is there in full, the unticked lesson open.
      click(toggleButton())
      expect(boxes().slice(0, 2).map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    })

    it('brings the rows back once nothing in the fold is done, as before', () => {
      daWeek4(doneThrough(4))
      fromRoadmap(week4.lessons[0].id)
      fromRoadmap(week4.lessons[1].id)
      expect(toggleButton()).toBeNull()
      expect(boxes().slice(0, 2).map(nameOf)).toEqual(week4.lessons.map((l) => l.title))
    })

    it('undoing a week done on arrival there keeps "Get ahead", and the note’s place, unread', () => {
      daWeek4(doneThrough(4))
      fromRoadmap(week4.lessons[0].id)
      expect(aheadHeading()).toBeDefined()
      expect(visible(weekNote())).toBe('')
      expect(weekNote().querySelector('[aria-hidden="true"]').className).toContain('invisible')
      // Ticked there again, the note reads where it was.
      fromRoadmap(week4.lessons[0].id)
      expect(visible(weekNote())).toBe(en.weekAllDone)
    })

    it('ticking a "Get ahead" item there keeps its row, struck through, and pulls none in', () => {
      gdWeek9Done()
      const first = boxesIn(aheadSection())[0]
      fromRoadmap(week11.lessons[0].id)
      expect(boxesIn(aheadSection())[0]).toBe(first)
      expect(first.getAttribute('aria-checked')).toBe('true')
      expect(boxesIn(aheadSection())).toHaveLength(3)
    })

    const week7 = da.weeks.find((w) => w.week === 7)
    const behindWeek7 = (open) =>
      renderLearner({
        week: week7,
        initiallyDone: doneThrough(6).filter((id) => !open.includes(id)),
        overdue: da.lessons.filter((l) => l.week < 7),
        upcoming: contentWeeksAfter(da, 7),
        unit: 'lesson',
      })
    const headings = () => [...container.querySelectorAll('h3')].map((h) => h.textContent)

    it('clearing the last overdue item there leaves "Catch up first" as it was, the row struck through', () => {
      const last = da.lessons.filter((l) => l.week === 6).pop()
      behindWeek7([last.id])
      const row = boxes()[0]
      expect(nameOf(row)).toBe(last.title)

      fromRoadmap(last.id)
      expect(headings()).toEqual([en.catchUpFirst, en.thisWeek])
      expect(row.isConnected).toBe(true)
      expect(row.getAttribute('aria-checked')).toBe('true')
      // The all-clear belongs under a tick made here, where it moves nothing.
      expect(container.textContent).not.toContain(en.catchUpFirstDone)
    })

    it('reopening an item there after the all-clear keeps the all-clear’s place, unread', () => {
      const last = da.lessons.filter((l) => l.week === 6).pop()
      behindWeek7([last.id])
      click(boxes()[0])
      const status = container.querySelector('[role="status"]')
      expect(status.textContent).toBe(en.catchUpFirstDone)

      fromRoadmap(da.lessons[0].id)
      expect(visible(status)).toBe('')
      expect(status.children).toHaveLength(1)
    })

    it('unticking an earlier lesson there does not bring "Catch up first" in mid-visit', () => {
      renderLearner({
        week: week7,
        initiallyDone: doneThrough(6),
        overdue: da.lessons.filter((l) => l.week < 7),
        upcoming: contentWeeksAfter(da, 7),
        unit: 'lesson',
      })
      expect(headings()).toEqual([])
      fromRoadmap(da.lessons[0].id)
      expect(headings()).toEqual([])
    })

    it('ticking overdue items there keeps the count line’s place once it has nothing to count', () => {
      // Weeks 4–6 open: five lessons, three listed, "+2 more overdue".
      const open = da.lessons.filter((l) => l.week >= 4 && l.week <= 6).map((l) => l.id)
      behindWeek7(open)
      const line = en.catchUpFirstMore(open.length - 3)
      expect([...container.querySelectorAll('p')].some((p) => p.textContent === line)).toBe(true)

      for (const id of open) fromRoadmap(id)
      const held = [...container.querySelectorAll('.invisible[aria-hidden="true"]')].find(
        (el) => el.textContent === line,
      )
      expect(held).toBeDefined()
    })
  })

  it('keeps "Get ahead" and its tick for the visit if the week above stops being done', () => {
    daWeek4(doneThrough(4))
    const ahead = boxesIn(aheadSection())[0]
    click(ahead)
    // A lesson of this week unticked in the roadmap below.
    act(() =>
      setFromOutside((prev) => {
        const next = new Set(prev)
        next.delete(week4.lessons[0].id)
        return next
      }),
    )
    // The note is gone from sight and from the screen reader, its place held
    // so the roadmap below, where the lesson was unticked, does not move.
    expect(visible(weekNote())).toBe('')
    expect(weekNote().children).toHaveLength(1)
    expect(ahead.isConnected).toBe(true)
    expect(ahead.getAttribute('aria-checked')).toBe('true')
    expect(aheadSection().contains(ahead)).toBe(true)
  })
})

/*
  "Next checkpoint". A long week stays open in full, in the sheet's order, and
  one line above its list names the first graded item still open and how many
  open items lead up to it, itself included. Graphic Design's Week 9 is 31
  items, graded at 9, 20 and 31, and nothing marked those out from the rows
  around them.
*/
describe('a long week’s next checkpoint', () => {
  const en = translations.en
  const gd = SCHEDULES.gd
  const week9 = gd.weeks.find((w) => w.week === 9) // 31 items
  const [quiz1, quiz2, mastery] = week9.gradedItems
  const ids = (items) => items.map((l) => l.id)

  /** A learner with `initiallyDone` ticked on arrival, as App passes the card. */
  function Learner({ week, initiallyDone = [], overdue = [], unit = 'item' }) {
    const [done, setDone] = useState(() => new Set(initiallyDone))
    const toggle = (id) =>
      setDone((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    return createElement(CurrentFocusCard, {
      week,
      completedSet: done,
      onToggle: toggle,
      catchUp: overdue.filter((l) => !done.has(l.id)),
      unit,
    })
  }
  const renderLearner = (props) => {
    root = createRoot(container)
    act(() => {
      root.render(createElement(LanguageProvider, null, createElement(Learner, props)))
    })
  }
  const remount = (props) => {
    act(() => root.unmount())
    renderLearner(props)
  }

  /** What a learner reads, and a screen reader says: the text outside aria-hidden. */
  const spoken = (el) =>
    [...el.childNodes]
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        return node.getAttribute('aria-hidden') === 'true' ? '' : spoken(node)
      })
      .join('')
  /** The line, found by what it says. */
  const lineSaying = (text) => [...container.querySelectorAll('p')].find((p) => spoken(p).startsWith(text))
  const checkpoint = (t = en) => lineSaying(t.nextCheckpoint)
  const says = (item, away, t = en) =>
    `${t.nextCheckpoint} ${item.title}\u00a0· ${t.checkpointAway(away, 'item')}`
  const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  const boxNamed = (title) => boxes().find((b) => nameOf(b) === title)

  it('names the first graded item and how far off it is, above a week left open in full', () => {
    renderLearner({ week: week9 })
    const line = checkpoint()
    expect(spoken(line)).toBe(says(quiz1, 9))
    // Every one of the week's 31 rows is still there, in the sheet's order.
    expect(boxes().map(nameOf)).toEqual(week9.lessons.map((l) => l.title))
    expect(follows(line, container.querySelector('ul'))).toBe(true)
    // Not announced on every tick: the checkbox already says what changed.
    expect(line.closest('[aria-live]')).toBeNull()
    expect(line.getAttribute('role')).toBeNull()
  })

  it('draws nearer with each tick on the way, and moves on once the checkpoint is ticked', () => {
    renderLearner({ week: week9 })
    const line = checkpoint()
    click(boxes()[0])
    expect(spoken(line)).toBe(says(quiz1, 8))
    click(boxes()[0])
    expect(spoken(line)).toBe(says(quiz1, 9))

    for (const item of week9.lessons.slice(0, 9)) click(boxNamed(item.title))
    expect(spoken(line)).toBe(says(quiz2, 11))
    // Ticked rows stay where they were: nothing in the week folds on a tick.
    expect(boxes()).toHaveLength(31)
  })

  it('counts only the open items, for a learner working out of order', () => {
    renderLearner({ week: week9, initiallyDone: [quiz1.id] })
    expect(spoken(checkpoint())).toBe(says(quiz2, 19))
  })

  it('turns into the all-done line in the same place when the last graded item is ticked', () => {
    renderLearner({ week: week9, initiallyDone: ids(week9.lessons.slice(0, -1)) })
    const line = checkpoint()
    expect(spoken(line)).toBe(says(mastery, 1))

    click(boxNamed(mastery.title))
    expect(line.isConnected).toBe(true)
    expect(spoken(line)).toBe(en.milestonesAllDone(3, 9))
    // Unticking brings the checkpoint back, in the same place again.
    click(boxNamed(mastery.title))
    expect(spoken(checkpoint())).toBe(says(mastery, 1))
    expect(checkpoint()).toBe(line)
  })

  it('keeps one height through the visit: every text it can show shares its place, unseen and unread', () => {
    renderLearner({ week: week9 })
    const line = checkpoint()
    const held = [...line.querySelectorAll('[aria-hidden="true"]')].filter((el) => el.tagName === 'SPAN')
    const texts = held.map((el) => el.textContent)
    for (const item of week9.gradedItems) {
      expect(texts.some((text) => text.includes(item.title))).toBe(true)
    }
    expect(texts).toContain(en.milestonesAllDone(3, 9))
    // Laid over the text in force (one grid cell), and invisible.
    const cell = line.querySelector('.grid')
    for (const el of [...cell.children]) expect(el.className).toContain('col-start-1 row-start-1')
    for (const el of held) expect(el.className).toContain('invisible')
  })

  it('shows nothing for a week with nothing graded left open on arrival', () => {
    renderLearner({ week: week9, initiallyDone: ids(week9.gradedItems) })
    expect(checkpoint()).toBeUndefined()
    expect(lineSaying(en.milestonesAllDone(3, 9))).toBeUndefined()
    expect(boxes()).toHaveLength(28)

    // Graphic Design's Week 11 is 14 items, none of them graded.
    remount({ week: gd.weeks.find((w) => w.week === 11) })
    expect(checkpoint()).toBeUndefined()
  })

  it('leaves every short week, so every Data Analytics week, without one', () => {
    renderLearner({ week: SCHEDULES.da.weeks[0], unit: 'lesson' })
    for (const week of SCHEDULES.da.weeks) {
      remount({ week, unit: 'lesson' })
      expect(checkpoint(), `Week ${week.week}`).toBeUndefined()
      expect(container.querySelector('.grid'), `Week ${week.week}`).toBeNull()
    }
  })

  it('sits under "This week" when the week opens with "Catch up first", above the fold', () => {
    const overdue = gd.lessons.filter((l) => l.week < 9)
    renderLearner({ week: week9, initiallyDone: [week9.lessons[0].id], overdue })
    const [catchUp, thisWeek] = [...container.querySelectorAll('h3')]
    expect([catchUp.textContent, thisWeek.textContent]).toEqual([en.catchUpFirst, en.thisWeek])
    const line = checkpoint()
    expect(spoken(line)).toBe(says(quiz1, 8))
    expect(follows(thisWeek, line)).toBe(true)
    expect(follows(line, container.querySelector('button[aria-expanded]'))).toBe(true)
  })

  it.each(Object.keys(translations))(
    'speaks the learner’s language (%s), the title the sheet’s English, kept left to right',
    (lang) => {
      window.localStorage.setItem('alx-lang', lang)
      const t = translations[lang]
      renderLearner({ week: week9 })
      const line = checkpoint(t)
      expect(spoken(line)).toBe(says(quiz1, 9, t))
      const title = [...line.querySelectorAll('[dir="ltr"]')].find(
        (el) => !el.closest('[aria-hidden="true"]'),
      )
      expect(title.textContent).toBe(quiz1.title)
    },
  )
})
