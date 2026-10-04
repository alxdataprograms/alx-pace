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
  Creative Tech, read by module.

  Its weeks run to 31 items and its modules to 10, and the page was laid out
  as if they were Data Analytics' 1–5-lesson weeks and 4 modules. The roadmap
  opened this week under the checklist that already lists it: Graphic
  Design's Week 9 put 62 checkboxes on the page for 31 items. Every finished
  module stayed laid out in full, so at Week 31 the current week sat 6,800px
  down. And the only measure of progress was a bar that moves about 3% a week.

  Now the roadmap leaves this week to the checklist (closed, still flagged and
  openable), folds each finished module into one row with its count, a bar and
  its Share button, and keeps open the module of this week and any with items
  overdue. The progress card names the module of the week: "Module 3 of 10 ·
  Poster Design & Visual Composition", 0/31. Data Analytics reads exactly as
  it did. (The checklist's "Next checkpoint" line is CurrentFocusCard.test.js'.)

  Asserted through what a learner reads and can operate, as the other App
  tests are: text, headings, buttons and their aria-expanded, aria-controls.
*/

const langs = Object.keys(translations)
const en = translations.en
const gd = SCHEDULES.gd
/** A local calendar date `offsetDays` from today, as the date field stores it. */
const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISODateString(d)
}
/** Every milestone already seen, so no dialogue covers the page. */
const allCelebrated = JSON.stringify(
  Object.values(SCHEDULES).flatMap((s) => s.modules.map((m) => `module:${m.code}`)),
)
const idsWhere = (program, keep) => SCHEDULES[program].lessons.filter(keep).map((l) => l.id)

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

/** A `program` learner `days` days in, with `done` ticked, in `lang`. */
function render(program, days, done, lang = 'en') {
  const storage = {
    program,
    startDate: iso(-days),
    completedLessons: JSON.stringify(done),
    'alx-celebrated': allCelebrated,
    'alx-lang': lang,
  }
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}
/** Graphic Design 57 days in, Week 9, with every item before it done. */
const gdWeek9 = (lang) => render('gd', 57, idsWhere('gd', (l) => l.week < 9), lang)

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
const roadmap = () => region(en.fullCurriculumAria)
const boxes = (el = container) => [...el.querySelectorAll('[role="checkbox"]')]
const weekRow = (week) => container.querySelector(`button[aria-controls="week-panel-${week}"]`)
const openWeeks = () =>
  [...container.querySelectorAll('button[aria-controls^="week-panel-"]')]
    .filter((b) => b.getAttribute('aria-expanded') === 'true')
    .map((b) => b.getAttribute('aria-controls'))
const moduleRow = (code) => container.querySelector(`button[aria-controls="module-panel-${code}"]`)
const moduleRows = () =>
  [...container.querySelectorAll('button[aria-controls^="module-panel-"]')].map((b) =>
    b.getAttribute('aria-controls').replace('module-panel-', ''),
  )
/** A module's heading as today's roadmap writes it: code, title, and no toggle. */
const staticHeading = (code) =>
  [...roadmap().querySelectorAll('h3')].find(
    (h) => h.textContent.startsWith(`${code} `) && !h.querySelector('button'),
  )

describe('the roadmap leaves this week to the checklist, in Creative Tech', () => {
  it('starts Graphic Design’s Week 9 closed, still flagged "Current", and opens it on a tap', () => {
    gdWeek9()
    const week9 = weekRow(9)
    expect(week9.getAttribute('aria-expanded')).toBe('false')
    expect(week9.textContent).toContain(en.current)
    expect(openWeeks()).toEqual([])
    // The week's 31 items, once each: the checklist's. It was 62.
    expect(boxes()).toHaveLength(31)
    expect(boxes(roadmap())).toHaveLength(0)

    click(week9)
    expect(week9.getAttribute('aria-expanded')).toBe('true')
    expect(boxes(document.getElementById('week-panel-9'))).toHaveLength(31)
  })

  it('does the same in Content Creation', () => {
    render('cc', 9, idsWhere('cc', (l) => l.week < 2))
    expect(weekRow(2).getAttribute('aria-expanded')).toBe('false')
    expect(weekRow(2).textContent).toContain(en.current)
    expect(openWeeks()).toEqual([])
  })
})

