import { describe, it, expect } from 'vitest'
import { computePaceStatus } from './paceStatus'
import { toISODateString } from './pacing'

// Minimal hand-built schedule so counts are fully controlled.
const schedule = {
  totalLessons: 4,
  totalDays: 21,
  lessons: [
    { id: 'a', week: 1 },
    { id: 'b', week: 1 },
    { id: 'c', week: 2 },
    { id: 'd', week: 3 },
  ],
  weeks: [
    { week: 1, lessons: [{ id: 'a' }, { id: 'b' }], gradedItems: [{ id: 'b' }] },
    { week: 2, lessons: [{ id: 'c' }], gradedItems: [] },
    { week: 3, lessons: [{ id: 'd' }], gradedItems: [{ id: 'd' }] },
  ],
}

const activePacing = (over) => ({
  status: 'active',
  currentWeek: 2,
  totalWeeks: 14,
  elapsedDays: 7,
  startDate: new Date(2026, 2, 1),
  ...over,
})

describe('computePaceStatus', () => {
  it('returns null when pacing is not active', () => {
    expect(computePaceStatus(schedule, new Set(), { status: 'future' })).toBeNull()
  })

  it('flags "behind" for unfinished lessons in earlier weeks', () => {
    const s = computePaceStatus(schedule, new Set(['a']), activePacing(), new Date(2026, 2, 8))
    expect(s.status).toBe('behind')
    expect(s.behindCount).toBe(1) // 'b' from week 1 still open
  })

  it('flags "ahead" for lessons completed in later weeks', () => {
    const s = computePaceStatus(
      schedule,
      new Set(['a', 'b', 'c']),
      activePacing({ currentWeek: 1 }),
      new Date(2026, 2, 8),
    )
    expect(s.status).toBe('ahead')
    expect(s.aheadCount).toBe(1) // only 'c' (week 2) is a completed later-week lesson
  })

  it('flags "on-track" when caught up with nothing pulled forward', () => {
    const s = computePaceStatus(
      schedule,
      new Set(['a', 'b']),
      activePacing({ currentWeek: 1 }),
      new Date(2026, 2, 8),
    )
    expect(s.status).toBe('on-track')
  })

  it('computes pace and a projected finish date from real progress', () => {
    const now = new Date(2026, 2, 8)
    const s = computePaceStatus(schedule, new Set(['a']), activePacing(), now)
    // 1 lesson over 8 days-in => 0.875/wk, rounded to 0.9
    expect(s.pacePerWeek).toBe(0.9)
    expect(s.completedCount).toBe(1)
    expect(s.remaining).toBe(3)
    // perDay = 1/8; daysLeft = ceil(3 / 0.125) = 24
    const expected = new Date(now)
    expected.setDate(expected.getDate() + 24)
    expect(toISODateString(s.projectedFinish)).toBe(toISODateString(expected))
    expect(typeof s.finishDeltaDays).toBe('number')
  })

  it('lists the open earlier-week items oldest first and flags buffer weeks', () => {
    const withBuffer = {
      ...schedule,
      weeks: [...schedule.weeks, { week: 4, isBuffer: true, lessons: [], gradedItems: [] }],
    }
    const s = computePaceStatus(
      withBuffer,
      new Set(['b']),
      activePacing({ currentWeek: 4, elapsedDays: 21 }),
      new Date(2026, 2, 22),
    )
    expect(s.isBuffer).toBe(true)
    expect(s.behindItems.map((l) => l.id)).toEqual(['a', 'c', 'd'])
    expect(s.behindCount).toBe(3)
    expect(s.weekTotal).toBe(0)
  })

  it('targets the end of the program, not a fixed 14 weeks', () => {
    const s = computePaceStatus(schedule, new Set(), activePacing(), new Date(2026, 2, 8))
    // start 2026-03-01 + 21 days - 1 = 2026-03-21
    expect(toISODateString(s.plannedEnd)).toBe('2026-03-21')
  })

  it('has no projection before the first lesson is completed', () => {
    const s = computePaceStatus(schedule, new Set(), activePacing(), new Date(2026, 2, 8))
    expect(s.completedCount).toBe(0)
    expect(s.projectedFinish).toBeNull()
    expect(s.finishDeltaDays).toBeNull()
  })

  /*
    The forecast waits for a week's worth of signal. Without this, one tick in a
    373-item course after nine days projected a finish in 2032.
  */
  describe('forecast minimum', () => {
    // 250 items over 22 weeks — Content Creation's shape. A week's worth is 12.
    const big = {
      totalLessons: 250,
      totalWeeks: 22,
      totalDays: 154,
      lessons: Array.from({ length: 250 }, (_, i) => ({ id: `x${i}`, week: 1 + Math.floor(i / 12) })),
      weeks: [{ week: 2, lessons: [], gradedItems: [] }],
    }
    const ids = (n) => new Set(Array.from({ length: n }, (_, i) => `x${i}`))
    const nineDaysIn = activePacing({ currentWeek: 2, elapsedDays: 8 })

    it('withholds the projection after a single tick', () => {
      const s = computePaceStatus(big, ids(1), nineDaysIn, new Date(2026, 2, 9))
      expect(s.projectedFinish).toBeNull()
      expect(s.finishDeltaDays).toBeNull()
      expect(s.forecastNeeds).toBe(11)
    })

    it('projects once a week of items is done', () => {
      const s = computePaceStatus(big, ids(12), nineDaysIn, new Date(2026, 2, 9))
      expect(s.forecastNeeds).toBe(0)
      expect(s.projectedFinish).toBeInstanceOf(Date)
    })

    it('asks Data Analytics for two lessons — a week of its 27', () => {
      const da = { ...big, totalLessons: 27, totalWeeks: 14 }
      expect(computePaceStatus(da, ids(1), nineDaysIn).forecastNeeds).toBe(1)
      expect(computePaceStatus(da, ids(2), nineDaysIn).forecastNeeds).toBe(0)
    })
  })
})
