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
  French and Arabic screens, in French and Arabic.

  The curriculum sheet is English, and its week label reached three places as
  it was: the focus card's heading ("Week 4 · DA-2" on an Arabic page), the
  countdown's "Pour commencer · Week 1" and the graded card's "2 à rendre en
  Week 4". French numbers kept their decimal point, "3.1 leçons/semaine" and
  "Semaine 13.5", and the page's title stayed English in every language.

  The curriculum's own text stays English by design: lesson, module and
  assessment titles and module codes, each set apart as a left-to-right run.
  What lies outside those runs is the app's own words, and those are the
  learner's language. Asserted through what a learner reads, as the other App
  tests are; translations.test.js has the strings themselves.
*/

const langs = Object.keys(translations)
const { en, fr } = translations
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
const weekOf = (program, n) => SCHEDULES[program].weeks.find((w) => w.week === n)

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  document.title = ''
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

/** A `program` learner `days` into the course, with every item before Week `upTo` ticked. */
const learner = (program, days, upTo, lang) =>
  render({
    program,
    startDate: iso(-days),
    completedLessons: JSON.stringify(
      SCHEDULES[program].lessons.filter((l) => l.week < upTo).map((l) => l.id),
    ),
    'alx-celebrated': allCelebrated,
    'alx-lang': lang,
  })
/** An empty page again, for the next learner in the same test. */
const leave = () => {
  act(() => root.unmount())
  root = null
  window.localStorage.clear()
}

/*
  The screens where the sheet's week label, or a week numbered by a half, turns
  up, as [program, days into the course, first week not all ticked]. Each week
  begins where the course's day timeline puts it (scheduleModel.js): Graphic
  Design's half Week 13 runs days 84–87, its catch-up Week 13.5 days 88–94,
  Week 14.5 days 95–101 and Week 18.5 days 123–129.
*/
const STATES = {
  'Data Analytics, Week 4, on track': ['da', 24, 4],
  'Data Analytics, Week 7, behind since Week 3': ['da', 45, 3],
  'Data Analytics, ten days before the start': ['da', -10, 1],
  'Graphic Design, its half Week 13': ['gd', 85, 13],
  'Graphic Design, its catch-up Week 13.5': ['gd', 90, 12],
  'Graphic Design, Week 18.5, behind since Week 14.5': ['gd', 125, 14.5],
  'Content Creation, its catch-up Week 4': ['cc', 23, 3],
}

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
/** As read: no-break spaces as spaces, word joiners gone. */
const plain = (text) => text.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2060/g, '')
const region = (name) => container.querySelector(`main > section[aria-label="${name}"]`)
const focusHeading = (t, week) => region(t.focusAria(t.weekRange(week, week))).querySelector('h2')
/** The page's own words: <main> without the curriculum's left-to-right runs. */
const ownWords = () => {
  const copy = container.querySelector('main').cloneNode(true)
  for (const run of copy.querySelectorAll('[dir="ltr"]')) run.remove()
  return plain(copy.textContent)
}

