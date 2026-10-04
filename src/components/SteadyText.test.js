// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import SteadyText, { widestCounts } from './SteadyText'

/*
  Text that changes during a visit without changing its size: the catch-up
  week's status headline, its list's intro and week counts. Every wording it
  can come to shares one grid cell with the one in force, invisible and
  unread, so a count dropping tick by tick never rewraps the lines around it
  and moves the rows below out from under the learner's finger.
*/

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = (props, children) =>
  act(() => root.render(createElement(SteadyText, props, children)))

describe('SteadyText', () => {
  it('shows the wording in force and holds every other, invisible and unread, in its cell', () => {
    render({ texts: ['14 items left', '1 item left', 'All clear', '1 item left'] }, '9 items left')
    const [cell] = container.children
    expect(cell.className).toBe('grid')
    const held = [...cell.children].filter((s) => s.getAttribute('aria-hidden') === 'true')
    expect(held.map((s) => s.textContent)).toEqual(['14 items left', '1 item left', 'All clear'])
    for (const s of held) expect(s.className).toContain('invisible')
    const shown = [...cell.children].filter((s) => !s.hasAttribute('aria-hidden'))
    expect(shown.map((s) => s.textContent)).toEqual(['9 items left'])
    // All in the one cell, so the largest sets the size.
    for (const s of cell.children) expect(s.className).toContain('col-start-1 row-start-1')
  })

  it('sits inside a line as an inline grid, as wide as its widest wording', () => {
    render({ texts: ['10 open', 'all done'], inline: true }, '9 open')
    expect(container.firstElementChild.className).toBe('inline-grid')
  })
})

describe('widestCounts', () => {
  it('names the counts whose wording can be the longest on the way down to none', () => {
    expect(widestCounts(14)).toEqual([14, 2, 1, 0])
    expect(widestCounts(2)).toEqual([2, 1, 0])
    expect(widestCounts(1)).toEqual([1, 0])
    expect(widestCounts(0)).toEqual([0])
  })
})
