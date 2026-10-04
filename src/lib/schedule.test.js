import { describe, it, expect } from 'vitest'
import { SCHEDULES, contentWeeksAfter, getSchedule, getWeek } from './schedule'

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
