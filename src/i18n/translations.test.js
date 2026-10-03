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

/*
  The LinkedIn post names the program the learner actually finished. It was
  written when Data Analytics was the only one, and a Graphic Design learner
  announcing a Data Analytics module would be worse than no post at all.
*/
describe('the milestone post', () => {
  const m = (program) => ({ program, title: 'X', index: 1, total: 4, weeks: 2, lessons: 7 })

  it.each(langs)('%s names Creative Tech programs, not Data Analytics', (lang) => {
    const t = translations[lang]
    for (const id of ['cc', 'gd']) {
      expect(t.postModuleDone(m(id))).not.toMatch(/Data Analytics|تحليل البيانات/)
      expect(t.postProgrammeDone(m(id))).not.toMatch(/Data Analytics|تحليل البيانات/)
    }
  })

  it('reads exactly as before for Data Analytics', () => {
    expect(translations.en.postModuleDone(m('da'))).toBe(
      'I have just finished X — module 1 of 4 in the ALX Data Analytics programme.',
    )
    expect(translations.ar.postProgrammeDone(m('da'))).toContain('برنامج ALX لتحليل البيانات')
  })
})

/*
  Counts name what was counted. A Creative Tech row may be a lesson, an activity
  or a quiz, so "lessons" undercounts it; DA rows really are lessons and must
  read exactly as they always have when no unit is passed.
*/
describe('count wording', () => {
  const COUNTED = [
    ['statusBehind', [3]],
    ['statusAhead', [3]],
    ['reminderBehind', [3, 1]],
    ['reminderOnTrack', [3]],
    ['paceValue', [3]],
    ['noPaceYet', []],
    ['lessonsComplete', [3, 9]],
    ['completedBody', [22]],
  ]

  it.each(langs)('%s reads the same for DA with or without the unit', (lang) => {
    const t = translations[lang]
    for (const [key, args] of COUNTED) {
      expect(t[key](...args, 'lesson'), `${lang}.${key}`).toBe(t[key](...args))
    }
  })

  it.each(langs)('%s says something different for Creative Tech items', (lang) => {
    const t = translations[lang]
    for (const [key, args] of COUNTED) {
      expect(t[key](...args, 'item'), `${lang}.${key}`).not.toBe(t[key](...args, 'lesson'))
    }
  })

  it('keeps the English DA wording word for word', () => {
    expect(translations.en.paceValue(2.5)).toBe('2.5 lessons/week')
    expect(translations.en.paceValue(14.8, 'item')).toBe('14.8 items/week')
  })
})

describe('the forecast countdown', () => {
  it.each(langs)('%s counts down in the right unit', (lang) => {
    const t = translations[lang]
    expect(t.noPaceYetMore(11, 'item')).not.toBe(t.noPaceYetMore(11, 'lesson'))
    expect(t.noPaceYetMore(1)).toBe(t.noPaceYetMore(1, 'lesson'))
  })
})

/*
  Arabic posts name every program the way the DA post always has: translated,
  after "ALX". A Latin program name inside an RTL sentence is reordered
  unpredictably by LinkedIn's bidi rendering, so none may appear.
*/
describe('the Arabic milestone post', () => {
  const ar = translations.ar
  const m = (program) => ({ program, title: 'X', index: 1, total: 4, weeks: 2, lessons: 7 })

  it('translates every program name, as the DA post does', () => {
    for (const id of ['da', 'cc', 'gd']) {
      for (const text of [ar.postModuleDone(m(id)), ar.postProgrammeDone(m(id))]) {
        expect(text).not.toMatch(/Data|Analytics|Content|Creation|Graphic|Design/)
        expect(text).toContain(`برنامج ALX ل`)
      }
    }
  })

  it('keeps the DA sentence exactly as it was', () => {
    expect(ar.postModuleDone(m('da'))).toBe(
      'أنهيت للتو X — الوحدة 1 من 4 في برنامج ALX لتحليل البيانات.',
    )
  })
})
