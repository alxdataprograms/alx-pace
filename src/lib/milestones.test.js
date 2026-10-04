import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import {
  achievedMilestones,
  buildPostText,
  CAMPAIGN_HASHTAG,
  milestoneIds,
  milestonesCrossed,
  nextToCelebrate,
  postParts,
  pruneCelebrated,
} from './milestones'
import { buildScheduleFromCsv } from './scheduleModel'
import { PROGRAMS } from './programs'
import { translations } from '../i18n/translations'

/*
  Run against the REAL curriculum, not a fixture.

  The whole feature rests on "a module is complete when every lesson in it is
  ticked", and a fixture with tidy modules would pass while the shipped CSV —
  merged cells, multi-line graded rows, uneven module sizes — did something
  else. This is the same reasoning as scripts/verify-parser.mjs.
*/
const load = (id) =>
  buildScheduleFromCsv(
    readFileSync(fileURLToPath(new URL(`../data/${PROGRAMS[id].csv}`, import.meta.url)), 'utf8'),
    { layout: PROGRAMS[id].layout },
  )
const SCHEDULE = load('da')
const CC = load('cc')
const GD = load('gd')

const lessonsOf = (module) => module.weeks.flatMap((w) => w.lessons)
const idsOf = (modules) => new Set(modules.flatMap(lessonsOf).map((l) => l.id))

/** Every milestone a program has, as if the learner had ticked everything. */
const everyMilestone = (schedule, programId) =>
  achievedMilestones(schedule, new Set(schedule.lessons.map((l) => l.id)), programId)
const milestoneOf = (schedule, programId, id) =>
  everyMilestone(schedule, programId).find((m) => m.id === id)
/** The two post templates of one language, as the dialogue passes them. */
const postStrings = (lang) => ({
  moduleDone: translations[lang].postModuleDone,
  programmeDone: translations[lang].postProgrammeDone,
})

describe('achievedMilestones', () => {
  it('finds nothing when nothing is complete', () => {
    expect(achievedMilestones(SCHEDULE, new Set())).toEqual([])
  })

  it('does not fire on a module that is only nearly done', () => {
    const first = SCHEDULE.modules[0]
    const allButOne = lessonsOf(first).slice(0, -1).map((l) => l.id)
    expect(achievedMilestones(SCHEDULE, new Set(allButOne))).toEqual([])
  })

  it('fires the moment the last lesson of a module is ticked', () => {
    const first = SCHEDULE.modules[0]
    const got = achievedMilestones(SCHEDULE, idsOf([first]))
    expect(got).toHaveLength(1)
    expect(got[0].id).toBe(`module:${first.code}`)
    expect(got[0].index).toBe(1)
    expect(got[0].total).toBe(SCHEDULE.modules.length)
  })

  it('adds the programme milestone only when every lesson is done', () => {
    const everything = new Set(SCHEDULE.lessons.map((l) => l.id))
    const got = achievedMilestones(SCHEDULE, everything)
    expect(got.map((m) => m.id)).toEqual([
      ...SCHEDULE.modules.map((m) => `module:${m.code}`),
      'programme',
    ])
  })

  it('does not announce an achievement for an empty module', () => {
    // [].every(...) is true, so a module with no lessons would otherwise be
    // "complete" from the moment the app loads.
    const empty = { modules: [{ code: 'X', title: 'Nothing', weeks: [] }], lessons: [], totalLessons: 0 }
    expect(achievedMilestones(empty, new Set())).toEqual([])
  })

  it('is derived, so un-ticking a lesson withdraws the milestone', () => {
    const first = SCHEDULE.modules[0]
    const ids = [...idsOf([first])]
    expect(achievedMilestones(SCHEDULE, new Set(ids))).toHaveLength(1)
    expect(achievedMilestones(SCHEDULE, new Set(ids.slice(1)))).toHaveLength(0)
  })
})

