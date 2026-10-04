// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import ForecastCard from './ForecastCard'
import { LanguageProvider } from '../i18n/LanguageContext'
import { translations } from '../i18n/translations'
import tailwindConfig from '../../tailwind.config.js'

/*
  The "≈ N weeks behind plan" chip, readable in both themes.

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

function renderChip(finishDeltaDays) {
  const paceStatus = {
    completedCount: 11,
    pacePerWeek: 1.1,
    projectedFinish: new Date(2027, 1, 13),
    plannedEnd: new Date(2026, 10, 25),
    finishDeltaDays,
    forecastNeeds: 0,
    unit: 'lesson',
  }
  root = createRoot(container)
  act(() => {
    root.render(createElement(LanguageProvider, null, createElement(ForecastCard, { paceStatus })))
  })
  const text = translations.en.finishDelta(finishDeltaDays)
  return [...container.querySelectorAll('p')].find((p) => p.textContent === text)
}

describe('the finish-forecast chip', () => {
  it.each([
    ['behind plan', -77],
    ['ahead of plan', 35],
    ['on plan', 1],
  ])('is readable %s, in the light theme and the dark one', (_, days) => {
    const chip = renderChip(days)
    expect(chip).toBeTruthy()
    for (const theme of ['light', 'dark']) {
      expect(chipContrast(chip, theme), `${theme} theme`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('measures the behind chip as the browser did: 2.6:1 in dark mode before, 6.5:1 now', () => {
    // Pins the arithmetic above to the numbers measured in Chromium.
    const chip = renderChip(-77)
    expect(chipContrast(chip, 'dark')).toBeCloseTo(6.51, 1)
    const before = contrast(
      token('amber-700').rgb,
      over(token('amber/15'), hex(SURFACE.dark)),
    )
    expect(before).toBeCloseTo(2.61, 1)
  })
})