describe('the week, in the learner’s own words', () => {
  it.each(langs)('heads the focus card with the week as the sheet labels it, in %s', (lang) => {
    const t = translations[lang]
    for (const [program, days, n, upTo] of [
      ['da', 24, 4, 4],
      ['gd', 85, 13, 13],
      ['gd', 90, 13.5, 12],
    ]) {
      learner(program, days, upTo, lang)
      const week = weekOf(program, n)
      const heading = focusHeading(t, n)
      expect(plain(heading.textContent)).toBe(`${plain(t.weekLabel(week))} · ${week.moduleCode}`)
      // English reads exactly as the sheet does.
      if (lang === 'en') expect(plain(heading.textContent)).toBe(`${week.weekLabel} · ${week.moduleCode}`)
      // Only the module code is held left to right; in Arabic, the rest reads
      // right to left, as the page does.
      expect([...heading.querySelectorAll('[dir="ltr"]')].map((el) => el.textContent)).toEqual([
        week.moduleCode,
      ])
      expect(heading.closest('section [dir="ltr"]')).toBeNull()
      leave()
    }
  })

  it.each(['fr', 'ar'])('counts the graded items due in the week in %s', (lang) => {
    const t = translations[lang]
    learner('da', 24, 4, lang)
    expect(region(t.milestonesAria).textContent).toContain(t.milestonesDue(2, weekOf('da', 4)))
    expect(region(t.milestonesAria).textContent).not.toMatch(/Week/)
  })

  it('names a half week’s kind in the graded card too', () => {
    learner('gd', 85, 13, 'fr')
    expect(plain(region(fr.milestonesAria).textContent)).toContain(
      '1 à rendre en semaine 13 (½ semaine) — elle compte pour ta note.',
    )
  })

  it.each(['fr', 'ar'])('starts the countdown on the first week, in %s', (lang) => {
    const t = translations[lang]
    learner('da', -10, 1, lang)
    const firstUp = [...container.querySelectorAll('main p')].find((p) =>
      p.textContent.includes(t.firstUp('').trim()),
    )
    expect(plain(firstUp.textContent).trim()).toBe(plain(t.firstUp(t.weekLabel(weekOf('da', 1)))))
    expect(firstUp.textContent).not.toMatch(/Week/)
  })

  it.each(Object.entries(STATES))('leaves no English week in French or Arabic: %s', (_, state) => {
    for (const lang of ['fr', 'ar']) {
      learner(...state, lang)
      expect(ownWords(), lang).not.toMatch(/\bWeeks?\b|Buffer|½ week/)
      leave()
    }
  })
})

describe('decimals, as French writes them', () => {
  it('writes Graphic Design’s Week 14.5 as 14,5 wherever it is named', () => {
    // Day 97 is Week 14.5, GD-5's first.
    learner('gd', 97, 14.5, 'fr')
    const hero = container.querySelector('h1').closest('section')
    expect(plain(hero.textContent)).toContain('Semaine 14,5 — ')
    expect(region(fr.pacingStatusAria).textContent).toContain('Semaine 14,5 sur 32')
    expect(plain(focusHeading(fr, 14.5).textContent)).toBe('Semaine 14,5 · GD-5')
    // The roadmap's tile and label, and GD-5's span of weeks.
    const roadmap = region(fr.fullCurriculumAria)
    const texts = [...roadmap.querySelectorAll('span, p')].map((el) => el.textContent)
    expect(texts).toContain('14,5')
    expect(texts).toContain('Semaine 14,5')
    expect(texts).toContain('Semaines 14,5–17,5')
    expect(texts).not.toContain('14.5')
  })

  it('writes the weekly pace with a comma', () => {
    // Eleven lessons in 25 days: 3.1 a week.
    learner('da', 24, 4, 'fr')
    expect(region(fr.yourPace).textContent).toContain('3,1 leçons/semaine')
  })

  it.each(Object.entries(STATES))('puts no decimal point in the app’s own French: %s', (_, state) => {
    learner(...state, 'fr')
    expect(ownWords()).not.toMatch(/\d\.\d/)
  })

  it.each(['en', 'ar'])('keeps the point in %s, as the rest of its screens do', (lang) => {
    const t = translations[lang]
    learner('gd', 97, 14.5, lang)
    expect(ownWords()).toContain(t.weekOf(14.5, 32))
    const tiles = [...region(t.fullCurriculumAria).querySelectorAll('span')].map((s) => s.textContent)
    expect(tiles).toContain('14.5')
    leave()
    learner('da', 24, 4, lang)
    expect(region(t.yourPace).textContent).toContain(t.paceValue(3.1))
  })
})

describe('the page’s title', () => {
  it.each(langs)('names the page in %s', (lang) => {
    learner('da', 24, 4, lang)
    expect(document.title).toBe(translations[lang].pageTitle)
  })

  it('follows the language switcher', () => {
    learner('da', 24, 4, 'en')
    expect(document.title).toBe(en.pageTitle)
    const language = (name) =>
      [...container.querySelectorAll('footer button')].find((b) => b.textContent === name)
    for (const lang of ['fr', 'ar', 'en']) {
      click(language(translations[lang].langName))
      expect(document.title).toBe(translations[lang].pageTitle)
    }
  })
})
