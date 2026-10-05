// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import ForecastCard from './ForecastCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import { formatHumanDate } from '../lib/formatDate'
import tailwindConfig from '../../tailwind.config.js'

/*
  The verdict chip ("≈ 4 weeks behind · oldest open: Week 3"), readable in
  both themes.

  Its amber tone had no dark: pair, so dark mode kept amber-700, a colour
  chosen for white, on the navy card: 2.6:1, where text this size needs 4.5:1.
  It is the line that matters most to a learner who is behind.

  jsdom paints nothing, so the contrast is computed from the classes the chip
  carries, resolved against the brand tokens in tailwind.config.js, over the
  card's own surface in each theme (.alx-card in index.css). A tone added
  later without a readable dark pair fails here.
*/

const COLORS = tailwindConfig.theme.extend.colors
// .alx-card: white in the light theme, navy-900 in the dark one.
const SURFACE = { light: '#FFFFFF', dark: COLORS.navy[900] }

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
/** "amber-700/15" → { rgb, alpha } from the brand tokens. */
function token(value) {
  const [name, opacity] = value.split('/')
  const [palette, shade = 'DEFAULT'] = name.split('-')
  const color = COLORS[palette]
  const h = typeof color === 'string' ? color : color[shade]
  if (!h) throw new Error(`unknown colour token ${value}`)
  return { rgb: hex(h), alpha: opacity ? Number(opacity) / 100 : 1 }
}
const over = ({ rgb, alpha }, base) => rgb.map((c, i) => c * alpha + base[i] * (1 - alpha))
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The chip's text contrast in a theme, from its classes. */
function chipContrast(chip, theme) {
  const classes = [...chip.classList]
  // Colour classes only: text-xs is a size, not a colour.
  const isColor = (c, prop) =>
    c.startsWith(`${prop}-`) && c.slice(prop.length + 1).split(/[-/]/)[0] in COLORS
  // A dark: class wins in the dark theme; an unprefixed one applies in both.
  const pick = (prop) => {
    const dark = classes.find((c) => c.startsWith('dark:') && isColor(c.slice(5), prop))
    const plain = classes.find((c) => isColor(c, prop))
    return (theme === 'dark' && dark ? dark.slice(5) : plain).slice(prop.length + 1)
  }
  const surface = hex(SURFACE[theme])
  const background = over(token(pick('bg')), surface)
  const text = over(token(pick('text')), background)
  return contrast(text, background)
}

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

const en = translations.en
const langs = Object.keys(translations)

/*
  A Data Analytics learner's card, on track unless told otherwise: what
  computePaceStatus hands it. The planned end is Nov 25, 2026.
*/
const statusWith = (over = {}) => ({
  completedCount: 11,
  pacePerWeek: 1.1,
  paceNeeds: 0,
  unit: 'lesson',
  plannedEnd: new Date(2026, 10, 25),
  week: 4,
  forecast: 'on-track',
  forecastWeeks: 0,
  oldestOpenWeek: 4,
  finishShiftDays: 0,
  projectedFinish: new Date(2026, 10, 25),
  ...over,
})
function renderCard(over = {}, lang) {
  if (lang) window.localStorage.setItem('alx-lang', lang)
  root = createRoot(container)
  rerenderCard(over)
}
/** As App re-renders the card on screen, a tick later. */
function rerenderCard(over = {}) {
  act(() => {
    root.render(
      createElement(LanguageProvider, null, createElement(ForecastCard, { paceStatus: statusWith(over) })),
    )
  })
}

// Behind from Week 3 by 4 weeks (28 days), ahead by 2 (14 days), or done.
const VERDICTS = {
  behind: {
    week: 7,
    forecast: 'behind',
    forecastWeeks: 4,
    oldestOpenWeek: 3,
    finishShiftDays: 28,
    projectedFinish: new Date(2026, 11, 23),
  },
  'on track': {},
  ahead: {
    forecast: 'ahead',
    forecastWeeks: 2,
    finishShiftDays: -14,
    projectedFinish: new Date(2026, 10, 11),
  },
  finished: {
    forecast: 'finished',
    oldestOpenWeek: null,
    finishShiftDays: null,
    projectedFinish: null,
  },
}

/**
 * Text as a learner reads it: no aria-hidden parts (the chip's held wordings),
 * and the no-break spaces that hold words together are spaces.
 */
const read = (el) => {
  const copy = el.cloneNode(true)
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return copy.textContent.replace(/\u00a0/g, ' ')
}
const card = () => container.querySelector('section')
/** The verdict chip: the card's last paragraph. */
const chip = () => [...card().querySelectorAll('p')].at(-1)
const row = (label) => [...card().querySelectorAll('dt')].find((dt) => read(dt) === label)

