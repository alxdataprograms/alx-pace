import { describe, it, expect } from 'vitest'
import { SCHEDULES, getSchedule, getWeek } from './schedule'

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
