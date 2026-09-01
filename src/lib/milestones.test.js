import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import {
  achievedMilestones,
  buildPostText,
  CAMPAIGN_HASHTAG,
  nextToCelebrate,
} from './milestones'
import { buildScheduleFromCsv } from './scheduleModel'

/*
  Run against the REAL curriculum, not a fixture.

  The whole feature rests on "a module is complete when every lesson in it is
  ticked", and a fixture with tidy modules would pass while the shipped CSV —
  merged cells, multi-line graded rows, uneven module sizes — did something
  else. This is the same reasoning as scripts/verify-parser.mjs.
*/
const csv = readFileSync(fileURLToPath(new URL('../data/schedule.csv', import.meta.url)), 'utf8')
const SCHEDULE = buildScheduleFromCsv(csv)

const lessonsOf = (module) => module.weeks.flatMap((w) => w.lessons)
const idsOf = (modules) => new Set(modules.flatMap(lessonsOf).map((l) => l.id))

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
    expect(source).toMatch(/<bdi dir="ltr">\{CAMPAIGN_HASHTAG\}<\/bdi>/)
  })

  it('still copies the whole post, hashtag included, not the split display text', () => {
    // The display splits body from hashtag; what is copied must not.
    expect(source).toMatch(/shareToLinkedIn\(post\)/)
  })
})
