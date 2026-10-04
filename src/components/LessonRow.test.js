// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import LessonRow, { DONE_TEXT } from './LessonRow'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { SCHEDULES } from '../lib/schedule'
import tailwind from '../../tailwind.config.js'

/*
  Ticking is what a learner does here every day, so this pins it from both
  sides. A thumb can tick a lesson by its name, not only by a 44px box at the
  far edge of the row. A keyboard or screen reader still meets exactly one
  checkbox per lesson, named after the lesson, whose name does not change when
  it is ticked.
*/

let container
let root
let toggles

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  toggles = []
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.getSelection().removeAllRanges()
})

/** One row, holding its ticked state the way useLearnerProfile does. */
function Row({ lesson }) {
  const [checked, setChecked] = useState(false)
  const onToggle = (id) => {
    toggles.push(id)
    setChecked((c) => !c)
  }
  return createElement('ul', null, createElement(LessonRow, { lesson, checked, onToggle }))
}

function render(lesson) {
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(Row, { lesson })))
  })
}

const box = () => container.querySelector('[role="checkbox"]')
const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** The box's accessible name: the text of the element its aria-labelledby points at. */
const nameOf = (el) => document.getElementById(el.getAttribute('aria-labelledby'))?.textContent
/** The innermost element showing exactly `text`, i.e. what a finger lands on. */
const byText = (text) =>
  [...container.querySelectorAll('*')].reverse().find((el) => el.textContent === text)

// A Data Analytics row has every part a finger can land on: the title, the
// Check Your Understanding line, and a graded chip with its own title.
const lesson = SCHEDULES.da.lessons.find(
  (l) => l.checkYourUnderstanding && l.gradedType === 'graded-test',
)
const activity = SCHEDULES.gd.lessons.find((l) => l.kind === 'activity')

describe('a lesson row', () => {
  it.each([
    ['a Data Analytics lesson', lesson],
    ['a Creative Tech activity', activity],
  ])('names its checkbox after %s, ticked or not', (_, item) => {
    render(item)
    // Not "Mark … complete": that contradicted the state read straight after it.
    expect(box().hasAttribute('aria-label')).toBe(false)
    expect(nameOf(box())).toBe(item.title)
    click(box())
    expect(box().getAttribute('aria-checked')).toBe('true')
    expect(nameOf(box())).toBe(item.title)
  })

  it('ticks when the learner taps the lesson’s name, and unticks on the next tap', () => {
    render(lesson)
    click(byText(lesson.title))
    expect(box().getAttribute('aria-checked')).toBe('true')
    click(byText(lesson.title))
    expect(box().getAttribute('aria-checked')).toBe('false')
    expect(toggles).toEqual([lesson.id, lesson.id])
  })

  it('ticks from anywhere on the row: the understanding check, the graded chip, its title', () => {
    render(lesson)
    const spots = [
      byText(lesson.checkYourUnderstanding),
      byText(translations.en.badgeTest),
      byText(lesson.graded.title),
      container.querySelector('li'), // the row's own padding
    ]
    for (const spot of spots) click(spot)
    expect(toggles).toEqual(spots.map(() => lesson.id))
    expect(box().getAttribute('aria-checked')).toBe('false') // four taps: back where it began
  })

  it('toggles once, not twice, when the box itself is tapped', () => {
    render(lesson)
    click(box())
    expect(toggles).toEqual([lesson.id])
    // The tick drawn inside the box is part of the box.
    click(box().querySelector('svg'))
    expect(toggles).toEqual([lesson.id, lesson.id])
  })

  it('leaves the lesson alone when a tap ends a text selection in the row', () => {
    render(lesson)
    const title = byText(lesson.title)
    const range = document.createRange()
    range.selectNodeContents(title)
    window.getSelection().addRange(range)

    // The learner was copying the title, not ticking it.
    click(title)
    expect(toggles).toEqual([])
    expect(box().getAttribute('aria-checked')).toBe('false')

    // Once the selection is gone, the same tap ticks.
    window.getSelection().removeAllRanges()
    click(title)
    expect(toggles).toEqual([lesson.id])
  })

  it('leaves the lesson as it was when a double or triple click selects its title', () => {
    render(lesson)
    const title = byText(lesson.title)
    const clickNo = (n) =>
      act(() => title.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: n })))

    // The first click of a double click cannot be told from a tap, so it ticks…
    clickNo(1)
    expect(box().getAttribute('aria-checked')).toBe('true')
    // …and the second, which selects a word, takes that back.
    const range = document.createRange()
    range.selectNodeContents(title)
    window.getSelection().addRange(range)
    clickNo(2)
    expect(box().getAttribute('aria-checked')).toBe('false')
    // A third, selecting the whole title, changes nothing more.
    clickNo(3)
    expect(box().getAttribute('aria-checked')).toBe('false')
    expect(window.getSelection().toString()).toBe(lesson.title)
  })

  it('treats a quick double tap that selects nothing as two taps, like the box', () => {
    render(lesson)
    const title = byText(lesson.title)
    for (const n of [1, 2]) {
      act(() => title.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: n })))
    }
    expect(toggles).toEqual([lesson.id, lesson.id])
    expect(box().getAttribute('aria-checked')).toBe('false')
  })

  it('is not blocked by text selected somewhere else on the page', () => {
    const elsewhere = document.createElement('p')
    elsewhere.textContent = 'Some other card'
    document.body.appendChild(elsewhere)
    render(lesson)
    const range = document.createRange()
    range.selectNodeContents(elsewhere)
    window.getSelection().addRange(range)

    click(byText(lesson.title))
    expect(toggles).toEqual([lesson.id])
    elsewhere.remove()
  })

  it('adds no second control or tab stop: the box is still the only one', () => {
    render(lesson)
    const row = container.querySelector('li')
    expect(
      row.querySelectorAll('a, button, input, label, select, textarea, [tabindex]'),
    ).toHaveLength(1)
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(row.hasAttribute('role')).toBe(false)
    // No click handler of its own either: Chromium would expose the row to
    // assistive tech as clickable, a second control around the box. (React
    // gives one to any element with an onClick prop.)
    expect(row.onclick).toBeNull()
  })

  it('leaves focus where it was, so a tap draws no focus ring around the box', () => {
    render(lesson)
    click(byText(lesson.title))
    expect(box().getAttribute('aria-checked')).toBe('true')
    // Focus moved by a script shows the keyboard ring in Chromium.
    expect(document.activeElement).not.toBe(box())
  })
})