describe('nextToCelebrate', () => {
  it('offers the LATEST unseen one when several are crossed at once', () => {
    // Someone catching up ticks a backlog in one sitting. Congratulating them
    // on module one while module two is also done reads as the app lagging.
    const achieved = achievedMilestones(SCHEDULE, idsOf(SCHEDULE.modules.slice(0, 2)))
    expect(achieved).toHaveLength(2)
    expect(nextToCelebrate(achieved, [])?.id).toBe(achieved[1].id)
  })

  it('returns nothing once every achieved milestone has been seen', () => {
    const achieved = achievedMilestones(SCHEDULE, idsOf(SCHEDULE.modules.slice(0, 2)))
    expect(nextToCelebrate(achieved, achieved.map((m) => m.id))).toBeNull()
  })

  it('still offers a newer one when older ones are already seen', () => {
    const achieved = achievedMilestones(SCHEDULE, idsOf(SCHEDULE.modules.slice(0, 3)))
    const seen = [achieved[0].id, achieved[1].id]
    expect(nextToCelebrate(achieved, seen)?.id).toBe(achieved[2].id)
  })

  it('copes with a seen list containing ids this build no longer produces', () => {
    const achieved = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))
    expect(nextToCelebrate(achieved, ['module:GONE', 'nonsense'])?.id).toBe(achieved[0].id)
  })
})

/*
  "Already started?" ticks the weeks before this one in one go, for a learner
  who did them on ALX before finding Pace, and records the milestones that
  crosses as shown: a LinkedIn dialogue for a module finished weeks ago must
  not open the moment the app is set up.
*/
describe('milestonesCrossed', () => {
  const before = (schedule, week) => schedule.lessons.filter((l) => l.week < week).map((l) => l.id)

  it('names the modules the ticks complete, in order', () => {
    // Graphic Design's Weeks 1–8 are its first two modules.
    expect(milestonesCrossed(GD, new Set(), before(GD, 9), 'gd', [])).toEqual([
      'module:GD-1',
      'module:GD-2',
    ])
    expect(milestonesCrossed(SCHEDULE, new Set(), before(SCHEDULE, 6), 'da', [])).toEqual([
      'module:DA-1',
      'module:DA-2',
    ])
  })

  it('leaves out what has been seen, and nothing else: another program’s records count for nothing', () => {
    const ids = before(GD, 9)
    expect(milestonesCrossed(GD, new Set(), ids, 'gd', ['module:GD-1'])).toEqual(['module:GD-2'])
    expect(milestonesCrossed(GD, new Set(), ids, 'gd', ['module:DA-1', 'programme'])).toEqual([
      'module:GD-1',
      'module:GD-2',
    ])
  })

  it('counts what was ticked already, and reaches the programme once everything is', () => {
    const all = CC.lessons.map((l) => l.id)
    expect(milestonesCrossed(CC, new Set(all.slice(0, 10)), all.slice(10), 'cc', [])).toEqual([
      ...CC.modules.map((m) => `module:${m.code}`),
      'programme:cc',
    ])
  })

  it('is empty when the ticks complete nothing, and copes with a corrupt seen list', () => {
    expect(milestonesCrossed(GD, new Set(), before(GD, 3), 'gd', [])).toEqual([])
    expect(milestonesCrossed(GD, new Set(), before(GD, 9), 'gd', { not: 'an array' })).toEqual([
      'module:GD-1',
      'module:GD-2',
    ])
  })
})

describe('buildPostText', () => {
  const t = {
    moduleDone: (m) => `Finished ${m.title} — module ${m.index} of ${m.total}.`,
    programmeDone: (m) => `Finished the whole thing in ${m.weeks} weeks.`,
  }

  it('always ends with the campaign hashtag on its own line', () => {
    // The hashtag is the point of the feature. On its own line because that is
    // how ALX writes it, and because it is then obvious if someone trims it
    // while editing on LinkedIn.
    const achieved = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))
    const post = buildPostText(achieved[0], t)
    expect(post.endsWith(`\n\n${CAMPAIGN_HASHTAG}`)).toBe(true)
    expect(post.split('\n').at(-1)).toBe(CAMPAIGN_HASHTAG)
  })

  it('carries the hashtag on the programme post too', () => {
    const everything = new Set(SCHEDULE.lessons.map((l) => l.id))
    const programme = achievedMilestones(SCHEDULE, everything).at(-1)
    expect(buildPostText(programme, t)).toContain(CAMPAIGN_HASHTAG)
  })

  it('uses the programme wording for the programme, not the module wording', () => {
    const everything = new Set(SCHEDULE.lessons.map((l) => l.id))
    const programme = achievedMilestones(SCHEDULE, everything).at(-1)
    expect(buildPostText(programme, t)).toContain('the whole thing')
  })

  it('stays short enough to survive being carried in a URL', () => {
    // The entire post travels in a query string. Browsers differ on the limit;
    // staying well under any of them is the cheap way not to find out which.
    const everything = new Set(SCHEDULE.lessons.map((l) => l.id))
    for (const m of achievedMilestones(SCHEDULE, everything)) {
      const encoded = encodeURIComponent(buildPostText(m, t))
      expect(encoded.length, `${m.id} encodes to ${encoded.length} chars`).toBeLessThan(1500)
    }
  })

  it('stays that short in every language, for every program, now posts name a project', () => {
    // Arabic letters encode to six characters each, and a Creative Tech module
    // post carries two English titles, so the real strings are what count.
    for (const [id, schedule] of [['da', SCHEDULE], ['cc', CC], ['gd', GD]]) {
      for (const m of everyMilestone(schedule, id)) {
        for (const lang of Object.keys(translations)) {
          const encoded = encodeURIComponent(buildPostText(m, postStrings(lang)))
          expect(encoded.length, `${lang} ${m.id} encodes to ${encoded.length} chars`).toBeLessThan(1500)
        }
      }
    }
  })
})

