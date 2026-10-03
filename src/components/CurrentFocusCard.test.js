// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import CurrentFocusCard from './CurrentFocusCard'
import { LanguageProvider } from '../i18n/LanguageContext'
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

/** Holds completion state the way useLearnerProfile does, and recomputes `catchUp` from it. */
function Harness({ week, pool }) {
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

describe('the catch-up list', () => {
  const gd = SCHEDULES.gd
  const buffer = gd.weeks.find((w) => w.week === 13.5)
  const pool = gd.lessons.filter((l) => l.week < 13.5).slice(0, 10)

  it('keeps a ticked item on screen, struck through, so it can be unticked in place', () => {
    render({ week: buffer, pool })
    const first = boxes()[0]
    const label = first.getAttribute('aria-label')
    click(first)

    const again = boxes()[0]
    expect(again.getAttribute('aria-checked')).toBe('true')
    // Same row, same place — not replaced by the next open item.
    expect(again.closest('li').textContent).toContain(pool[0].title)

    click(again)
    expect(boxes()[0].getAttribute('aria-checked')).toBe('false')
    expect(boxes()[0].getAttribute('aria-label')).toBe(label)
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
