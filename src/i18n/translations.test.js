import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { translations } from './translations'
import { formatShortDate } from '../lib/formatDate'
import { SCHEDULES } from '../lib/schedule'

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
    expect(t.noPaceYetCount(12, 'item')).not.toBe(t.noPaceYetCount(12, 'lesson'))
    expect(t.noPaceYetCount(2)).toBe(t.noPaceYetCount(2, 'lesson'))
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

/*
  The hero's week line cheers the slogan with "!" — except where the slogan
  already ends its sentence. "Learn. Build. Repeat." had read
  "Learn. Build. Repeat.!", in every language and in Data Analytics too.
*/
describe('the week slogan line', () => {
  it.each(langs)('%s never stacks a mark on a slogan that already ends its sentence', (lang) => {
    const t = translations[lang]
    for (const slogan of [...t.slogans, ...t.slogansCreative]) {
      const line = t.weekSlogan(5, slogan)
      expect(line).not.toMatch(/[.!?؟]\s*[!?؟]$/)
      // Either the slogan ends the line untouched, or it gained the cheer.
      expect(line.endsWith(slogan) || line.endsWith('!')).toBe(true)
    }
  })

  it('lets "Learn. Build. Repeat." keep its own full stop', () => {
    expect(translations.en.weekSlogan(13.5, 'Learn. Build. Repeat.')).toBe('Week 13.5 — Learn. Build. Repeat.')
    expect(translations.fr.weekSlogan(5, 'Apprendre. Créer. Recommencer.')).toBe(
      'Semaine 5 — Apprendre. Créer. Recommencer.',
    )
    expect(translations.ar.weekSlogan(5, 'تعلّم. ابنِ. كرّر.')).toBe('الأسبوع 5 — تعلّم. ابنِ. كرّر.')
  })

  it('still cheers every other slogan exactly as before', () => {
    expect(translations.en.weekSlogan(1, 'Do Hard Things')).toBe('Week 1 — Do Hard Things!')
    expect(translations.fr.weekSlogan(1, 'Fais des choses difficiles')).toBe(
      'Semaine 1 — Fais des choses difficiles !',
    )
    expect(translations.ar.weekSlogan(1, 'افعل الأشياء الصعبة')).toBe('الأسبوع 1 — افعل الأشياء الصعبة!')
  })
})

describe('Arabic agreement in the catch-up status', () => {
  const ar = translations.ar

  it('agrees with one, two, and three-or-more, for lessons and items alike', () => {
    for (const unit of ['lesson', 'item']) {
      expect(ar.statusBehind(1, unit)).toContain('ما زال مفتوحًا')
      expect(ar.statusBehind(2, unit)).toContain('ما زالا مفتوحين')
      expect(ar.statusBehind(5, unit)).toContain('ما زالت مفتوحة')
      expect(ar.statusBehind(14, unit)).toContain('ما زالت مفتوحة')
    }
  })
})

/*
  "Catch up first" and the roadmap's overdue weeks count what is still open.
  English and French need no agreement ("4 overdue", "4 en retard"); French's
  "+N more" does, and Arabic counts the noun as everywhere else: one, two,
  three to ten, eleven and up, each with its own form.
*/
describe('overdue counts', () => {
  const { en, fr, ar } = translations

  it('read plainly in English', () => {
    expect(en.overdueChip(4)).toBe('4 overdue')
    expect(en.catchUpFirstMore(6)).toBe('+6 more overdue — see the roadmap below')
  })

  it('take the singular below two in French', () => {
    expect(fr.catchUpFirstMore(1)).toMatch(/^\+1 autre en retard —/)
    expect(fr.catchUpFirstMore(6)).toMatch(/^\+6 autres en retard —/)
    expect(fr.overdueChip(1)).toBe('1 en retard')
  })

  it('agree in Arabic with one, two, a few and many, for lessons and items alike', () => {
    expect(ar.overdueChip(1)).toBe('درس واحد متأخر')
    expect(ar.overdueChip(2)).toBe('درسان متأخران')
    expect(ar.overdueChip(4)).toBe('4 دروس متأخرة')
    expect(ar.overdueChip(14)).toBe('14 درسًا متأخرًا')
    expect(ar.overdueChip(1, 'item')).toBe('عنصر واحد متأخر')
    expect(ar.overdueChip(10, 'item')).toBe('10 عناصر متأخرة')
    expect(ar.overdueChip(31, 'item')).toBe('31 عنصرًا متأخرًا')

    expect(ar.catchUpFirstMore(1)).toMatch(/^درس آخر متأخر —/)
    expect(ar.catchUpFirstMore(2)).toMatch(/^درسان آخران متأخران —/)
    expect(ar.catchUpFirstMore(6)).toMatch(/^6 دروس أخرى متأخرة —/)
    expect(ar.catchUpFirstMore(13)).toMatch(/^13 درسًا آخر متأخرًا —/)
    expect(ar.catchUpFirstMore(48, 'item')).toMatch(/^48 عنصرًا آخر متأخرًا —/)
  })

  it.each(langs)('%s reads the same for DA with or without the unit', (lang) => {
    const t = translations[lang]
    for (const n of [1, 2, 4, 14]) {
      expect(t.overdueChip(n, 'lesson')).toBe(t.overdueChip(n))
      expect(t.catchUpFirstMore(n, 'lesson')).toBe(t.catchUpFirstMore(n))
    }
  })
})