describe('a finished Creative Tech module folds into one row', () => {
  it('with its weeks, its count, a full bar and its Share button', () => {
    gdWeek9()
    expect(moduleRows()).toEqual(['GD-1', 'GD-2'])

    const row = moduleRow('GD-1')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    // The row is the module's heading, and a 44px button.
    expect(row.parentElement.tagName).toBe('H3')
    expect(row.className).toContain('min-h-[44px]')
    const title = gd.modules[0].title
    expect(row.textContent).toContain(`GD-1 ${title}`)
    expect(row.querySelector('[dir="ltr"]').textContent).toBe(title)
    expect(row.textContent).toContain(`${en.weekRange(1, 4)}\u00a0· 54/54`)
    expect(row.querySelector('[role="img"]').getAttribute('aria-label')).toBe(en.roadmapModuleDone)
    const bar = row.querySelector('[aria-hidden="true"] [style]')
    expect(bar.style.width).toBe('100%')

    // Share sits beside the row, never inside it: one control, one name.
    const share = row.closest('h3').parentElement.querySelector(':scope > button')
    expect(share.getAttribute('aria-label')).toBe(en.roadmapShareAria(title))
    expect(share.className).toContain('min-h-[44px]')
    expect(row.contains(share)).toBe(false)

    // Its weeks are folded away with it.
    expect(weekRow(1)).toBeNull()
    expect(document.getElementById('module-panel-GD-1')).toBeNull()
  })

  it('opens to its weeks, and closes again', () => {
    gdWeek9()
    const row = moduleRow('GD-1')
    click(row)
    expect(row.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(row.getAttribute('aria-controls'))
    const weeks = [...panel.querySelectorAll('button[aria-controls^="week-panel-"]')]
    expect(weeks.map((b) => b.getAttribute('aria-controls'))).toEqual([
      'week-panel-1',
      'week-panel-2',
      'week-panel-3',
    ])
    // Week 4, a catch-up week, is there too, as its flat row.
    expect(panel.textContent).toContain(en.bufferRoadmapNote)

    click(row)
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('module-panel-GD-1')).toBeNull()
  })

  it('folds every finished module ahead of the current one: nine of them in Week 31', () => {
    render('gd', 212, idsWhere('gd', (l) => l.week < 31))
    expect(moduleRows()).toEqual(gd.modules.slice(0, 9).map((m) => m.code))
    expect(moduleRows().every((code) => moduleRow(code).getAttribute('aria-expanded') === 'false')).toBe(
      true,
    )
    expect(staticHeading('GD-10')).toBeDefined()
    expect(weekRow(31).textContent).toContain(en.current)
  })

  it('keeps the module of this week open, finished or not', () => {
    // Week 9 done too: GD-3 is finished, and still this week's module.
    render('gd', 57, idsWhere('gd', (l) => l.week <= 9))
    expect(moduleRows()).toEqual(['GD-1', 'GD-2', 'GD-3'])
    const row = moduleRow('GD-3')
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('module-panel-GD-3').contains(weekRow(9))).toBe(true)
  })

  it('keeps open, as it was, a module with items overdue', () => {
    // Week 11, with Week 9 only part done: GD-3 holds 11 overdue items.
    const week9 = gd.weeks.find((w) => w.week === 9)
    render('gd', 72, [...idsWhere('gd', (l) => l.week < 9), ...week9.lessons.slice(0, 20).map((l) => l.id)])
    expect(moduleRows()).toEqual(['GD-1', 'GD-2'])
    expect(staticHeading('GD-3')).toBeDefined()
    expect(weekRow(9).textContent).toContain(en.overdueChip(11, 'item'))
  })

  it('never folds a module finished during the visit, from under the learner’s finger', () => {
    const week9 = gd.weeks.find((w) => w.week === 9)
    render('gd', 72, [...idsWhere('gd', (l) => l.week < 9), ...week9.lessons.slice(0, -1).map((l) => l.id)])
    click(weekRow(9))
    const last = boxes(document.getElementById('week-panel-9')).pop()
    click(last)
    expect(last.getAttribute('aria-checked')).toBe('true')

    // GD-3 is finished now: it gains its row, open, and the week stays open
    // around the row just ticked.
    expect(moduleRow('GD-3').getAttribute('aria-expanded')).toBe('true')
    expect(last.isConnected).toBe(true)
    expect(weekRow(9).getAttribute('aria-expanded')).toBe('true')
  })

  it.each(langs)('reads in the learner’s language (%s), titles in the sheet’s English', (lang) => {
    const t = translations[lang]
    gdWeek9(lang)
    const row = moduleRow('GD-2')
    expect(row.textContent).toContain(`${t.weekRange(5, 8)}\u00a0· 54/54`)
    expect(row.querySelector('[role="img"]').getAttribute('aria-label')).toBe(t.roadmapModuleDone)
    expect(row.querySelector('[dir="ltr"]').textContent).toBe(gd.modules[1].title)
    const share = row.closest('h3').parentElement.querySelector(':scope > button')
    expect(share.textContent).toBe(t.roadmapShare)
  })
})

