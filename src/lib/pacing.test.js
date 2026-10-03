import { describe, it, expect } from 'vitest'
import {
  parseISODate,
  daysBetween,
  toISODateString,
  computePacing,
  plannedEndDate,
  progressPercent,
  uniformTimeline,
  weekForDay,
} from './pacing'

// The 14-week Data Analytics shape; other programs bring their own timeline.
const T14 = uniformTimeline(14)

// A Creative-Tech-style timeline: a half week followed by a buffer that starts
// mid-week (exactly what scheduleModel emits for "Week 2 (½ week)" / "Week 2.5").
const HALF = {
  totalDays: 18,
  totalWeeks: 2.6,
  weeks: [
    { week: 1, startDay: 0, endDay: 7 },
    { week: 2, startDay: 7, endDay: 11, isHalf: true },
    { week: 2.5, startDay: 11, endDay: 18, isBuffer: true },
  ],
}

const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

describe('parseISODate', () => {
  it('parses a valid ISO date as a local date', () => {
    const d = parseISODate('2026-01-15')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(15)
  })

  it('returns null for empty, non-string, or malformed input', () => {
    expect(parseISODate('')).toBeNull()
    expect(parseISODate(null)).toBeNull()
    expect(parseISODate(undefined)).toBeNull()
    expect(parseISODate('not-a-date')).toBeNull()
  })

  it('rejects impossible calendar dates instead of rolling over', () => {
    expect(parseISODate('2026-02-31')).toBeNull()
    expect(parseISODate('2026-13-01')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('is 0 for the same calendar day regardless of time', () => {
    expect(daysBetween(new Date(2026, 0, 1, 8), new Date(2026, 0, 1, 23))).toBe(0)
  })

  it('counts whole days forward and backward', () => {
    expect(daysBetween(new Date(2026, 0, 1), new Date(2026, 0, 8))).toBe(7)
    expect(daysBetween(new Date(2026, 0, 8), new Date(2026, 0, 1))).toBe(-7)
  })
})

describe('toISODateString', () => {
  it('round-trips a parsed ISO date', () => {
    expect(toISODateString(parseISODate('2026-07-22'))).toBe('2026-07-22')
  })
})

describe('computePacing', () => {
  it('reports no-program when there is no timeline to pace against', () => {
    const p = computePacing('2026-03-01', new Date(2026, 2, 5), null)
    expect(p.status).toBe('no-program')
  })

  it('reports no-start-date when there is no valid start', () => {
    const p = computePacing('', new Date(2026, 0, 1), T14)
    expect(p.status).toBe('no-start-date')
    expect(p.currentWeek).toBe(1)
  })

  it('reports a future countdown when the start is ahead', () => {
    const start = '2026-03-10'
    const p = computePacing(start, new Date(2026, 2, 1), T14)
    expect(p.status).toBe('future')
    expect(p.daysUntilStart).toBe(9)
  })

  it('is week 1 on the start day itself', () => {
    const p = computePacing('2026-03-01', new Date(2026, 2, 1), T14)
    expect(p.status).toBe('active')
    expect(p.currentWeek).toBe(1)
    expect(p.elapsedDays).toBe(0)
  })

  it('advances one week every 7 elapsed days', () => {
    const start = new Date(2026, 2, 1)
    expect(computePacing('2026-03-01', addDays(start, 6), T14).currentWeek).toBe(1)
    expect(computePacing('2026-03-01', addDays(start, 7), T14).currentWeek).toBe(2)
    expect(computePacing('2026-03-01', addDays(start, 14), T14).currentWeek).toBe(3)
  })

  it('stays active through the last day of week 14 (elapsed 97)', () => {
    const start = new Date(2026, 2, 1)
    const p = computePacing('2026-03-01', addDays(start, 97), T14)
    expect(p.status).toBe('active')
    expect(p.currentWeek).toBe(14)
  })

  it('flips to completed once past week 14 (elapsed 98)', () => {
    const start = new Date(2026, 2, 1)
    const p = computePacing('2026-03-01', addDays(start, 98), T14)
    expect(p.status).toBe('completed')
    expect(p.currentWeek).toBe(14)
    expect(p.rawWeek).toBe(15)
  })

  it('walks half and mid-week buffer weeks by day range', () => {
    const start = new Date(2026, 2, 1)
    expect(computePacing('2026-03-01', addDays(start, 7), HALF).currentWeek).toBe(2)
    expect(computePacing('2026-03-01', addDays(start, 10), HALF).currentWeek).toBe(2)
    expect(computePacing('2026-03-01', addDays(start, 11), HALF).currentWeek).toBe(2.5)
    expect(computePacing('2026-03-01', addDays(start, 17), HALF).status).toBe('active')
    expect(computePacing('2026-03-01', addDays(start, 18), HALF).status).toBe('completed')
  })

  it('reports the program length, not a hard-coded 14 weeks', () => {
    const p = computePacing('2026-03-01', new Date(2026, 2, 1), uniformTimeline(32))
    expect(p.totalWeeks).toBe(32)
    expect(p.daysRemaining).toBe(224)
  })
})

describe('weekForDay', () => {
  it('matches floor(day / 7) + 1 on a uniform timeline', () => {
    for (const day of [0, 6, 7, 13, 50, 97]) {
      expect(weekForDay(T14, day).week).toBe(Math.floor(day / 7) + 1)
    }
  })

  it('clamps to the first and last weeks', () => {
    expect(weekForDay(T14, -3).week).toBe(1)
    expect(weekForDay(T14, 500).week).toBe(14)
  })
})

describe('plannedEndDate', () => {
  it('is 97 days after the start (last day of week 14)', () => {
    const start = new Date(2026, 2, 1)
    const end = plannedEndDate('2026-03-01', T14.totalDays)
    expect(toISODateString(end)).toBe(toISODateString(addDays(start, 97)))
  })

  it('follows the program length (32 weeks → day 223)', () => {
    const start = new Date(2026, 2, 1)
    const end = plannedEndDate('2026-03-01', 224)
    expect(toISODateString(end)).toBe(toISODateString(addDays(start, 223)))
  })

  it('is null without a valid start or program length', () => {
    expect(plannedEndDate('', 98)).toBeNull()
    expect(plannedEndDate('2026-03-01', 0)).toBeNull()
  })
})

describe('progressPercent', () => {
  it('computes a rounded percentage from an array or a Set', () => {
    expect(progressPercent(['a', 'b'], 4)).toBe(50)
    expect(progressPercent(new Set(['a', 'b']), 4)).toBe(50)
  })

  it('is 0 when total is 0 and clamps at 100', () => {
    expect(progressPercent(['a'], 0)).toBe(0)
    expect(progressPercent(['a', 'b', 'c'], 2)).toBe(100)
  })
})
