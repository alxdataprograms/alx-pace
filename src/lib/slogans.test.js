import { describe, it, expect } from 'vitest'

import { sloganForWeek } from './slogans'
import { translations } from '../i18n/translations'

const langs = Object.keys(translations)
const WEEKS = Array.from({ length: 32 }, (_, i) => i + 1)

describe('sloganForWeek', () => {
  it.each(langs)('%s: Data Analytics sees exactly the slogans it always has', (lang) => {
    const list = translations[lang].slogans
    for (const w of WEEKS) {
      expect(sloganForWeek(w, lang, 'da')).toBe(list[(w - 1) % list.length])
      // No program yet (and old two-argument callers) fall back to the same list.
      expect(sloganForWeek(w, lang)).toBe(sloganForWeek(w, lang, 'da'))
    }
  })

  it.each(langs)('%s: Creative Tech never gets a data slogan', (lang) => {
    for (const program of ['cc', 'gd']) {
      for (const w of WEEKS) {
        expect(sloganForWeek(w, lang, program)).not.toMatch(/data|données|بيانات/i)
      }
    }
  })

  it.each(langs)('%s: the two cycles line up, differing only where DA is about data', (lang) => {
    const { slogans, slogansCreative } = translations[lang]
    expect(slogansCreative).toHaveLength(slogans.length)
    const differ = slogans.filter((s, i) => s !== slogansCreative[i])
    expect(differ.length).toBeGreaterThan(0)
    for (const s of differ) expect(s).toMatch(/data|données|بيانات/i)
  })

  it('gives a fractional buffer week its whole week’s slogan', () => {
    expect(sloganForWeek(13.5, 'en', 'gd')).toBe(sloganForWeek(13, 'en', 'gd'))
  })
})