/*
  French writes a count below two in the singular. Several strings hard-coded
  the plural, so the first tick read "1 éléments terminés sur 27", and a week
  in the roadmap "1/1 faits".
*/
describe('French counts', () => {
  const fr = translations.fr

  it('take the singular below two, the plural from two', () => {
    expect(fr.itemsComplete(1, 27)).toBe('1 élément terminé sur 27')
    expect(fr.itemsComplete(0, 27)).toBe('0 élément terminé sur 27')
    expect(fr.itemsComplete(11, 27)).toBe('11 éléments terminés sur 27')
    expect(fr.lessonsComplete(1, 27)).toBe('1 leçon terminée sur 27')
    expect(fr.lessonsComplete(1, 250, 'item')).toBe('1 élément terminé sur 250')
    expect(fr.lessonsComplete(27, 27)).toBe('27 leçons terminées sur 27')
    expect(fr.doneCount(1, 1)).toBe('1/1 fait')
    expect(fr.doneCount(3, 5)).toBe('3/5 faits')
    // With a decimal comma, as French writes one (see "numbers as each
    // language writes them" below).
    expect(fr.paceValue(1.5)).toBe('1,5 leçon/semaine')
    expect(fr.paceValue(3.1, 'item')).toBe('3,1 éléments/semaine')
    expect(fr.statusCatchUpWeek(1, 1, 0)).toBe(
      'Semaine de rattrapage\u00a0: 1\u00a0élément à terminer\u00a0· 1\u00a0jour\u00a0restant',
    )
    expect(fr.statusCatchUpWeek(8, 5, 2)).toContain(
      '8\u00a0éléments à terminer\u00a0· 5\u00a0jours\u00a0restants',
    )
    expect(fr.reminderBehind(3, 1)).toMatch(/· 1 évaluation cette semaine\.$/)
    expect(fr.reminderBehind(3, 2)).toMatch(/· 2 évaluations cette semaine\.$/)
    expect(fr.milestonesDue(1, { week: 5 })).toContain('elle compte pour ta note')
    expect(fr.milestonesDue(2, { week: 4 })).toContain('elles comptent pour ta note')
  })

  it('never hedges with "(s)"', () => {
    for (const [key, value] of Object.entries(fr)) {
      if (typeof value !== 'function') continue
      for (const n of [0, 1, 2, 14]) {
        expect(String(value(n, n, 'item')), `fr.${key}(${n})`).not.toContain('(s)')
      }
    }
  })
})

/*
  The Arabic UI writes numbers one way: Western digits (0-9). It mixed them on
  a single card ("مسار ١٤ أسبوعًا" beside "10 أيام"), because week counts were
  converted to Arabic-Indic digits and nothing else was.
*/
describe('Arabic digits', () => {
  const ar = translations.ar
  const arabicIndic = /[٠-٩۰-۹]/
  // Every shape a template is called with: counts, a unit, or a milestone.
  const milestone = { program: 'gd', title: 'X', index: 3, total: 10, weeks: 3.5, lessons: 373, unit: 'item' }

  it('are Western in every string and template', () => {
    for (const [key, value] of Object.entries(ar)) {
      const outputs =
        typeof value === 'function'
          ? [value(14, 32, 'item'), value(milestone), value('X', 'Y', 22)]
          : [value].flat()
      for (const out of outputs) {
        expect(String(out), `ar.${key}`).not.toMatch(arabicIndic)
      }
    }
  })

  it('reach dates too, whatever the browser would pick for plain "ar"', () => {
    // Plain 'ar' leaves the digits to the runtime's locale data: Arabic-Indic
    // in some browsers, Western in others (and in this Node). The locale names
    // the numbering system outright, so no browser is left to choose.
    expect(new Intl.Locale(ar.locale).numberingSystem).toBe('latn')
    expect(new Intl.DateTimeFormat(ar.locale).resolvedOptions().numberingSystem).toBe('latn')
  })
})

describe('the hero', () => {
  it.each(langs)('%s says "Starts" for a date ahead, and "Started" for one gone by', (lang) => {
    const t = translations[lang]
    expect(t.starts('X')).not.toBe(t.started('X'))
  })

  it.each(langs)('%s introduces the app in three short points', (lang) => {
    const t = translations[lang]
    expect(t.introChips).toHaveLength(3)
    for (const chip of t.introChips) expect(chip.trim()).not.toBe('')
  })
})