/*
  The figures a learner publishes under their own name, often to employers.

  A Graphic Design graduate was offered "33 weeks, 373 lessons" for a 32-week
  programme whose 373 rows are 273 lessons, 70 activities and 30 graded
  items, and "4 weeks" for modules the curriculum calls 3½.
*/
describe('the numbers a milestone carries', () => {
  it('gives the programme its length, not its count of week entries', () => {
    // GD's half week 13 and the buffer that starts half-way through it, 13.5,
    // are two entries of the 32 weeks: counting entries said 33.
    expect(GD.weeks).toHaveLength(33)
    expect(milestoneOf(GD, 'gd', 'programme:gd').weeks).toBe(32)
    expect(milestoneOf(CC, 'cc', 'programme:cc').weeks).toBe(22)
    expect(milestoneOf(SCHEDULE, 'da', 'programme').weeks).toBe(14)
  })

  it('measures a module by the days it spans, so a half week counts as half', () => {
    const weeks = (schedule, id) =>
      everyMilestone(schedule, id)
        .filter((m) => m.kind === 'module')
        .map((m) => m.weeks)
    // GD-4 and GD-8 each hold a half week: four entries, three and a half weeks.
    expect(weeks(GD, 'gd')).toEqual([4, 4, 2, 3.5, 4, 3, 4, 3.5, 2, 2])
    expect(weeks(CC, 'cc')).toEqual([4, 6, 4, 6, 2])
  })

  it('leaves every Data Analytics module the whole weeks it always had', () => {
    expect(
      everyMilestone(SCHEDULE, 'da')
        .filter((m) => m.kind === 'module')
        .map((m) => m.weeks),
    ).toEqual(SCHEDULE.modules.map((m) => m.weeks.length))
  })

  it('counts Creative Tech rows as items and Data Analytics rows as lessons', () => {
    expect(new Set(everyMilestone(GD, 'gd').map((m) => m.unit))).toEqual(new Set(['item']))
    expect(new Set(everyMilestone(CC, 'cc').map((m) => m.unit))).toEqual(new Set(['item']))
    expect(new Set(everyMilestone(SCHEDULE, 'da').map((m) => m.unit))).toEqual(new Set(['lesson']))
  })

  it('names a Creative Tech module’s mastery project, and none for Data Analytics', () => {
    expect(milestoneOf(GD, 'gd', 'module:GD-3').masteryProject).toBe('Poster Design')
    expect(milestoneOf(CC, 'cc', 'module:CC-5').masteryProject).toBe('Creator Venture Canvas')
    expect(everyMilestone(SCHEDULE, 'da').map((m) => m.masteryProject)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('keeps every programme total in the 11–99 band its Arabic noun is written for', () => {
    // 27, 250 and 373 each end in 11–99, which counts the noun in the singular
    // accusative (درساً, عنصرًا). A total ending in 00–10 would need another
    // form, so a sheet edit that lands on one has to revisit the post.
    for (const schedule of [SCHEDULE, CC, GD]) {
      expect(schedule.totalLessons % 100).toBeGreaterThanOrEqual(11)
    }
  })
})

describe('what the post says, in every language', () => {
  it('gives a Graphic Design graduate the real figures', () => {
    const m = milestoneOf(GD, 'gd', 'programme:gd')
    expect(translations.en.postProgrammeDone(m)).toBe(
      'I have finished the ALX Graphic Design programme: 32 weeks, 373 items, all 10 modules.',
    )
    expect(translations.fr.postProgrammeDone(m)).toBe(
      'J’ai terminé le parcours ALX Graphic Design : 32 semaines, 373 éléments, les 10 modules.',
    )
    expect(translations.ar.postProgrammeDone(m)).toBe(
      'أنهيت برنامج ALX للتصميم الجرافيكي: 32 أسبوعاً، و373 عنصرًا، وكل الوحدات 10.',
    )
    expect(translations.en.milestoneProgrammeSub(m)).toBe('All 10 modules, 373 items, 32 weeks.')
    expect(translations.fr.milestoneProgrammeSub(m)).toBe('Les 10 modules, 373 éléments, 32 semaines.')
    expect(translations.ar.milestoneProgrammeSub(m)).toBe('كل الوحدات 10، و373 عنصرًا، و32 أسبوعاً.')
  })

  it('names the mastery project at the end of a Creative Tech module post', () => {
    const m = milestoneOf(GD, 'gd', 'module:GD-3')
    expect(translations.en.postModuleDone(m)).toBe(
      'I have just finished Poster Design & Visual Composition — module 3 of 10 in the ALX Graphic Design programme, including my mastery project: Poster Design.',
    )
    expect(translations.fr.postModuleDone(m)).toBe(
      'Je viens de terminer Poster Design & Visual Composition — module 3 sur 10 du parcours ALX Graphic Design, y compris mon projet de maîtrise : Poster Design.',
    )
    // The title stays in English: it is the name learners match on the ALX
    // platform. It ends the sentence, where a Latin run in Arabic stays put.
    expect(translations.ar.postModuleDone(m)).toBe(
      'أنهيت للتو Poster Design & Visual Composition — الوحدة 3 من 10 في برنامج ALX للتصميم الجرافيكي، بما في ذلك مشروع الإتقان: Poster Design.',
    )
  })

  it('says a half week the way each language does', () => {
    const m = milestoneOf(GD, 'gd', 'module:GD-4')
    expect(translations.en.milestoneModuleSub(m)).toBe('Module 4 of 10, 3½ weeks of it.')
    expect(translations.fr.milestoneModuleSub(m)).toBe('Module 4 sur 10, 3 semaines et demie.')
    expect(translations.ar.milestoneModuleSub(m)).toBe('الوحدة 4 من 10، 3 أسابيع ونصف.')
  })

  it('leaves every Data Analytics post and dialogue line word for word as it was', () => {
    const da = (id) => milestoneOf(SCHEDULE, 'da', id)
    // Captured from the build before Creative Tech posts were corrected.
    expect(translations.en.postProgrammeDone(da('programme'))).toBe(
      'I have finished the ALX Data Analytics programme: 14 weeks, 27 lessons, all 4 modules.',
    )
    expect(translations.fr.postProgrammeDone(da('programme'))).toBe(
      'J’ai terminé le parcours ALX Data Analytics : 14 semaines, 27 leçons, les 4 modules.',
    )
    expect(translations.ar.postProgrammeDone(da('programme'))).toBe(
      'أنهيت برنامج ALX لتحليل البيانات: 14 أسبوعاً، و27 درساً، وكل الوحدات 4.',
    )
    expect(translations.en.milestoneProgrammeSub(da('programme'))).toBe('All 4 modules, 27 lessons, 14 weeks.')
    expect(translations.fr.milestoneProgrammeSub(da('programme'))).toBe('Les 4 modules, 27 leçons, 14 semaines.')
    expect(translations.ar.milestoneProgrammeSub(da('programme'))).toBe('كل الوحدات 4، و27 درساً، و14 أسبوعاً.')
    expect(translations.en.postModuleDone(da('module:DA-3'))).toBe(
      'I have just finished SQL for Data Analytics — module 3 of 4 in the ALX Data Analytics programme.',
    )
    expect(translations.fr.postModuleDone(da('module:DA-3'))).toBe(
      'Je viens de terminer SQL for Data Analytics — module 3 sur 4 du parcours ALX Data Analytics.',
    )
    expect(translations.ar.postModuleDone(da('module:DA-3'))).toBe(
      'أنهيت للتو SQL for Data Analytics — الوحدة 3 من 4 في برنامج ALX لتحليل البيانات.',
    )
    expect(translations.en.milestoneModuleSub(da('module:DA-3'))).toBe('Module 3 of 4, 5 weeks of it.')
    expect(translations.fr.milestoneModuleSub(da('module:DA-3'))).toBe('Module 3 sur 4, 5 semaines.')
    expect(translations.ar.milestoneModuleSub(da('module:DA-3'))).toBe('الوحدة 3 من 4، 5 أسابيع.')
  })
})

/*
  On screen, the post is shown in runs so the English curriculum titles can be
  isolated in Arabic, as the URL and the hashtag are. The runs must be the post
  and nothing else, or what a learner reads stops being what they publish.
*/
describe('the post as the dialogue shows it', () => {
  const langs = Object.keys(translations)

  it.each(langs)('%s: the runs join back into exactly the posted body', (lang) => {
    for (const [id, schedule] of [['da', SCHEDULE], ['cc', CC], ['gd', GD]]) {
      for (const m of everyMilestone(schedule, id)) {
        const { body, runs } = postParts(m, postStrings(lang))
        expect(runs.map((r) => r.text).join(''), `${lang} ${m.id}`).toBe(body)
        // The marks that locate the titles never reach anything posted.
        expect(buildPostText(m, postStrings(lang))).not.toMatch(/[\uE000\uE001]/)
      }
    }
  })

  it('isolates the module title and the project name, though one contains the other', () => {
    // GD-3 is "Poster Design & Visual Composition"; its project is "Poster
    // Design". Searching the sentence for the project would find it inside the
    // module's title, which is why the titles are marked instead.
    const m = milestoneOf(GD, 'gd', 'module:GD-3')
    const isolated = postParts(m, postStrings('ar'))
      .runs.filter((r) => r.isolate)
      .map((r) => r.text)
    expect(isolated).toEqual(['Poster Design & Visual Composition', 'Poster Design'])
  })

  it('isolates nothing in a programme post, which names no curriculum title', () => {
    const m = milestoneOf(GD, 'gd', 'programme:gd')
    expect(postParts(m, postStrings('ar')).runs.some((r) => r.isolate)).toBe(false)
  })
})

/*
  A structural check, because this bug is invisible to every other kind.

  Rendered inside the Arabic paragraph, "#IAmTheStory_ALX" came out as
  "IAmTheStory_ALX#" — the bidirectional algorithm moves a leading # to the
  visual end of a Latin run in RTL text. The STRING was always correct, so the
  post that reached LinkedIn was fine and no assertion on the text would have
  caught it. Only looking at the screen did.

  The fix is a <bdi> isolate around the hashtag. This asserts it stays there,
  since the component would keep working — and keep looking broken to Arabic
  learners — if someone simplified it away.
*/
describe('the celebration renders the hashtag as an isolated run', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../components/MilestoneCelebration.jsx', import.meta.url)),
    'utf8',
  )

  it('wraps the hashtag in <bdi dir="ltr">', () => {
    expect(source).toMatch(/<bdi dir="ltr">\{hashtag\}<\/bdi>/)
  })

  it('wraps the app URL too, which has the same problem', () => {
    // A bare Latin URL in an RTL paragraph is reordered exactly like the
    // hashtag was. It was added to the post after that bug was fixed, so it
    // never went out broken — this is here so it cannot start.
    expect(source).toMatch(/<bdi dir="ltr">\{url\}<\/bdi>/)
  })

  it('still copies the whole post, hashtag included, not the split display text', () => {
    // The display splits body from hashtag; what is copied must not.
    expect(source).toMatch(/shareToLinkedIn\(post\)/)
  })
})

describe('pruneCelebrated', () => {
  it('returns null when every seen milestone is still achieved', () => {
    // Runs on every change to completed lessons, so "nothing to do" has to be
    // distinguishable from "here is an identical array" or it writes forever.
    const achieved = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))
    expect(pruneCelebrated(achieved, ['module:DA-1'])).toBeNull()
    expect(pruneCelebrated(achieved, [])).toBeNull()
  })

  it('drops records for milestones that are no longer achieved', () => {
    const achieved = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))
    expect(pruneCelebrated(achieved, ['module:DA-1', 'module:DA-2', 'programme']))
      .toEqual(['module:DA-1'])
  })

  it('copes with a corrupt or absent seen list', () => {
    expect(pruneCelebrated([], null)).toBeNull()
    expect(pruneCelebrated([], 'nonsense')).toBeNull()
  })

  /*
    THE BUG THIS SHIPPED WITH, REPRODUCED.

    Found on a real device with 16 of 27 lessons ticked and all five milestones
    recorded as seen — a state the feature could never recover from on its own.

    The path is ordinary: tick everything to see what the app does, get the
    programme dialogue, dismiss it. Dismissing marks EVERY achieved milestone
    seen, so all five are burnt at once. Then un-tick back to real progress.
    Achievement is derived and withdraws correctly; the seen-records were not,
    and stayed. Every future module completion was then silently suppressed,
    with nothing on screen to explain it.
  */
  it('recovers the state that had permanently suppressed every celebration', () => {
    const everything = new Set(SCHEDULE.lessons.map((l) => l.id))

    // Ticked everything, saw the programme dialogue, dismissed it.
    const allAchieved = achievedMilestones(SCHEDULE, everything)
    const burnt = allAchieved.map((m) => m.id)
    expect(burnt).toHaveLength(5)

    // Un-ticked back to just the first module.
    const backToOne = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))

    // Before the fix this stayed at five and nothing could ever fire again.
    expect(pruneCelebrated(backToOne, burnt)).toEqual(['module:DA-1'])

    // And the proof it is actually recovered: finishing module two celebrates.
    const pruned = pruneCelebrated(backToOne, burnt)
    const afterTwo = achievedMilestones(SCHEDULE, idsOf(SCHEDULE.modules.slice(0, 2)))
    expect(nextToCelebrate(afterTwo, pruned)?.id).toBe('module:DA-2')
  })

  it('leaves a genuinely-seen milestone suppressed', () => {
    // The fix must not turn the dialogue into something that reappears for work
    // the learner has already been congratulated on and has not undone.
    const achieved = achievedMilestones(SCHEDULE, idsOf([SCHEDULE.modules[0]]))
    const pruned = pruneCelebrated(achieved, ['module:DA-1'])
    expect(pruned).toBeNull()
    expect(nextToCelebrate(achieved, ['module:DA-1'])).toBeNull()
  })
})