describe('the progress card names the module of the week, in Creative Tech', () => {
  const caption = () => {
    const card = region(en.overallProgress)
    return card && [...card.querySelectorAll('p')].find((p) => p.querySelector('[dir="ltr"]'))
  }

  it('Graphic Design’s Week 9: Module 3 of 10 · Poster Design & Visual Composition, 0/31', () => {
    gdWeek9()
    const line = caption()
    expect(line.textContent).toBe(`${en.moduleOf(3, 10)}\u00a0· Poster Design & Visual Composition0/31`)
    expect(line.querySelector('[dir="ltr"]').textContent).toBe('Poster Design & Visual Composition')
    // The count stands at the end of the line, under the percentage.
    expect(line.lastElementChild.textContent).toBe('0/31')
  })

  it('counts each tick, wherever it is made', () => {
    gdWeek9()
    click(boxes(region(en.focusAria(en.weekRange(9, 9))))[0])
    expect(caption().lastElementChild.textContent).toBe('1/31')
  })

  it('names the module a catch-up week closes', () => {
    // Day 90 is Week 13.5, GD-4's catch-up week; Weeks 11 and 12 are done.
    render('gd', 90, idsWhere('gd', (l) => l.week < 13))
    expect(caption().textContent).toBe(`${en.moduleOf(4, 10)}\u00a0· Typography & Grid Systems24/28`)
  })

  it.each(langs)('in the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    render('cc', 9, idsWhere('cc', (l) => l.week < 2), lang)
    const line = [...region(t.overallProgress).querySelectorAll('p')].find((p) =>
      p.querySelector('[dir="ltr"]'),
    )
    expect(line.textContent).toBe(
      `${t.moduleOf(1, 5)}\u00a0· Content Identity & Concept Development19/59`,
    )
  })
})

describe('Data Analytics reads exactly as it did', () => {
  it('opens and flags the current week, and lays every module out in full', () => {
    // Day 24, Week 4, with Weeks 1–3 done: DA-1 is finished.
    render('da', 24, idsWhere('da', (l) => l.week < 4))
    expect(openWeeks()).toEqual(['week-panel-4'])
    expect(moduleRows()).toEqual([])
    for (const module of SCHEDULES.da.modules) expect(staticHeading(module.code)).toBeDefined()
    // The finished module keeps its "Complete" and Share line above its weeks.
    expect(roadmap().textContent).toContain(en.roadmapModuleDone)
    expect(weekRow(1)).not.toBeNull()
  })

  it('keeps the progress card to the programme', () => {
    render('da', 24, idsWhere('da', (l) => l.week < 4))
    const card = region(en.overallProgress)
    expect(card.querySelector('[dir="ltr"]')).toBeNull()
    expect(card.textContent).not.toContain(en.moduleOf(2, 4))
  })
})
