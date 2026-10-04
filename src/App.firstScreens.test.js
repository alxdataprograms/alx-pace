// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { formatHumanDate } from './lib/formatDate'
import { plannedEndDate, toISODateString } from './lib/pacing'
import { quoteForDate } from './lib/quotes'
import { SCHEDULES } from './lib/schedule'

/*
  The screens a learner meets before the course is under way: no program yet,
  no start date yet, and the countdown to a date ahead.

  The first one greeted a first-time visitor with "Welcome back, Your name!",
  offered a program link and a start-date row that did nothing yet, offered
  reminders and a reset with nothing to remind about or reset, and never said
  what the app is. The countdown read "Started Oct 14" beside "Course begins in
  10 days", badged Week 1 "Current" and opened it, and gave the finish date
  twice.

  Also the details found on those screens in French and Arabic, which every
  later screen shares: the greeting's rocket, the track chip, the progress
  bar's direction and the daily quote. (French plurals and Arabic digits are
  pinned in translations.test.js.)

  Asserted through what a learner reads and can operate (text, headings,
  buttons, aria-expanded), as App.order.test.js does. jsdom cannot lay out a
  line or paint a gradient, so where a fix is visual the test checks what
  produces it: the run that keeps words together, the classes that turn the
  bar round.
*/

const langs = Object.keys(translations)
const en = translations.en
/** A local calendar date `offsetDays` from today, as the date field stores it. */
const iso = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toISODateString(d)
}

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  // The reminders pill renders only where notifications exist, which jsdom
  // lacks: without these, every "no reminders here" check would pass vacuously.
  window.Notification = function Notification() {}
  Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
})

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container.remove()
  delete window.Notification
  delete navigator.serviceWorker
  vi.useRealTimers()
})

function render(storage) {
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value)
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(App)))
  })
}

const click = (el) => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const hero = () => container.querySelector('h1').closest('section')
const footerButtons = () =>
  [...container.querySelectorAll('footer button')].map((b) => b.textContent.trim())
const buttonNamed = (text) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
/** The roadmap's week rows that are open, and how many weeks it badges "Current". */
const openWeeks = () =>
  [...container.querySelectorAll('button[aria-controls^="week-panel-"]')]
    .filter((b) => b.getAttribute('aria-expanded') === 'true')
    .map((b) => b.getAttribute('aria-controls'))
const currentBadges = () =>
  [...container.querySelectorAll(`section[aria-label="${en.fullCurriculumAria}"] .alx-chip`)].filter(
    (chip) => chip.textContent.trim() === en.current,
  ).length

describe('the first screen, before a program is chosen', () => {
  it.each(langs)('says what Pace is (%s) instead of welcoming the visitor back', (lang) => {
    const t = translations[lang]
    render({ program: '', 'alx-lang': lang })
    expect(container.querySelector('h1').textContent.trim()).toBe(t.welcomeNew)
    expect(hero().textContent).not.toContain(t.welcomeBack().trim())
    expect(hero().textContent).toContain(t.introLine)
    expect([...hero().querySelectorAll('li')].map((li) => li.textContent)).toEqual(t.introChips)
  })

  it('offers no control in the hero that does nothing yet', () => {
    // The program picker is open right below, and there is nothing to date
    // until a program is chosen: no "Choose your program" link, no date row.
    render({ program: '' })
    expect(hero().querySelectorAll('button, input')).toHaveLength(0)
  })

  it('offers neither reminders nor a reset with nothing to remind about or reset', () => {
    render({ program: '' })
    expect(footerButtons()).not.toContain(en.enableReminders)
    expect(footerButtons()).not.toContain(en.resetButton)
    // The rest of the footer is still there.
    expect(footerButtons()).toContain(en.darkMode)
  })

  it.each([
    ['a name', { learnerName: 'Amina' }],
    ['a start date set before choosing a program', { startDate: '2026-09-01' }],
    ['ticks', { completedLessons: JSON.stringify([SCHEDULES.da.lessons[0].id]) }],
  ])('keeps reset within reach when %s is all there is', (_, data) => {
    render({ program: '', ...data })
    expect(container.querySelector('h1').textContent.trim()).toBe(en.welcomeNew)
    expect(footerButtons()).toContain(en.resetButton)
  })

  it('withdraws reset once it has cleared everything, back to the first screen', () => {
    render({ program: 'da', startDate: iso(-3), learnerName: 'Amina' })
    click(buttonNamed(en.resetButton))
    click(buttonNamed(en.resetYes))
    expect(container.querySelector('h1').textContent.trim()).toBe(en.welcomeNew)
    expect(footerButtons()).not.toContain(en.resetButton)
  })
})

