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