/*
  A week done early. The graded card's one line counts its items the way each
  language does: "the", "both", "all 3"; French agrees in number, and Arabic
  puts the verb first, singular before one and two and feminine before three
  and up. The week is the learner's own word for it, never the sheet's English
  "Week 4", and stays on one line with its number.
*/
describe('the week-done copy', () => {
  const { en, fr, ar } = translations

  it('reads plainly in English', () => {
    expect(en.milestonesAllDone(1, 4)).toBe('The graded item for Week 4 is done.')
    expect(en.milestonesAllDone(2, 4)).toBe('Both graded items for Week 4 are done.')
    expect(en.milestonesAllDone(3, 9)).toBe('All 3 graded items for Week 9 are done.')
    expect(en.getAheadMore(11, 11, 'item')).toBe('+11 more in Week 11')
  })

  it('agrees in French', () => {
    expect(fr.milestonesAllDone(1, 4)).toBe('L’évaluation notée de la semaine 4 est terminée.')
    expect(fr.milestonesAllDone(2, 4)).toBe('Les deux évaluations notées de la semaine 4 sont terminées.')
    expect(fr.milestonesAllDone(3, 9)).toBe('Les 3 évaluations notées de la semaine 9 sont toutes terminées.')
    expect(fr.getAheadMore(1, 5)).toBe('+1 autre en semaine 5')
    expect(fr.getAheadMore(11, 11, 'item')).toBe('+11 autres en semaine 11')
  })

  it('agrees in Arabic, for lessons and items alike', () => {
    expect(ar.milestonesAllDone(1, 4)).toBe('اكتمل التقييم المحتسب للأسبوع 4.')
    expect(ar.milestonesAllDone(2, 4)).toBe('اكتمل التقييمان المحتسبان للأسبوع 4.')
    expect(ar.milestonesAllDone(3, 9)).toBe('اكتملت كل التقييمات المحتسبة الـ3 للأسبوع 9.')

    expect(ar.getAheadMore(1, 5)).toBe('درس آخر في الأسبوع 5')
    expect(ar.getAheadMore(2, 5)).toBe('درسان آخران في الأسبوع 5')
    expect(ar.getAheadMore(6, 5)).toBe('6 دروس أخرى في الأسبوع 5')
    expect(ar.getAheadMore(2, 11, 'item')).toBe('عنصران آخران في الأسبوع 11')
    expect(ar.getAheadMore(11, 11, 'item')).toBe('11 عنصرًا آخر في الأسبوع 11')
  })

  it.each(langs)('%s names the week in its own words, kept with its number', (lang) => {
    const t = translations[lang]
    // Its number as the language writes it: "13,5" in French.
    const number = `\u00a0${t.number(13.5)}`
    for (const n of [1, 2, 3]) {
      const line = t.milestonesAllDone(n, 13.5)
      expect(line).toContain(number)
      if (lang !== 'en') expect(line).not.toMatch(/Week/)
    }
    expect(t.getAheadMore(4, 13.5, 'item').endsWith(number)).toBe(true)
  })
})

/*
  "Show N done" folded only Creative Tech's long weeks, so French and Arabic
  named what it folded "items". A Data Analytics week folds now too, once it
  is done in full, and its rows are lessons.
*/
describe('the "Show N done" toggle', () => {
  const { en, fr, ar } = translations

  it('names lessons for Data Analytics in French and Arabic', () => {
    expect(fr.showDone(1)).toBe('Afficher 1 leçon terminée')
    expect(fr.showDone(2)).toBe('Afficher 2 leçons terminées')
    expect(fr.hideDone()).toBe('Masquer les leçons terminées')
    expect(ar.showDone(1)).toBe('عرض درس واحد مكتمل')
    expect(ar.showDone(2)).toBe('عرض درسين مكتملين')
    expect(ar.showDone(5)).toBe('عرض 5 دروس مكتملة')
    expect(ar.hideDone()).toBe('إخفاء الدروس المكتملة')
  })

  it('reads exactly as before for Creative Tech items', () => {
    expect(fr.showDone(10, 'item')).toBe('Afficher 10 éléments terminés')
    expect(fr.hideDone('item')).toBe('Masquer les éléments terminés')
    expect(ar.showDone(2, 'item')).toBe('عرض عنصرين مكتملين')
    expect(ar.showDone(31, 'item')).toBe('عرض 31 عنصرًا مكتملًا')
    expect(ar.hideDone('item')).toBe('إخفاء العناصر المكتملة')
  })

  it('needs no noun in English', () => {
    expect(en.showDone(2)).toBe('Show 2 done')
    expect(en.showDone(2, 'item')).toBe('Show 2 done')
    expect(en.hideDone('item')).toBe(en.hideDone())
  })
})