/*
  Every program shares ONE alx-celebrated array, the same way completedLessons
  is shared. Two things follow, and both are tested against the real sheets.
*/
describe('across programs', () => {
  const everything = (s) => new Set(s.lessons.map((l) => l.id))

  it('celebrates a Creative Tech module', () => {
    const got = achievedMilestones(CC, idsOf([CC.modules[0]]), 'cc')
    expect(got.map((m) => m.id)).toEqual(['module:CC-1'])
    expect(got[0].program).toBe('cc')
    expect(got[0].total).toBe(CC.modules.length)
  })

  it('never produces the same milestone id in two programs', () => {
    const da = milestoneIds(SCHEDULE, 'da')
    const cc = milestoneIds(CC, 'cc')
    const gd = milestoneIds(GD, 'gd')
    const all = [...da, ...cc, ...gd]
    expect(new Set(all).size).toBe(all.length)
  })

  it('keeps the bare "programme" id for Data Analytics, which is what DA learners already store', () => {
    expect(achievedMilestones(SCHEDULE, everything(SCHEDULE), 'da').at(-1).id).toBe('programme')
    expect(achievedMilestones(GD, everything(GD), 'gd').at(-1).id).toBe('programme:gd')
  })

  it('a DA graduate still gets the Creative Tech programme celebration', () => {
    const achieved = achievedMilestones(CC, everything(CC), 'cc')
    expect(nextToCelebrate(achieved, ['programme', 'module:DA-1'])?.id).toBe('programme:cc')
  })

  it("leaves another program's seen-records alone when pruning", () => {
    // Looking at CC with nothing achieved must not wipe DA's records — or
    // switching back to DA would congratulate the learner all over again.
    const seen = ['module:DA-1', 'module:DA-2', 'programme', 'module:CC-1']
    expect(pruneCelebrated([], seen, milestoneIds(CC, 'cc'))).toEqual([
      'module:DA-1',
      'module:DA-2',
      'programme',
    ])
    expect(pruneCelebrated([], ['module:DA-1'], milestoneIds(CC, 'cc'))).toBeNull()
  })

  it('has no milestones before a program is chosen', () => {
    expect(achievedMilestones(null, new Set())).toEqual([])
    expect(milestoneIds(null, 'da').size).toBe(0)
  })
})

/*
  The post links to the learner's program page, so it previews as their
  program — a crawler can only see the card of the exact URL in the post.
*/
describe('the post link', () => {
  it.each([
    ['da', SCHEDULE],
    ['cc', CC],
    ['gd', GD],
  ])('points a %s post at that program’s share page', (program, schedule) => {
    const m = achievedMilestones(schedule, idsOf([schedule.modules[0]]), program)[0]
    const { url } = postParts(m, { moduleDone: () => '', programmeDone: () => '' })
    expect(url).toBe(`https://alxdataprograms.github.io/alx-pace/share/${program}/`)
  })
})