describe('the verdict chip', () => {
  it.each(Object.keys(VERDICTS))('is readable %s, in the light theme and the dark one', (name) => {
    renderCard(VERDICTS[name])
    for (const theme of ['light', 'dark']) {
      expect(chipContrast(chip(), theme), `${theme} theme`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('measures the behind chip as the browser did: 2.6:1 in dark mode before, 6.5:1 now', () => {
    // Pins the arithmetic above to the numbers measured in Chromium.
    renderCard(VERDICTS.behind)
    expect(chipContrast(chip(), 'dark')).toBeCloseTo(6.51, 1)
    const before = contrast(
      token('amber-700').rgb,
      over(token('amber/15'), hex(SURFACE.dark)),
    )
    expect(before).toBeCloseTo(2.61, 1)
  })
})

/*
  What the card says, now that it agrees with the status card.

  It said "≈ 5 weeks ahead" beside "Right on pace", "≈ 11 weeks behind" for
  nine lessons open, and repeated the hero's finish date in a "Target" row.
  computePaceStatus works out the verdict (paceStatus.test.js); this is how
  the card puts it.
*/
describe('what the card says', () => {
  it('on track: the planned date, once, in the chip; no "Target" row', () => {
    renderCard()
    expect(read(chip())).toBe('On track for Nov 25, 2026')
    expect(read(card())).not.toContain('Target')
    // On track, the projection is the plan itself: no row to repeat it.
    expect(row(en.projectedFinishLabel)).toBeUndefined()
    expect(read(card()).split('Nov 25, 2026')).toHaveLength(2)
  })

  it('behind: the finish that puts them on, and the week to start from', () => {
    renderCard(VERDICTS.behind)
    expect(read(row(en.projectedFinishLabel).nextElementSibling)).toBe('Dec 23, 2026')
    expect(read(chip())).toBe('≈ 4 weeks behind · oldest open: Week 3')
    // Two boxes, so a chip too long for one line breaks between them.
    expect([...chip().querySelectorAll('span')].map(read)).toEqual([
      '≈ 4 weeks behind',
      'oldest open: Week 3',
    ])
  })

  it('ahead: the earlier finish, and by how many weeks', () => {
    renderCard(VERDICTS.ahead)
    expect(read(row(en.projectedFinishLabel).nextElementSibling)).toBe('Nov 11, 2026')
    expect(read(chip())).toBe('≈ 2 weeks ahead of plan')
  })

  it('finished: the verdict, and nothing left to project', () => {
    renderCard(VERDICTS.finished)
    expect(read(chip())).toBe('Finished ahead of plan')
    expect(row(en.projectedFinishLabel)).toBeUndefined()
  })

  it('before a week’s worth of ticks: the verdict already, the weekly figure later', () => {
    renderCard({ completedCount: 1, paceNeeds: 1 })
    expect(read(card())).toContain('Tick off 1 more lesson to see your weekly pace.')
    expect(read(card())).not.toContain('lessons/week')
    expect(read(chip())).toBe('On track for Nov 25, 2026')
  })

  it('counts down from nothing ticked, without promising what it already shows', () => {
    renderCard({ completedCount: 0, paceNeeds: 2, ...VERDICTS.behind })
    expect(read(card())).toContain('Tick off 2 lessons to see your weekly pace.')
    expect(read(card())).not.toMatch(/forecast/i)
    expect(read(chip())).toBe('≈ 4 weeks behind · oldest open: Week 3')
  })

  it.each(langs)('speaks the learner’s language (%s)', (lang) => {
    const t = translations[lang]
    renderCard(VERDICTS.behind, lang)
    const parts = `${t.forecastBehind(4)} · ${t.forecastOldestOpen(3)}`
    expect(read(chip())).toBe(parts.replace(/\u00a0/g, ' '))
    expect(read(card())).toContain(formatHumanDate(new Date(2026, 11, 23), lang))
  })
})

/*
  The projected finish through a visit. Behind or ahead it gives the finish
  the gap puts the learner on, and on track it has none to give. A learner
  behind who clears the last overdue lesson in the roadmap below turns the
  verdict to "On track", and the row going pulled the roadmap up under that
  finger; unticking an earlier lesson there brought it in. Whether it has a
  place is decided on arrival, and kept for the visit, unseen and unread while
  the verdict has none to give.
*/
/*
  Ahead by less than a week. The status card says "You're 1 lesson ahead of
  schedule" after a first "Get ahead" tick, and this card read "On track for
  …" beneath it. It says "Ahead of plan" now, in the green of ahead, and has
  no finish to move: the planned date stands.
*/
describe('a lead of less than a week', () => {
  it.each(langs)('reads "Ahead of plan", in green, with no projected finish (%s)', (lang) => {
    renderCard({ forecast: 'ahead', forecastWeeks: 0, finishShiftDays: 0 }, lang)
    const chip = card().querySelector('p.w-fit')
    expect(read(chip)).toBe(translations[lang].forecastAheadSome)
    expect(chip.className).toContain('alxgreen')
    expect(card().querySelector('dl')).toBeNull()
  })
})

describe('the projected finish through a visit', () => {
  it('keeps its place, unseen and unread, once the verdict has none to give', () => {
    renderCard(VERDICTS.behind)
    const row = card().querySelector('dl')
    expect(row.getAttribute('aria-hidden')).toBeNull()
    expect(row.className).not.toContain('invisible')

    rerenderCard(VERDICTS['on track'])
    expect(card().querySelector('dl')).toBe(row)
    expect(row.getAttribute('aria-hidden')).toBe('true')
    expect(row.className).toContain('invisible')
    expect(read(card().querySelector('p.w-fit'))).toBe(en.forecastOnTrack('Nov 25, 2026'))

    // Behind again, it reads where it was.
    rerenderCard(VERDICTS.behind)
    expect(row.getAttribute('aria-hidden')).toBeNull()
    expect(row.className).not.toContain('invisible')
  })

  it('does not come in during the visit, for a learner on track on arrival', () => {
    renderCard(VERDICTS['on track'])
    // An earlier lesson unticked in the roadmap below: behind now. The chip
    // says so; the row waits for the next visit rather than push the roadmap.
    rerenderCard(VERDICTS.behind)
    expect(card().querySelector('dl')).toBeNull()
    expect(read(card().querySelector('p.w-fit'))).toContain(en.forecastBehind(4))
  })
})

/*
  The verdict line through a visit. A tick in the roadmap below can change the
  verdict, and a wording on fewer lines pulled the roadmap up under the finger:
  clearing the last overdue lesson there turned "≈ 1 semaine de retard · …"
  (two lines at 375px) into "En bonne voie pour finir le …" (one), 16px. So
  the line holds the size of every wording the visit is likely to bring,
  unseen and unread behind the pill.
*/
describe('the verdict line through a visit', () => {
  const pill = () => card().querySelector('p.w-fit')
  const heldWordings = () =>
    [...card().querySelectorAll('p.invisible[aria-hidden="true"]')].map((p) =>
      p.textContent.replace(/\u00a0/g, ' '),
    )
  const onTrack = en.forecastOnTrack('Nov 25, 2026')
  const behind = (n, week) => `${en.forecastBehind(n)} · ${en.forecastOldestOpen(week).replace(/\u00a0/g, ' ')}`

  it('on track: holds the leads a tick can bring, and stays the pill it was', () => {
    renderCard(VERDICTS['on track'])
    expect(heldWordings()).toEqual([
      onTrack,
      onTrack,
      en.forecastAheadSome,
      en.forecastAhead(1),
      en.forecastAhead(2),
    ])
    // The pill is the one read, and keeps its own width over the held lines.
    expect(read(pill())).toBe(onTrack)
    expect(pill().getAttribute('aria-hidden')).toBeNull()
    expect(pill().className).toContain('w-fit')
    expect(read(card())).not.toContain(en.forecastAheadSome)
  })

  it('keeps what it holds when a tick changes the verdict', () => {
    renderCard(VERDICTS['on track'])
    const held = heldWordings()
    rerenderCard({ forecast: 'ahead', forecastWeeks: 0, finishShiftDays: 0 })
    expect(read(pill())).toBe(en.forecastAheadSome)
    expect(heldWordings()).toEqual(held)
  })

  it('behind: holds the gap as it closes, the oldest open week moving on, and on track', () => {
    renderCard(VERDICTS.behind)
    expect(heldWordings()).toEqual([
      behind(4, 3),
      onTrack,
      en.forecastAheadSome,
      en.forecastAhead(1),
      en.forecastAhead(2),
      // A week more, as on arrival, then two and one, which Arabic writes out;
      // each with the week on arrival, and this week's for a longer number.
      ...[5, 4, 2, 1].flatMap((n) => [behind(n, 3), behind(n, 7)]),
    ])
    // Caught up in the roadmap: on track, the line as tall as it was.
    rerenderCard(VERDICTS['on track'])
    expect(read(pill())).toBe(onTrack)
    expect(heldWordings()[0]).toBe(behind(4, 3))
  })

  it('ahead: holds the lead a week either way, and down to "Ahead of plan"', () => {
    renderCard(VERDICTS.ahead)
    expect(heldWordings()).toEqual([
      en.forecastAhead(2),
      onTrack,
      en.forecastAheadSome,
      ...[3, 2, 1].map((n) => en.forecastAhead(n)),
    ])
  })
})