describe('a program chosen, no start date yet', () => {
  it('leaves the date to the start-date card: the hero has no date row', () => {
    render({ program: 'gd' })
    expect(container.querySelector('main h2').textContent).toBe(en.promptTitle)
    // The name invitation, its edit button and the program row; the date row
    // used to be a fourth, an empty editor duplicating the card below.
    expect(hero().querySelectorAll('button')).toHaveLength(3)
  })

  it('flags no week "Current" and opens none: the course has not begun', () => {
    render({ program: 'da' })
    expect(openWeeks()).toEqual([])
    expect(currentBadges()).toBe(0)
  })

  it('offers reset, but not reminders yet', () => {
    render({ program: 'da' })
    expect(footerButtons()).toContain(en.resetButton)
    expect(footerButtons()).not.toContain(en.enableReminders)
  })
})

describe('counting down to a start date ahead', () => {
  it.each(langs)('says the course "Starts" on its date, not "Started" (%s)', (lang) => {
    const t = translations[lang]
    const start = iso(14)
    render({ program: 'da', startDate: start, 'alx-lang': lang })
    const date = formatHumanDate(start, lang)
    expect(hero().textContent).toContain(t.starts(date))
    expect(hero().textContent).not.toContain(t.started(date))
  })

  it('gives the finish date once, in the hero, not again in the countdown card', () => {
    const start = iso(14)
    render({ program: 'da', startDate: start })
    const finish = en.targetFinish(formatHumanDate(plannedEndDate(start, SCHEDULES.da.totalDays), 'en'))
    const main = container.querySelector('main').textContent
    expect(main.split(finish)).toHaveLength(2)
    expect(hero().textContent).toContain(finish)
  })

  it('flags no week "Current" and opens none before the course begins', () => {
    render({ program: 'da', startDate: iso(14) })
    expect(container.querySelector('main h2').textContent).toContain(en.beginsIn)
    expect(openWeeks()).toEqual([])
    expect(currentBadges()).toBe(0)
  })

  it('opens Week 1 and flags it at midnight on the start day, in a tab left open', () => {
    // 23:58 the night before; App re-reads the clock every minute.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date(2026, 9, 13, 23, 58))
    render({ program: 'da', startDate: '2026-10-14' })
    expect(openWeeks()).toEqual([])
    expect(currentBadges()).toBe(0)

    act(() => vi.advanceTimersByTime(4 * 60_000))
    expect(container.querySelector('main h2').textContent).not.toContain(en.beginsIn)
    expect(hero().textContent).toContain(en.started(formatHumanDate('2026-10-14', 'en')))
    expect(openWeeks()).toEqual(['week-panel-1'])
    expect(currentBadges()).toBe(1)
  })

  it('offers reminders once there is a date to pace', () => {
    render({ program: 'da', startDate: iso(14) })
    expect(footerButtons()).toContain(en.enableReminders)
  })
})

describe('a course under way', () => {
  it('still opens and flags the current week, as it always has', () => {
    // 24 days in: Data Analytics' Week 4.
    render({ program: 'da', startDate: iso(-24) })
    expect(openWeeks()).toEqual(['week-panel-4'])
    expect(currentBadges()).toBe(1)
    expect(footerButtons()).toEqual(expect.arrayContaining([en.enableReminders, en.resetButton]))
  })
})

