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
    expect(fr.paceValue(1.5)).toBe('1.5 leçon/semaine')
    expect(fr.paceValue(3.1, 'item')).toBe('3.1 éléments/semaine')
    expect(fr.catchUpMore(1)).toMatch(/^\+1 encore ouvert —/)
    expect(fr.catchUpMore(8)).toMatch(/^\+8 encore ouverts —/)
    expect(fr.reminderBehind(3, 1)).toMatch(/· 1 évaluation cette semaine\.$/)
    expect(fr.reminderBehind(3, 2)).toMatch(/· 2 évaluations cette semaine\.$/)
    expect(fr.milestonesDue(1, 'Week 5')).toContain('elle compte pour ta note')
    expect(fr.milestonesDue(2, 'Week 4')).toContain('elles comptent pour ta note')
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
    for (const n of [1, 2, 3]) {
      const line = t.milestonesAllDone(n, 13.5)
      expect(line).toMatch(/ 13\.5/)
      if (lang !== 'en') expect(line).not.toMatch(/Week/)
    }
    expect(t.getAheadMore(4, 13.5, 'item')).toMatch(/ 13\.5$/)
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
    const line = translations[lang].forecastOldestOpen(13.5)
    expect(line).toMatch(/\u00a013\.5$/)
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