/*
  The pace card's verdict. Weeks are counted the way each language counts
  them, Arabic's included: the card had "11 أسابيع" and "27 أسابيع", where
  eleven and up take the singular. The oldest open week is the learner's own
  word for it, never the sheet's English "Week 3", kept with its number.
*/
describe('the pace card’s verdict', () => {
  const { en, fr, ar } = translations

  it('reads plainly in English', () => {
    expect(en.forecastBehind(1)).toBe('≈ 1 week behind')
    expect(en.forecastBehind(4)).toBe('≈ 4 weeks behind')
    expect(en.forecastOldestOpen(3)).toBe('oldest open: Week\u00a03')
    expect(en.forecastOnTrack('Dec 16, 2026')).toBe('On track for Dec 16, 2026')
    expect(en.forecastAhead(1)).toBe('≈ 1 week ahead of plan')
    expect(en.forecastAhead(5)).toBe('≈ 5 weeks ahead of plan')
    expect(en.forecastFinished).toBe('Finished ahead of plan')
  })

  it('agrees in French', () => {
    expect(fr.forecastBehind(1)).toBe('≈ 1 semaine de retard')
    expect(fr.forecastBehind(4)).toBe('≈ 4 semaines de retard')
    expect(fr.forecastOldestOpen(3)).toBe('à rattraper dès la semaine\u00a03')
    expect(fr.forecastOnTrack('16 déc. 2026')).toBe('En bonne voie pour finir le 16 déc. 2026')
    expect(fr.forecastAhead(1)).toBe("≈ 1 semaine d'avance")
    expect(fr.forecastAhead(2)).toBe("≈ 2 semaines d'avance")
  })

  it('counts weeks as Arabic does', () => {
    expect(ar.forecastBehind(1)).toBe('≈ متأخّر بأسبوع واحد')
    expect(ar.forecastBehind(2)).toBe('≈ متأخّر بأسبوعين')
    expect(ar.forecastBehind(4)).toBe('≈ متأخّر بـ 4 أسابيع')
    expect(ar.forecastBehind(11)).toBe('≈ متأخّر بـ 11 أسبوعًا')
    expect(ar.forecastAhead(27)).toBe('≈ متقدّم بـ 27 أسبوعًا')
    expect(ar.forecastOldestOpen(3)).toBe('أقدم ما بقي مفتوحًا: الأسبوع\u00a03')
  })

  it.each(langs)('%s names the oldest open week in its own words, kept with its number', (lang) => {
    const t = translations[lang]
    const line = t.forecastOldestOpen(13.5)
    // Its number as the language writes it: "13,5" in French.
    expect(line.endsWith(`\u00a0${t.number(13.5)}`)).toBe(true)
    if (lang !== 'en') expect(line).not.toMatch(/Week/)
  })

  it.each(langs)('%s counts down to the weekly figure without promising a forecast', (lang) => {
    // The verdict shows from the first visit; only the items-a-week figure
    // waits for a week's worth of ticks.
    const t = translations[lang]
    const promise = { en: 'forecast', fr: 'date de fin', ar: 'تاريخ انتهائك' }[lang]
    for (const text of [t.noPaceYet(), t.noPaceYetMore(1), t.noPaceYetCount(2)]) {
      expect(text).not.toContain(promise)
    }
    expect(translations.en.noPaceYetCount(2)).toBe('Tick off 2 lessons to see your weekly pace.')
  })
})

/*
  Creative Tech, read by module. A long week's "Next checkpoint" counts the
  open items up to its next graded item the way each language counts: French
  in the singular below two, Arabic after "على بُعد" (at a distance of), whose
  noun takes the genitive: عنصر واحد، عنصرين، 9 عناصر، 11 عنصرًا. The progress
  card names the module of the week as the module's milestone post does.
*/
describe('the next checkpoint and the module of the week', () => {
  const { en, fr, ar } = translations

  it('reads plainly in English', () => {
    expect(en.nextCheckpoint).toBe('Next checkpoint:')
    expect(en.checkpointAway(1, 'item')).toBe('1 item away')
    expect(en.checkpointAway(9, 'item')).toBe('9 items away')
    expect(en.moduleOf(3, 10)).toBe('Module 3 of 10')
  })

  it('agrees in French, its colon held to the label', () => {
    expect(fr.nextCheckpoint).toBe('Prochaine évaluation\u00a0:')
    expect(fr.checkpointAway(1, 'item')).toBe('dans 1 élément')
    expect(fr.checkpointAway(9, 'item')).toBe('dans 9 éléments')
    expect(fr.moduleOf(3, 10)).toBe('Module 3 sur 10')
  })

  it('counts in the genitive in Arabic', () => {
    expect(ar.nextCheckpoint).toBe('التقييم التالي:')
    expect(ar.checkpointAway(1, 'item')).toBe('على بُعد عنصر واحد')
    expect(ar.checkpointAway(2, 'item')).toBe('على بُعد عنصرين')
    expect(ar.checkpointAway(9, 'item')).toBe('على بُعد 9 عناصر')
    expect(ar.checkpointAway(11, 'item')).toBe('على بُعد 11 عنصرًا')
    expect(ar.checkpointAway(2)).toBe('على بُعد درسين')
    expect(ar.moduleOf(3, 10)).toBe('الوحدة 3 من 10')
  })

  it.each(langs)('%s counts lessons by default, as every count string does, items when told', (lang) => {
    const t = translations[lang]
    for (const n of [1, 2, 9, 14]) {
      expect(t.checkpointAway(n, 'lesson')).toBe(t.checkpointAway(n))
      expect(t.checkpointAway(n, 'item')).not.toBe(t.checkpointAway(n, 'lesson'))
    }
  })

  it.each(langs)('%s puts the module’s number in the words its milestone post uses', (lang) => {
    const t = translations[lang]
    const sub = t.milestoneModuleSub({ index: 3, total: 10, weeks: 2 })
    expect(sub.startsWith(t.moduleOf(3, 10))).toBe(true)
  })
})

