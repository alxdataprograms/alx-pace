// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import AlreadyStartedCard from './AlreadyStartedCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'

/*
  "Already started?", on its own: the question, its two answers, the
  confirmation and Undo, and where focus goes after each. App wires it to the
  learner's ticks (App.alreadyStarted.test.js); here `onYes` stands in for
  that, returning what it ticked.

  A learner who found Pace part-way through the course had done the weeks
  before this one on ALX, and the app's first words to them were "108 items
  from earlier weeks still open", with "Mark week complete", one roadmap week
  at a time, the only way to say otherwise.
*/

const langs = Object.keys(translations)
const en = translations.en
const MARKED = { ids: Array.from({ length: 108 }, (_, i) => `gd-${i}`), crossed: ['module:GD-1'] }

let container
let root
let props

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  props = {
    offered: true,
    week: 9,
    from: 1,
    to: 8,
    programName: en.programs.gd,
    unit: 'item',
    onYes: vi.fn(() => MARKED),
    onUndo: vi.fn(),
    onNotYet: vi.fn(),
  }
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
})

/** Renders the card, or updates the one on screen, as App re-renders it. */
function render(extra = {}) {
  root ??= createRoot(container)
  act(() => {
    root.render(
      createElement(LanguageProvider, null, createElement(AlreadyStartedCard, { ...props, ...extra })),
    )
  })
}

const card = () => container.querySelector('section')
const buttons = () => [...container.querySelectorAll('button')]
const buttonNamed = (text) => buttons().find((b) => b.textContent.trim() === text)
const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** As a keyboard user does it: focus the button, then activate it. */
const press = (el) => {
  el.focus()
  click(el)
}
const plain = (text) => text.replace(/[\u00a0\u2060]/g, (c) => (c === '\u00a0' ? ' ' : ''))

describe('the question', () => {
  it('asks about the weeks before this one, by program, with the two answers', () => {
    render()
    expect(plain(card().querySelector('h2').textContent)).toBe('Already started?')
    expect(plain(card().querySelector('p').textContent)).toBe(
      "You're in Week 9 of Graphic Design. Have you already finished Weeks 1–8 on the ALX platform?",
    )
    expect(buttons().map((b) => plain(b.textContent.trim()))).toEqual([
      'Yes, tick Weeks 1–8',
      "Not yet, show me what's open",
    ])
    // The region is named by its heading, in the learner's language.
    expect(card().getAttribute('aria-labelledby')).toBe(card().querySelector('h2').id)
  })

  it('names one week alone in Week 2', () => {
    render({ week: 2, from: 1, to: 1, programName: en.programs.da, unit: 'lesson' })
    expect(plain(card().querySelector('p').textContent)).toBe(
      "You're in Week 2 of Data Analytics. Have you already finished Week 1 on the ALX platform?",
    )
    expect(plain(buttons()[0].textContent.trim())).toBe('Yes, tick Week 1')
  })

  it.each(langs)('speaks the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    window.localStorage.setItem('alx-lang', lang)
    render({ programName: t.programs.gd })
    expect(card().querySelector('h2').textContent).toBe(t.alreadyStarted)
    expect(card().querySelector('p').textContent).toBe(t.alreadyStartedAsk(9, t.programs.gd, 1, 8))
    expect(buttons().map((b) => b.textContent.trim())).toEqual([
      t.alreadyStartedYes(1, 8),
      t.alreadyStartedNotYet,
    ])
  })

  it('offers both answers as 44px targets, the one that acts in filled cobalt', () => {
    render()
    const [yes, notYet] = buttons()
    for (const b of [yes, notYet]) expect(b.className).toContain('min-h-[44px]')
    expect(yes.className).toContain('bg-cobalt')
    expect(yes.className).toContain('text-white')
    expect(notYet.className).not.toContain('bg-cobalt ')
    expect(notYet.className).toContain('border-cobalt/40')
  })

  it('is not there unless offered on arrival', () => {
    render({ offered: false })
    expect(container.innerHTML).toBe('')
  })

  it('stays for the visit once offered, so a tick elsewhere moves nothing under the finger', () => {
    render()
    // App re-renders it as offered no longer: the learner ticked something.
    render({ offered: false })
    expect(card()).not.toBeNull()
    expect(buttonNamed(en.alreadyStartedNotYet)).toBeDefined()
  })

  it('moves no focus when it appears', () => {
    render()
    expect(document.activeElement).toBe(document.body)
  })
})

