import { describe, it, expect } from 'vitest'
import {
  SCHEDULES,
  contentWeeksAfter,
  getSchedule,
  getWeek,
  moduleProgress,
  nextCheckpoint,
} from './schedule'

// Runs against the real bundled CSVs (Vitest resolves `?raw` like Vite does).
describe('bundled program schedules', () => {
  it('builds every program with its real length', () => {
    expect(SCHEDULES.da.totalWeeks).toBe(14)
    expect(SCHEDULES.cc.totalWeeks).toBe(22)
    expect(SCHEDULES.gd.totalWeeks).toBe(32)
  })

  it('never shares a lesson id between programs (one completedLessons array holds all)', () => {
    const all = Object.values(SCHEDULES).flatMap((s) => s.lessons.map((l) => l.id))
    expect(new Set(all).size).toBe(all.length)
  })

  it('returns null for an unknown program and finds fractional weeks', () => {
    expect(getSchedule('')).toBeNull()
    expect(getWeek(null, 1)).toBeNull()
    expect(getWeek(getSchedule('gd'), 13.5).isBuffer).toBe(true)
  })
})

/*
  Where "Get ahead" looks once this week is done: the later weeks with
  something to tick. Catch-up weeks have nothing of their own, so a Content
  Creation learner done with Week 3 is pointed at Week 5, not at Week 4.
*/
describe('contentWeeksAfter', () => {
  const weeks = (program, week) => contentWeeksAfter(SCHEDULES[program], week).map((w) => w.week)

  it('lists every later week, in order, in a programme with no catch-up weeks', () => {
    expect(weeks('da', 4)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('skips catch-up weeks, whole and half', () => {
    expect(weeks('cc', 3)[0]).toBe(5)
    expect(weeks('gd', 9)[0]).toBe(11)
    expect(weeks('gd', 13)[0]).toBe(14.5)
    for (const program of ['cc', 'gd']) {
      for (const w of contentWeeksAfter(SCHEDULES[program], 0)) expect(w.lessons.length).toBeGreaterThan(0)
    }
  })

  it('is empty after the last week with content, and without a programme', () => {
    expect(weeks('da', 14)).toEqual([])
    // Content Creation ends on a catch-up week.
    expect(weeks('cc', 21)).toEqual([])
    expect(weeks('gd', 31)).toEqual([])
    expect(contentWeeksAfter(null, 1)).toEqual([])
  })
})

/*
  A long week's next checkpoint: its first graded item still open, and how
  many open items lead up to it, itself included. Graphic Design's Week 9 is
  31 items with three graded ones, at 9, 20 and 31; nothing marked them out
  from the rows around them.
*/
describe('nextCheckpoint', () => {
  const gd = SCHEDULES.gd
  const week9 = getWeek(gd, 9)
  const done = (...items) => new Set(items.map((l) => l.id))
  const checkpoint = (completed) => {
    const next = nextCheckpoint(week9, completed)
    return next && [next.item.title, next.away]
  }

  it('is the first graded item, with every item up to it, itself included', () => {
    expect(checkpoint(new Set())).toEqual(['Quiz 1: Poster Design', 9])
  })

  it('draws nearer with each tick on the way', () => {
    expect(checkpoint(done(...week9.lessons.slice(0, 5)))).toEqual(['Quiz 1: Poster Design', 4])
    expect(checkpoint(done(...week9.lessons.slice(0, 8)))).toEqual(['Quiz 1: Poster Design', 1])
  })

  it('moves on to the next graded item once that one is ticked', () => {
    expect(checkpoint(done(...week9.lessons.slice(0, 9)))).toEqual(['Quiz 2: Design Soft Skills', 11])
    expect(checkpoint(done(...week9.lessons.slice(0, 20)))).toEqual([
      'Mastery Project: Poster Design',
      11,
    ])
  })

  it('counts only open items, for a learner working out of order', () => {
    // Quiz 1 done before anything leading up to it: Quiz 2 is next, and the
    // eight items before Quiz 1 are still on the way to it.
    const quiz1 = week9.lessons[8]
    expect(quiz1.isGraded).toBe(true)
    expect(checkpoint(done(quiz1))).toEqual(['Quiz 2: Design Soft Skills', 19])
  })

  it('is null once nothing graded is left open, or in a week with nothing graded', () => {
    expect(nextCheckpoint(week9, done(...week9.gradedItems))).toBeNull()
    expect(getWeek(gd, 11).gradedItems).toHaveLength(0)
    expect(nextCheckpoint(getWeek(gd, 11), new Set())).toBeNull()
    expect(nextCheckpoint(getWeek(gd, 13.5), new Set())).toBeNull()
    expect(nextCheckpoint(null, new Set())).toBeNull()
  })
})

/*
  The module of a week, as Creative Tech's progress card names it: "Module 3
  of 10 · Poster Design & Visual Composition", with "0/31" done.
*/
describe('moduleProgress', () => {
  const gd = SCHEDULES.gd
  const before = (week) => new Set(gd.lessons.filter((l) => l.week < week).map((l) => l.id))

  it('places the week’s module in the programme and counts what is done of it', () => {
    expect(moduleProgress(gd, 9, before(9))).toEqual({
      code: 'GD-3',
      title: 'Poster Design & Visual Composition',
      index: 3,
      total: 10,
      done: 0,
      items: 31,
    })
    expect(moduleProgress(SCHEDULES.cc, 2, new Set())).toMatchObject({
      code: 'CC-1',
      index: 1,
      total: 5,
      items: 59,
    })
  })

  it('counts a catch-up week, half weeks included, with the module it closes', () => {
    expect(moduleProgress(gd, 10, before(10))).toMatchObject({ code: 'GD-3', done: 31, items: 31 })
    expect(moduleProgress(gd, 13.5, before(12))).toMatchObject({
      code: 'GD-4',
      index: 4,
      done: 14,
      items: 28,
    })
  })

  it('is null for a week the programme does not have, or no programme', () => {
    expect(moduleProgress(gd, 40, new Set())).toBeNull()
    expect(moduleProgress(null, 1, new Set())).toBeNull()
  })
})