/*
  A Creative Tech catch-up week. The status card plans the open items over the
  days left ("Catch-up week: 14 items to clear · 5 days left (about 3 a day)"),
  the list heads each week it draws on ("Week 12 · GD-4 — 10 open"), and
  "Catch up first" names the next catch-up week. Counts agree as each language
  counts, and each stays whole on its line: the status runs to two or three
  lines, and Arabic had broken "5 أيام" from its "متبقية".
*/
describe('the catch-up week’s copy', () => {
  const { en, fr, ar } = translations
  const plain = (text) => text.replace(/\u00a0/g, ' ')

  it('reads plainly in English', () => {
    expect(plain(en.statusCatchUpWeek(14, 5, 3))).toBe(
      'Catch-up week: 14 items to clear · 5 days left (about 3 a day)',
    )
    expect(plain(en.statusCatchUpWeek(1, 5, 0))).toBe(
      'Catch-up week: 1 item to clear · 5 days left',
    )
    expect(plain(en.statusCatchUpWeek(14, 1, 0))).toBe(
      'Catch-up week: 14 items to clear · 1 day left',
    )
    expect(en.statusCatchUpWeekClear).toBe("Catch-up week: you're all caught up.")
    expect(en.catchUpWeekOpen(10)).toBe('10 open')
    expect(en.catchUpWeekOpen(0)).toBe('all done')
    expect(en.catchUpShowAll(14)).toBe('Show all 14')
    expect(en.catchUpShowFewer).toBe('Show fewer')
    expect(plain(en.nextCatchUpWeek(10, 'Oct 27'))).toBe('Next catch-up week: Week 10, from Oct 27')
  })

  it('agrees in French', () => {
    expect(plain(fr.statusCatchUpWeek(14, 5, 3))).toBe(
      'Semaine de rattrapage : 14 éléments à terminer · 5 jours restants (environ 3 par jour)',
    )
    expect(plain(fr.statusCatchUpWeek(1, 1, 0))).toBe(
      'Semaine de rattrapage : 1 élément à terminer · 1 jour restant',
    )
    expect(plain(fr.statusCatchUpWeekClear)).toBe('Semaine de rattrapage : tu es à jour.')
    expect(fr.catchUpWeekOpen(1)).toBe('1 à rattraper')
    expect(fr.catchUpWeekOpen(10)).toBe('10 à rattraper')
    // A week cleared agrees with "semaine".
    expect(fr.catchUpWeekOpen(0)).toBe('rattrapée')
    expect(fr.catchUpShowAll(14)).toBe('Tout afficher (14)')
    expect(plain(fr.nextCatchUpWeek(10, '27 oct.'))).toBe(
      'Prochaine semaine de rattrapage : semaine 10, à partir du 27 oct.',
    )
  })

  it('counts as Arabic does: one, two, a few, many', () => {
    const items = (n) => plain(ar.statusCatchUpWeek(n, 5, 0)).split(' للإنهاء')[0]
    expect(items(1)).toBe('أسبوع استدراك: عنصر واحد')
    expect(items(2)).toBe('أسبوع استدراك: عنصران')
    expect(items(5)).toBe('أسبوع استدراك: 5 عناصر')
    expect(items(14)).toBe('أسبوع استدراك: 14 عنصرًا')
    const days = (d) => plain(ar.statusCatchUpWeek(3, d, 0)).split('· ')[1]
    expect(days(1)).toBe('يوم واحد متبقٍ')
    expect(days(2)).toBe('يومان متبقيان')
    expect(days(5)).toBe('5 أيام متبقية')
    expect(plain(ar.statusCatchUpWeek(14, 5, 3))).toMatch(/ \(نحو 3 في اليوم\)$/)
    expect(ar.statusCatchUpWeekClear).toBe('أسبوع استدراك: لا شيء متأخّر.')

    expect(ar.catchUpWeekOpen(1)).toBe('عنصر واحد مفتوح')
    expect(ar.catchUpWeekOpen(2)).toBe('عنصران مفتوحان')
    expect(ar.catchUpWeekOpen(10)).toBe('10 عناصر مفتوحة')
    expect(ar.catchUpWeekOpen(13)).toBe('13 عنصرًا مفتوحًا')
    expect(ar.catchUpWeekOpen(0)).toBe('مكتمل')
    expect(plain(ar.nextCatchUpWeek(13.5, '13 أكتوبر'))).toBe(
      'أسبوع الاستدراك القادم: الأسبوع 13.5، بدءًا من 13 أكتوبر',
    )
  })

  it.each(langs)('%s keeps each count whole, and the "·" off the start of a line', (lang) => {
    const t = translations[lang]
    for (const [n, d, per] of [[14, 5, 3], [1, 2, 0], [2, 7, 1]]) {
      const status = t.statusCatchUpWeek(n, d, per)
      // No break between a number and the words it counts.
      expect(status, `${lang} ${n}/${d}`).not.toMatch(/\d /)
      expect(status, `${lang} ${n}/${d}`).toMatch(/\u00a0· /)
    }
    // The week with its number, the date in one piece.
    const next = t.nextCatchUpWeek(10, formatShortDate(new Date(2026, 9, 27), lang))
    expect(next).toMatch(/\u00a010[,،] /)
    expect(next).not.toMatch(/\d /)
  })
})