describe('"Yes"', () => {
  it('ticks the weeks once, and says how many items it marked done', () => {
    render()
    press(buttons()[0])
    expect(props.onYes).toHaveBeenCalledTimes(1)
    const done = card().querySelector('p[tabindex="-1"]')
    expect(done.textContent).toBe(en.alreadyStartedDone(108, 'item'))
    expect(done.textContent).toBe('Marked 108 items done')
    // Its heading stays, so the region keeps its name.
    expect(card().querySelector('h2').textContent).toBe(en.alreadyStarted)
  })

  it('hands focus to the confirmation, which a screen reader then reads', () => {
    render()
    press(buttons()[0])
    expect(document.activeElement).toBe(card().querySelector('p[tabindex="-1"]'))
    expect(document.activeElement.textContent).toBe('Marked 108 items done')
  })

  it('offers Undo beside it, as a 44px button', () => {
    render()
    press(buttons()[0])
    expect(buttons().map((b) => b.textContent.trim())).toEqual([en.undo])
    expect(buttonNamed(en.undo).className).toContain('min-h-[44px]')
  })

  it.each(langs)('counts in the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    window.localStorage.setItem('alx-lang', lang)
    render()
    press(buttons()[0])
    expect(card().querySelector('p[tabindex="-1"]').textContent).toBe(t.alreadyStartedDone(108, 'item'))
    expect(buttons().map((b) => b.textContent.trim())).toEqual([t.undo])
  })

  it('says the learner is all caught up, with nothing to undo, if nothing was left to tick', () => {
    // Every item of those weeks was ticked by hand before Yes.
    props.onYes = vi.fn(() => ({ ids: [], crossed: [] }))
    render()
    press(buttons()[0])
    expect(card().querySelector('p[tabindex="-1"]').textContent).toBe(en.catchUpFirstDone)
    expect(buttons()).toEqual([])
  })
})

describe('Undo', () => {
  it('hands back exactly what Yes returned, and asks again, with focus on the question', () => {
    render()
    press(buttons()[0])
    press(buttonNamed(en.undo))
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    expect(props.onUndo).toHaveBeenCalledWith(MARKED)
    const question = card().querySelector('p[tabindex="-1"]')
    expect(question.textContent).toBe(en.alreadyStartedAsk(9, en.programs.gd, 1, 8))
    expect(document.activeElement).toBe(question)
    expect(buttons()).toHaveLength(2)
  })
})

describe('"Not yet, show me what\'s open"', () => {
  it('puts the card away for the visit, then goes to what is open', () => {
    render()
    let cardOnScreen = null
    props.onNotYet.mockImplementation(() => {
      cardOnScreen = container.querySelector('section')
    })
    press(buttonNamed(en.alreadyStartedNotYet))
    expect(container.innerHTML).toBe('')
    expect(props.onNotYet).toHaveBeenCalledTimes(1)
    // Called once the card has gone, so a scroll measures the page without it.
    expect(cardOnScreen).toBeNull()
    expect(props.onYes).not.toHaveBeenCalled()
  })

  it('stays away when the app re-renders, and saves nothing', () => {
    render()
    press(buttonNamed(en.alreadyStartedNotYet))
    render()
    expect(container.innerHTML).toBe('')
    expect(props.onNotYet).toHaveBeenCalledTimes(1)
    expect(Object.keys(window.localStorage)).toEqual([])
  })
})
