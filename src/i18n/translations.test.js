import { describe, it, expect } from 'vitest'

import { translations } from './translations'

/*
  Every user-facing string exists in all three languages, and has the same shape
  in each.

  CLAUDE.md states the rule; nothing enforced it. A key added to `en` and
  forgotten in `ar` does not fail a build or a lint — it renders `undefined` to
  an Arabic-speaking learner, and only someone reading that language notices.
  Worse for the function-valued ones, which throw and take the page down.

  The languages themselves are read from the module rather than hardcoded, for
  the same reason the app validates against Object.keys(translations): adding a
  fourth language should extend this test automatically, not silently skip it.
*/
const langs = Object.keys(translations)
const reference = 'en'

describe('translations', () => {
  it('ships the languages the app claims to support', () => {
    expect(langs).toContain('en')
    expect(langs).toContain('fr')
    expect(langs).toContain('ar')
  })

  it.each(langs.filter((l) => l !== reference))('%s has every key en has', (lang) => {
    const missing = Object.keys(translations[reference]).filter(
      (k) => !(k in translations[lang]),
    )
    expect(missing, `${lang} is missing: ${missing.join(', ')}`).toEqual([])
  })

  it.each(langs.filter((l) => l !== reference))('%s adds no key en lacks', (lang) => {
    // A one-sided key is a string that can never be reached from English, which
    // is nearly always a rename half-applied.
    const extra = Object.keys(translations[lang]).filter(
      (k) => !(k in translations[reference]),
    )
    expect(extra, `${lang} has orphans: ${extra.join(', ')}`).toEqual([])
  })

  it.each(langs)('%s keeps every key the same TYPE as en', (lang) => {
    // A template that is a function in one language and a bare string in another
    // throws at render — the failure mode that takes the whole page down rather
    // than printing "undefined".
    const wrong = Object.keys(translations[reference]).filter(
      (k) => typeof translations[lang][k] !== typeof translations[reference][k],
    )
    expect(wrong, `${lang} type mismatch on: ${wrong.join(', ')}`).toEqual([])
  })

  it('marks Arabic as right-to-left and the others as not', () => {
    expect(translations.ar.dir).toBe('rtl')
    expect(translations.en.dir).not.toBe('rtl')
    expect(translations.fr.dir).not.toBe('rtl')
  })

  it('has no empty strings standing in for a real translation', () => {
    const blank = []
    for (const lang of langs) {
      for (const [k, v] of Object.entries(translations[lang])) {
        if (typeof v === 'string' && v.trim() === '') blank.push(`${lang}.${k}`)
      }
    }
    expect(blank).toEqual([])
  })
})