/*
  A learner with nothing ticked: the first week's how-to in the status card,
  and "Already started?" past it. The count "Already started?" confirms is the
  size of the weeks before this one, which in Creative Tech runs into the
  hundreds (Graphic Design's Weeks 1–8 are 108 items), so Arabic reads it by
  its last two digits, as the number is said: "108 عناصر", not "108 عنصرًا".
*/
describe('the first week and "Already started?"', () => {
  const { en, fr, ar } = translations
  /** As read: no-break spaces as spaces, word joiners gone. */
  const plain = (text) => text.replace(/\u00a0/g, ' ').replace(/\u2060/g, '')

  it('reads plainly in English', () => {
    expect(plain(en.statusFirstWeek(1, 'lesson'))).toBe(
      'Week 1 is under way. Study each lesson on ALX, then tick it off here.',
    )
    expect(plain(en.statusFirstWeek(1, 'item'))).toBe(
      'Week 1 is under way. Do each item on ALX, then tick it off here.',
    )
    expect(en.alreadyStarted).toBe('Already started?')
    expect(plain(en.alreadyStartedAsk(9, 'Graphic Design', 1, 8))).toBe(
      "You're in Week 9 of Graphic Design. Have you already finished Weeks 1–8 on the ALX platform?",
    )
    expect(plain(en.alreadyStartedAsk(2, 'Data Analytics', 1, 1))).toBe(
      "You're in Week 2 of Data Analytics. Have you already finished Week 1 on the ALX platform?",
    )
    expect(plain(en.alreadyStartedYes(1, 8))).toBe('Yes, tick Weeks 1–8')
    expect(plain(en.alreadyStartedYes(1, 1))).toBe('Yes, tick Week 1')
    expect(en.alreadyStartedNotYet).toBe("Not yet, show me what's open")
    expect(en.alreadyStartedDone(108, 'item')).toBe('Marked 108 items done')
    expect(en.alreadyStartedDone(1, 'item')).toBe('Marked 1 item done')
    expect(en.alreadyStartedDone(14)).toBe('Marked 14 lessons done')
    expect(en.undo).toBe('Undo')
  })

  it('agrees in French', () => {
    expect(plain(fr.statusFirstWeek(1, 'lesson'))).toBe(
      'La semaine 1 est en cours. Étudie chaque leçon sur ALX, puis coche-la ici.',
    )
    // "Élément" is masculine: coche-le.
    expect(plain(fr.statusFirstWeek(1, 'item'))).toBe(
      'La semaine 1 est en cours. Termine chaque élément sur ALX, puis coche-le ici.',
    )
    expect(plain(fr.alreadyStartedAsk(9, 'Design graphique', 1, 8))).toBe(
      'Tu es en semaine 9 du parcours Design graphique. As-tu déjà terminé les semaines 1 à 8 sur la plateforme ALX\u202f?',
    )
    expect(plain(fr.alreadyStartedAsk(2, 'Data Analytics', 1, 1))).toMatch(/As-tu déjà terminé la semaine 1 /)
    expect(plain(fr.alreadyStartedYes(1, 8))).toBe('Oui, cocher les semaines 1 à 8')
    expect(plain(fr.alreadyStartedYes(1, 1))).toBe('Oui, cocher la semaine 1')
    expect(fr.alreadyStartedDone(108, 'item')).toBe('108 éléments cochés')
    expect(fr.alreadyStartedDone(1, 'item')).toBe('1 élément coché')
    expect(fr.alreadyStartedDone(14)).toBe('14 leçons cochées')
    expect(fr.undo).toBe('Annuler')
  })

  it('reads in Arabic, the count past a hundred by its last two digits', () => {
    expect(plain(ar.statusFirstWeek(1, 'lesson'))).toBe(
      'بدأ الأسبوع 1. ادرس كل درس على منصة ALX، ثم ضع علامة عليه هنا.',
    )
    expect(plain(ar.statusFirstWeek(1, 'item'))).toBe(
      'بدأ الأسبوع 1. أنجز كل عنصر على منصة ALX، ثم ضع علامة عليه هنا.',
    )
    expect(plain(ar.alreadyStartedAsk(9, 'التصميم الجرافيكي', 1, 8))).toBe(
      'أنت في الأسبوع 9 من مسار التصميم الجرافيكي. هل أنهيت بالفعل الأسابيع 1–8 على منصة ALX؟',
    )
    expect(plain(ar.alreadyStartedYes(1, 1))).toBe('نعم، ضع علامة على الأسبوع 1')

    // After "on" (على), in the genitive.
    const count = (n, unit = 'item') => ar.alreadyStartedDone(n, unit).replace('تم وضع علامة على ', '')
    expect(count(1)).toBe('عنصر واحد')
    expect(count(2)).toBe('عنصرين')
    expect(count(5)).toBe('5 عناصر')
    expect(count(14)).toBe('14 عنصرًا')
    expect(count(100)).toBe('100 عنصر')
    expect(count(102)).toBe('102 عنصر')
    expect(count(108)).toBe('108 عناصر')
    expect(count(110)).toBe('110 عناصر')
    expect(count(113)).toBe('113 عنصرًا')
    expect(count(200)).toBe('200 عنصر')
    expect(count(250)).toBe('250 عنصرًا')
    expect(count(2, 'lesson')).toBe('درسين')
    expect(count(14, 'lesson')).toBe('14 درسًا')
    expect(ar.undo).toBe('تراجع')
  })

  it.each(langs)('%s keeps each week with its number, and a span of weeks in one piece', (lang) => {
    const t = translations[lang]
    for (const text of [
      t.statusFirstWeek(1, 'item'),
      t.alreadyStartedAsk(9, t.programs.gd, 1, 8),
      t.alreadyStartedYes(1, 8),
      t.alreadyStartedYes(1, 13.5),
    ]) {
      // No ordinary space before a number: no line ends on "Week" or "à"
      // and starts the next on "9".
      expect(text, `${lang}: ${text}`).not.toMatch(/[^\s\d.] \d/)
      // A dash in a span is held to the number after it.
      expect(text, `${lang}: ${text}`).not.toMatch(/–(?!\u2060)/)
    }
  })

  it.each(langs)('%s counts lessons by default, as every count string does, items when told', (lang) => {
    const t = translations[lang]
    for (const n of [1, 2, 9, 14, 108]) {
      expect(t.alreadyStartedDone(n, 'lesson')).toBe(t.alreadyStartedDone(n))
      expect(t.alreadyStartedDone(n, 'item')).not.toBe(t.alreadyStartedDone(n, 'lesson'))
    }
    expect(t.statusFirstWeek(1, 'item')).not.toBe(t.statusFirstWeek(1, 'lesson'))
  })
})

