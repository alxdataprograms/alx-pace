// @vitest-environment jsdom
import { act, createElement, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import GradedMilestonesAlert from './GradedMilestonesAlert'
import GradedBadge from './GradedBadge'
import { DONE_TEXT } from './LessonRow'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { SCHEDULES } from '../lib/schedule'

/*
  Every Data Analytics week has graded items, so every DA learner reads this
  card every week. jsdom cannot measure how a title wraps; it can see whether
  the badge still stands beside the title, squeezing it into a narrow column
  (6–8 lines at 375px for an Integrated Project), or heads it on its own line.
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

function render(...elements) {
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(Fragment, null, ...elements)))
  })
}

/** The innermost element showing exactly `text`. */
const byText = (text) =>
  [...container.querySelectorAll('*')].reverse().find((el) => el.textContent === text)

// Week 4: a Graded Test and an Integrated Project.
const week = SCHEDULES.da.weeks.find((w) => w.week === 4)
const badgeLabel = {
  'graded-test': translations.en.badgeTest,
  'integrated-project': translations.en.badgeProject,
}
const titleOf = (item) => item.graded?.title || item.title

describe('the graded milestones card', () => {
  it('puts each badge on its own line above its title, so the title gets the full width', () => {
    render(createElement(GradedMilestonesAlert, { week, completedSet: new Set() }))
    expect(week.gradedItems.map((i) => i.gradedType)).toEqual(['graded-test', 'integrated-project'])
    for (const item of week.gradedItems) {
      const title = byText(titleOf(item))
      const line = byText(badgeLabel[item.gradedType]).parentElement
      // The badge's line never holds the title beside it; the title follows,
      // in the same item.
      expect(line.contains(title)).toBe(false)
      expect(line.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(line.parentElement).toBe(title.parentElement)
    }
  })

  it('heads the card with the graded badge’s own icon, not a warning sign', () => {
    render(
      createElement(GradedMilestonesAlert, { week, completedSet: new Set() }),
      createElement('div', { id: 'reference' }, createElement(GradedBadge, { type: 'graded' })),
    )
    const heading = byText(translations.en.milestonesTitle)
    const icon = heading.parentElement.parentElement.querySelector('svg')
    const generic = container.querySelector('#reference svg')
    expect(icon.getAttribute('class')).toBe(generic.getAttribute('class'))
  })

  it('fades a finished item the way a finished lesson row fades, struck through', () => {
    const [first, second] = week.gradedItems
    render(createElement(GradedMilestonesAlert, { week, completedSet: new Set([first.id]) }))
    const done = byText(titleOf(first))
    for (const cls of DONE_TEXT.split(' ')) expect(done.classList).toContain(cls)
    expect(done.classList).toContain('line-through')
    // Not opacity: ink at 60% measured 4.3:1 on this card, under AA.
    expect(done.className).not.toMatch(/opacity/)

    const open = byText(titleOf(second))
    expect(open.classList).not.toContain('line-through')
    expect(open.className).not.toMatch(/text-ink-mute/)

    // One check, at the end of the finished item's badge line.
    const checks = container.querySelectorAll(`[aria-label="${translations.en.completed}"]`)
    expect(checks).toHaveLength(1)
    expect(byText(badgeLabel[first.gradedType]).parentElement.contains(checks[0])).toBe(true)
  })
})

/*
  Every graded item of the week done. A learner who finished early met about
  300px of crossed-out titles here, every visit until the week ended; now it is
  one green line, the same as a week with nothing graded. Decided on arrival,
  like the checklist's "Show N done", so the card never shrinks under a
  learner's finger, and never claims more than is true.
*/
describe('a week whose graded items are all done', () => {
  const en = translations.en
  const [first, second] = week.gradedItems
  const allDone = new Set([first.id, second.id])
  const card = (completedSet, w = week) =>
    createElement(LanguageProvider, null, createElement(GradedMilestonesAlert, { week: w, completedSet }))
  /** Renders again on the same root, as App does when a tick changes completedSet. */
  const rerender = (completedSet) => act(() => root.render(card(completedSet)))

  it('is one green line when they were all done before the visit, the same line as a week with none', () => {
    // Content Creation's Week 17 has nothing graded.
    const none = SCHEDULES.cc.weeks.find((w) => w.week === 17)
    expect(none.gradedItems).toEqual([])
    render(
      createElement(GradedMilestonesAlert, { week, completedSet: allDone }),
      createElement(GradedMilestonesAlert, { week: none, completedSet: new Set() }),
    )
    const [line, reference] = container.querySelectorAll('section')
    expect(line.textContent).toBe(en.milestonesAllDone(2, 4))
    expect(line.textContent).toBe('Both graded items for Week 4 are done.')
    expect(line.querySelector('li')).toBeNull()
    expect(line.className).toBe(reference.className)
    expect(line.getAttribute('aria-label')).toBe(reference.getAttribute('aria-label'))
  })

  it('stays the full card when the last one is ticked during the visit, so nothing below it moves', () => {
    render(createElement(GradedMilestonesAlert, { week, completedSet: new Set([first.id]) }))
    rerender(allDone)
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('section').getAttribute('aria-label')).toBe(en.milestonesAria)
    expect(container.textContent).not.toContain(en.milestonesAllDone(2, 4))
  })

  it('brings the full card back if one is unticked, so the line never claims more than is true', () => {
    render(createElement(GradedMilestonesAlert, { week, completedSet: allDone }))
    rerender(new Set([first.id]))
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.textContent).not.toContain(en.milestonesAllDone(2, 4))
    // Ticking it again in the same visit keeps the full card: nothing shrinks
    // under the learner's finger.
    rerender(allDone)
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it.each(Object.keys(translations))('says so in the learner’s language, with the week in it (%s)', (lang) => {
    window.localStorage.setItem('alx-lang', lang)
    const gd9 = SCHEDULES.gd.weeks.find((w) => w.week === 9) // three graded items
    render(
      createElement(GradedMilestonesAlert, {
        week: gd9,
        completedSet: new Set(gd9.gradedItems.map((i) => i.id)),
      }),
    )
    expect(container.textContent).toBe(translations[lang].milestonesAllDone(3, 9))
  })
})