/*
  Finished text fades so a finished row reads as done, but it is still text a
  learner reads, so it keeps AA contrast (4.5:1). The title used to fade to
  ink/45, which measured 2.8:1.

  The colours come from tailwind.config.js and the class names from DONE_TEXT,
  so a later tweak to either is measured here. The backgrounds are the ones a
  finished item sits on: a roadmap card, the focus card's lime tint, the hover
  tint, and an item in the graded card.
*/
describe('finished text', () => {
  const palette = tailwind.theme.extend.colors
  const hex = (name) => {
    if (name === 'white') return '#FFFFFF'
    const [family, shade = 'DEFAULT'] = name.split('-')
    const entry = palette[family]
    return typeof entry === 'string' ? entry : entry[shade]
  }
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  /** `top` at `alpha` over `under`, as the browser composites it. */
  const over = (top, alpha, under) => top.map((c, i) => c * alpha + under[i] * (1 - alpha))
  const luminance = (c) =>
    c
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  /** "text-ink-mute" → [ink-mute, 1]; "dark:text-paper/60" → [paper, 0.6]. */
  const textColour = (prefix) => {
    const cls = DONE_TEXT.split(' ').find((c) => c.startsWith(`${prefix}text-`))
    const [name, alpha = '100'] = cls.slice(`${prefix}text-`.length).split('/')
    return [rgb(hex(name)), Number(alpha) / 100]
  }

  const C = Object.fromEntries(
    ['white', 'paper', 'lime', 'violet', 'navy-900', 'navy-950'].map((n) => [n, rgb(hex(n))]),
  )
  const themes = {
    light: {
      text: textColour(''),
      backgrounds: {
        'a roadmap card': C.white,
        'the focus card’s lime tint': over(C.lime, 0.1, C.white),
        'the hover tint': over(C['navy-900'], 0.04, C.white),
        'a graded-card item': over(C.white, 0.8, over(C.violet, 0.05, C.paper)),
      },
    },
    dark: {
      text: textColour('dark:'),
      backgrounds: {
        'a roadmap card': C['navy-900'],
        'the focus card’s lime tint': over(C.lime, 0.05, C['navy-900']),
        'the hover tint': over(C.white, 0.05, C['navy-900']),
        'a graded-card item': over(C['navy-950'], 0.5, over(C.violet, 0.05, C['navy-950'])),
      },
    },
  }

  it.each(Object.keys(themes))('meets AA on every background it sits on, in %s', (theme) => {
    const { text, backgrounds } = themes[theme]
    for (const [where, bg] of Object.entries(backgrounds)) {
      const [colour, alpha] = text
      const ratio = contrast(over(colour, alpha, bg), bg)
      expect(ratio, `${theme}, on ${where}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('is what a finished row wears, on its title and on the lines under it', () => {
    render(lesson)
    click(box())
    const title = byText(lesson.title)
    const faded = [
      title,
      byText(lesson.checkYourUnderstanding).parentElement,
      byText(lesson.graded.title),
    ]
    for (const el of faded) {
      for (const cls of DONE_TEXT.split(' ')) expect(el.classList).toContain(cls)
    }
    // Struck through on the title only; the lines under it just fade.
    expect(title.classList).toContain('line-through')
    expect(faded.slice(1).some((el) => el.classList.contains('line-through'))).toBe(false)
  })
})
