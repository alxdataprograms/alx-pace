// @vitest-environment jsdom
import { act, createElement, createRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import CurrentFocusCard from './CurrentFocusCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { withKept } from '../hooks/useKeptInPlace'
import { SCHEDULES } from '../lib/schedule'

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
    click(boxes()[0])
    click(boxes()[1])
    expect(boxes()).toHaveLength(2)
    expect(container.textContent).toMatch(/all caught up/i)
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

    click(first)
    expect(boxesIn(section()).map(nameOf)).toEqual(overdue.slice(0, 3).map((l) => l.title))
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

  it('leaves a catch-up week’s own list as it was, labelled from the sheet', () => {
    window.localStorage.setItem('alx-lang', 'ar')
    const gd = SCHEDULES.gd
    const buffer = gd.weeks.find((w) => w.week === 13.5)
    const pool = gd.lessons.filter((l) => l.week < 13.5).slice(0, 10)
    render({ week: buffer, pool })
    expect(headings()).toEqual([])
    expect(boxes()).toHaveLength(6)
    expect(metaOf(boxes()[0]).textContent).toBe(`${pool[0].weekLabel} · ${pool[0].moduleCode}`)
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