/*
  Numbers as each language writes them. French marks a decimal with a comma,
  yet the pace card read "3.1 leçons/semaine" and Graphic Design's weeks
  "Semaine 13.5". English and Arabic keep the point, Arabic in the Western
  digits the rest of its UI uses: its locale, ar-u-nu-latn, writes "13.5" too.
  A whole number reads as it always has in every language: nothing is grouped.
*/
describe('numbers as each language writes them', () => {
  const { en, fr, ar } = translations
  /** As read: no-break spaces as spaces, word joiners gone. */
  const plain = (text) => text.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2060/g, '')

  it('marks a decimal with a comma in French, wherever a week or a pace has one', () => {
    expect(fr.number(13.5)).toBe('13,5')
    expect(fr.paceValue(3.1)).toBe('3,1 leçons/semaine')
    expect(fr.paceValue(14.8, 'item')).toBe('14,8 éléments/semaine')
    expect(fr.weekRange(13.5, 13.5)).toBe('Semaine 13,5')
    expect(fr.weekRange(11, 13.5)).toBe('Semaines 11–13,5')
    expect(fr.weekOf(13.5, 32)).toBe('Semaine 13,5 sur 32')
    expect(fr.weekSlogan(13.5, 'Apprendre. Créer. Recommencer.')).toBe(
      'Semaine 13,5 — Apprendre. Créer. Recommencer.',
    )
    expect(fr.reminderTitle(14.5, 32)).toBe('ALX Pace — Semaine 14,5 sur 32')
    expect(plain(fr.forecastOldestOpen(14.5))).toBe('à rattraper dès la semaine 14,5')
    expect(plain(fr.getAheadMore(2, 14.5))).toBe('+2 autres en semaine 14,5')
    expect(plain(fr.milestonesAllDone(1, 13.5))).toBe(
      'L’évaluation notée de la semaine 13,5 est terminée.',
    )
    expect(plain(fr.nextCatchUpWeek(13.5, '13 oct.'))).toBe(
      'Prochaine semaine de rattrapage : semaine 13,5, à partir du 13 oct.',
    )
    expect(plain(fr.alreadyStartedAsk(14.5, 'Design graphique', 1, 13.5))).toBe(
      'Tu es en semaine 14,5 du parcours Design graphique. As-tu déjà terminé les semaines 1 à 13,5 sur la plateforme ALX ?',
    )
    expect(plain(fr.alreadyStartedYes(1, 13.5))).toBe('Oui, cocher les semaines 1 à 13,5')
  })

  it('keeps the point in English and Arabic, Arabic in Western digits', () => {
    expect(en.number(13.5)).toBe('13.5')
    expect(en.paceValue(3.1)).toBe('3.1 lessons/week')
    expect(en.weekOf(13.5, 32)).toBe('Week 13.5 of 32')
    expect(ar.number(13.5)).toBe('13.5')
    expect(ar.paceValue(3.1)).toBe('3.1 درس/أسبوع')
    expect(ar.weekOf(13.5, 32)).toBe('الأسبوع 13.5 من 32')
    expect(ar.weekRange(11, 13.5)).toBe('الأسابيع 11–13.5')
  })

  it.each(langs)('writes every week of every program in %s, and whole numbers as before', (lang) => {
    const t = translations[lang]
    const weeks = Object.values(SCHEDULES).flatMap((s) => s.weeks.map((w) => w.week))
    for (const n of [...weeks, 0, 3.1, 14, 22, 32, 373, 1234]) {
      // Only French's decimal mark differs, and nothing is grouped: "1234".
      const expected = lang === 'fr' ? String(n).replace('.', ',') : String(n)
      expect(t.number(n), `${lang} ${n}`).toBe(expected)
    }
  })
})