/*
  The rocket ending the greeting followed an ordinary space, so a line could
  break there and leave it alone on the next line ("Welcome back, Amina!",
  then the rocket). It now sits in one unbreakable run with what precedes it.
  That run must not start with an ordinary space either: Chromium breaks there,
  which is how French sent " !" and the rocket under "Amina".
*/
describe('the greeting keeps its rocket', () => {
  const runOf = () => container.querySelector('h1 svg').parentElement

  it.each(langs)('with the learner’s name (%s)', (lang) => {
    const t = translations[lang]
    render({ program: 'da', startDate: iso(-24), learnerName: 'Amina', 'alx-lang': lang })
    const run = runOf()
    expect(run.classList).toContain('whitespace-nowrap')
    expect(run.textContent).toBe(`${t.welcomeBackAfterName}\u00a0`)
    expect(run.textContent.startsWith(' ')).toBe(false)
    // The name itself stays outside, free to wrap between its own words.
    expect(run.textContent).not.toContain('Amina')
  })

  it.each(langs)('with the "Your name" invitation (%s)', (lang) => {
    // The invitation is a button, and Chromium breaks on either side of one,
    // so it travels inside the run.
    const t = translations[lang]
    render({ program: 'da', startDate: iso(-24), 'alx-lang': lang })
    const run = runOf()
    expect(run.classList).toContain('whitespace-nowrap')
    expect(run.querySelector('button').textContent).toBe(t.yourName)
    expect(run.textContent).toBe(`${t.yourName}${t.welcomeBackAfterName}\u00a0`)
  })

  it.each(langs)('on the first screen (%s)', (lang) => {
    const t = translations[lang]
    render({ program: '', 'alx-lang': lang })
    const run = runOf()
    expect(run.classList).toContain('whitespace-nowrap')
    expect(run.textContent).toBe('\u00a0')
    // "ALX Pace" itself never splits across two lines.
    expect(t.welcomeNew).toContain('ALX\u00a0Pace')
  })
})

describe('the brand bar', () => {
  it.each(langs)('keeps the track chip on one line and the logo at full size (%s)', (lang) => {
    // "Parcours 14 semaines" wrapped into a two-line lozenge, and the flex row
    // squeezed the ALX logo to make room. jsdom cannot measure either; it can
    // see the chip refuse to wrap from 360px up (on a 320px screen it may
    // still wrap) and the logo refuse to shrink.
    const t = translations[lang]
    render({ program: 'da', startDate: iso(-24), 'alx-lang': lang })
    const chip = [...container.querySelectorAll('header .alx-chip')].find(
      (el) => el.textContent === t.trackChip(14),
    )
    expect(chip.classList).toContain('min-[360px]:whitespace-nowrap')
    expect(container.querySelector('header svg').classList).toContain('flex-none')
  })
})

describe('the progress card’s bar', () => {
  it('turns its gradient round in Arabic, so the bright end leads', () => {
    // The fill grows from the start edge, the right in Arabic, but its
    // cobalt-to-lime gradient ran left to right in every language: in Arabic
    // the lime end sat where the bar begins. jsdom cannot paint a gradient;
    // it can see the fill told to turn round under dir="rtl".
    render({ program: 'da', startDate: iso(-24), 'alx-lang': 'ar' })
    expect(document.documentElement.dir).toBe('rtl')
    const fill = container.querySelector('[role="progressbar"] > div')
    expect(fill.classList).toContain('bg-gradient-to-r')
    expect(fill.classList).toContain('rtl:bg-gradient-to-l')
  })
})

describe('the daily quote', () => {
  it.each(langs)('is set upright, not in a slant faked from the upright face (%s)', (lang) => {
    // No italic face is loaded, so "italic" made browsers slant the regular
    // letters, which distorts Arabic script in particular.
    render({ program: 'da', startDate: iso(-24), 'alx-lang': lang })
    const quote = [...container.querySelectorAll('span')].find(
      (el) => el.textContent === quoteForDate(new Date(), lang),
    )
    expect(quote).toBeTruthy()
    for (let el = quote; el !== container; el = el.parentElement) {
      expect(el.classList).not.toContain('italic')
    }
  })
})
