// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { SCHEDULES } from './lib/schedule'
import { translations } from './i18n/translations'

/*
  Which card a learner meets first, in every state.

  An active week leads with the work: the status card ("Right on pace",
  "Catch-up nudge"), then this week's checklist, then progress, pace and the
  graded card. While progress and pace sat in between, the first checkbox ended
  at y=1084 on a 375×812 phone, so a learner opened the app to statistics and
  scrolled before ticking anything. The status card now carries the overall
  percentage in one line, so it stays at the top. The states without a week to
  work on (no program, no start date, countdown, graduation) keep their order.

  Cards are told apart by what a screen reader announces for them, their region
  names and headings, never by class names, so restyling a card cannot break
  this. A new card shows up here as "unknown" until it is given a place on
  purpose.
*/

const en = translations.en
const DAY = 86400000
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10)
/** Every item in the weeks before `week`: a learner exactly on schedule. */
const doneBefore = (program, week) =>
  SCHEDULES[program].lessons.filter((l) => l.week < week).map((l) => l.id)

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

function render(storage) {
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

/**
 * A `program` learner who started `startOffset` days from today (negative: in
 * the past), with every item before `week` ticked (nothing, if no week is
 * given) and every milestone dialogue already seen.
 */
function renderActive(program, startOffset, week, lang = 'en') {
  const done = week ? doneBefore(program, week) : []
  const seen = SCHEDULES[program].modules.map((m) => `module:${m.code}`)
  render({
    program,
    startDate: iso(startOffset),
    completedLessons: JSON.stringify(done),
    'alx-celebrated': JSON.stringify(seen),
    'alx-lang': lang,
  })
  return done
}

const label = (el) => el.getAttribute('aria-label') ?? ''
const heading = (el) => el.querySelector('h1, h2')?.textContent.trim() ?? ''

// First match wins, so the hero (the page's only h1) is tested first.
const CARDS = {
  hero: (el) => el.querySelector('h1') !== null,
  picker: (el) => el.getAttribute('aria-labelledby') === 'program-picker-title',
  'start date': (el) => heading(el) === en.promptTitle,
  countdown: (el) => heading(el).startsWith(en.beginsIn),
  graduation: (el) => [en.completedTitle, en.finishLineTitle].includes(heading(el)),
  status: (el) => label(el) === en.pacingStatusAria,
  focus: (el) => label(el).startsWith(en.focusAria('')),
  progress: (el) => label(el) === en.overallProgress,
  pace: (el) => label(el) === en.yourPace,
  graded: (el) => label(el) === en.milestonesAria || el.textContent === en.milestonesNone,
  roadmap: (el) => label(el) === en.fullCurriculumAria,
  footer: (el) => el.tagName === 'FOOTER',
}

/** The cards in <main>, top to bottom. */
const layout = () =>
  [...container.querySelector('main').children].map(
    (el) =>
      Object.keys(CARDS).find((name) => CARDS[name](el)) ??
      `unknown <${el.tagName.toLowerCase()}> "${label(el) || heading(el)}"`,
  )

describe('an active week leads with the checklist', () => {
  const ACTIVE = ['hero', 'status', 'focus', 'progress', 'pace', 'graded', 'roadmap', 'footer']

  it('puts this week’s lessons directly under the status card, the stats after them', () => {
    renderActive('da', -24, 4)
    expect(layout()).toEqual(ACTIVE)
  })

  it.each([
    ['Content Creation', 'cc', -9, 2],
    ['Graphic Design', 'gd', -57, 9],
  ])('orders a %s week the same way', (_, program, startOffset, week) => {
    renderActive(program, startOffset, week)
    expect(layout()).toEqual(ACTIVE)
  })

  it('still leaves the graded card out of a catch-up week', () => {
    // Day 90 is Graphic Design's Week 13.5, which has no lessons of its own.
    renderActive('gd', -90)
    expect(layout()).toEqual(['hero', 'status', 'focus', 'progress', 'pace', 'roadmap', 'footer'])
  })
})

describe('the states without a week to work on keep their order', () => {
  it('before a program is chosen', () => {
    render({ program: '' })
    expect(layout()).toEqual(['hero', 'picker', 'footer'])
  })

  it('before a start date is set', () => {
    render({ program: 'da' })
    expect(layout()).toEqual(['hero', 'start date', 'progress', 'roadmap', 'footer'])
  })

  it('while counting down to a start date ahead', () => {
    render({ program: 'da', startDate: iso(14) })
    expect(layout()).toEqual(['hero', 'countdown', 'roadmap', 'footer'])
  })

  it('after the final week', () => {
    render({ program: 'da', startDate: iso(-14 * 7 - 3) })
    expect(layout()).toEqual(['hero', 'graduation', 'progress', 'roadmap', 'footer'])
  })
})

/*
  The status card's progress line: "41% · 11 of 27" and a thin bar. It is text
  with a decorative bar, not a second progressbar, and a screen reader gets a
  full sentence in place of the shorthand.
*/
describe('the status card keeps overall progress at the top', () => {
  const section = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
  /** What a screen reader can reach: the text outside aria-hidden subtrees. */
  const spoken = (el) =>
    [...el.childNodes]
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent
        if (node.nodeType !== Node.ELEMENT_NODE) return ''
        return node.getAttribute('aria-hidden') === 'true' ? '' : spoken(node)
      })
      .join('')

  it('shows the progress card’s own figures, so the two can never disagree', () => {
    const done = renderActive('da', -24, 4)
    const total = SCHEDULES.da.totalLessons
    const bar = section(en.overallProgress).querySelector('[role="progressbar"]')
    const percent = Number(bar.getAttribute('aria-valuenow'))
    // Weeks 1–3 of Data Analytics: 11 of 27, which rounds to 41%.
    expect([done.length, total, percent]).toEqual([11, 27, 41])

    const status = section(en.pacingStatusAria)
    expect(status.textContent).toContain(en.statusProgress(percent, done.length, total))
    // The thin bar is filled to the same percentage.
    const fills = [...status.querySelectorAll('[style]')].map((el) => el.style.width)
    expect(fills).toEqual([`${percent}%`])
  })

  it('leaves the progress card with the page’s only progressbar', () => {
    renderActive('da', -24, 4)
    const bars = container.querySelectorAll('[role="progressbar"]')
    expect(bars).toHaveLength(1)
    expect(section(en.overallProgress).contains(bars[0])).toBe(true)
  })

  it.each(Object.keys(translations))(
    'reads the line to a screen reader as a sentence, not shorthand (%s)',
    (lang) => {
      const t = translations[lang]
      const done = renderActive('da', -24, 4, lang)
      const status = container.querySelector(`main > section[aria-label="${t.pacingStatusAria}"]`)
      const figures = [41, done.length, SCHEDULES.da.totalLessons]

      expect(spoken(status)).toContain(t.statusProgressAria(...figures))
      expect(spoken(status)).not.toContain(t.statusProgress(...figures))
      // Still on screen for everyone else, next to the bar.
      expect(status.textContent).toContain(t.statusProgress(...figures))
      expect(status.querySelector('[style]').closest('[aria-hidden="true"]')).not.toBeNull()
    },
  )
})