/*
  A week as the sheet labels it, "Week 13 (½ week)" or "Week 13.5 (Buffer)",
  in the learner's language. The sheet is English, and its label headed the
  French and Arabic focus card, followed "Pour commencer" in the countdown, and
  ended "2 à rendre en Week 4" in the graded card. English reads exactly as
  the sheet does.
*/
describe('the week as the sheet labels it', () => {
  const { en, fr, ar } = translations
  const plain = (text) => text.replace(/\u00a0/g, ' ')
  const weeks = Object.values(SCHEDULES).flatMap((s) => s.weeks)
  const gdWeek = (n) => SCHEDULES.gd.weeks.find((w) => w.week === n)
  const daWeek4 = SCHEDULES.da.weeks.find((w) => w.week === 4)

  it('reads in English exactly as the sheet does, for every week of every program', () => {
    for (const week of weeks) expect(plain(en.weekLabel(week))).toBe(week.weekLabel)
  })

  it.each(['fr', 'ar'])('names every week in %s, never in the sheet’s English', (lang) => {
    const t = translations[lang]
    for (const week of weeks) {
      const label = plain(t.weekLabel(week))
      expect(label, label).not.toMatch(/Week|week|Buffer/)
      expect(label.startsWith(t.weekRange(week.week, week.week)), label).toBe(true)
    }
  })

  it('names the kind of week in the words of the roadmap’s chips', () => {
    expect(plain(fr.weekLabel(gdWeek(13)))).toBe('Semaine 13 (½ semaine)')
    expect(plain(fr.weekLabel(gdWeek(13.5)))).toBe('Semaine 13,5 (rattrapage)')
    expect(plain(fr.weekLabel(daWeek4))).toBe('Semaine 4')
    expect(plain(ar.weekLabel(gdWeek(13)))).toBe('الأسبوع 13 (نصف أسبوع)')
    expect(plain(ar.weekLabel(gdWeek(13.5)))).toBe('الأسبوع 13.5 (استدراك)')
    expect(plain(ar.weekLabel(daWeek4))).toBe('الأسبوع 4')
  })

  it.each(langs)('keeps the number with its word, and the half with its week, in %s', (lang) => {
    // The one ordinary space comes before the kind, where a line may break.
    const t = translations[lang]
    for (const week of weeks) {
      const label = t.weekLabel(week)
      expect(label.split(' ').length, label).toBe(week.isBuffer || week.isHalf ? 2 : 1)
    }
  })

  it('counts the graded items due in that week, in its own words', () => {
    expect(plain(en.milestonesDue(2, daWeek4))).toBe(
      '2 due in Week 4 — these count toward your grade.',
    )
    expect(plain(en.milestonesDue(1, gdWeek(13)))).toBe(
      '1 due in Week 13 (½ week) — these count toward your grade.',
    )
    // Inside a sentence, "semaine", as French has it everywhere else.
    expect(plain(fr.milestonesDue(2, daWeek4))).toBe(
      '2 à rendre en semaine 4 — elles comptent pour ta note.',
    )
    expect(plain(fr.milestonesDue(1, gdWeek(13)))).toBe(
      '1 à rendre en semaine 13 (½ semaine) — elle compte pour ta note.',
    )
    expect(plain(ar.milestonesDue(2, daWeek4))).toBe('2 مستحقة في الأسبوع 4 — وهي تُحتسب في درجتك.')
    expect(plain(ar.milestonesDue(1, gdWeek(13)))).toBe(
      '1 مستحقة في الأسبوع 13 (نصف أسبوع) — وهي تُحتسب في درجتك.',
    )
  })
})

/*
  The page's title follows the language (LanguageContext sets it). It stayed
  index.html's English on the browser's tab, in its history and in bookmarks.
  The brand leads it in every language, and English is index.html's own.
*/
describe('the page title', () => {
  it.each(langs)('leads with the brand in %s', (lang) => {
    expect(translations[lang].pageTitle).toMatch(/^ALX Pace — \S/)
  })

  it('is index.html’s own in English, and translated in French and Arabic', () => {
    const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
    expect(html).toContain(`<title>${translations.en.pageTitle}</title>`)
    expect(translations.fr.pageTitle).toBe('ALX Pace — Suivi à ton rythme')
    expect(translations.ar.pageTitle).toBe('ALX Pace — متابعة بالوتيرة الذاتية')
  })
})

/*
  Every key is read somewhere in the app. One that nothing reads is a string
  no learner sees, still kept up in three languages: changeProgram had
  outlived whatever it once named. A key is read as `t.key`, or named as a
  string where a component looks one up (GradedBadge's labelKey).
*/
describe('every key', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const source = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split('\\').join('/'))
    .filter((f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f) && f !== 'i18n/translations.js')
    .map((f) => readFileSync(join(SRC, f), 'utf8'))
    .join('\n')

  it('is read somewhere in the app', () => {
    // A guard that reads nothing would pass on nothing.
    expect(source).toContain('useLang()')
    const unread = Object.keys(translations.en).filter(
      (key) => !new RegExp(`\\.${key}\\b|['"]${key}['"]`).test(source),
    )
    expect(unread).toEqual([])
  })
})
