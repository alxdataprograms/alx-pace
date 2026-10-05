import { describe, it, expect } from 'vitest'
import { computePaceStatus, perDayToClear } from './paceStatus'
import { computePacing, toISODateString } from './pacing'
import { SCHEDULES } from './schedule'

// Minimal hand-built schedule so counts are fully controlled. Its weeks carry
// the day spans a built schedule has (see scheduleModel.js): 7 days each.
const span = (week) => ({ week, startDay: (week - 1) * 7, endDay: week * 7, days: 7 })
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
    { ...span(1), lessons: [{ id: 'a' }, { id: 'b' }], gradedItems: [{ id: 'b' }] },
    { ...span(2), lessons: [{ id: 'c' }], gradedItems: [] },
    { ...span(3), lessons: [{ id: 'd' }], gradedItems: [{ id: 'd' }] },
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

  it('reads a week the schedule does not have as empty, rather than throwing', () => {
    const s = computePaceStatus(schedule, new Set(['a']), activePacing({ currentWeek: 4 }))
    expect(s.weekTotal).toBe(0)
    expect(s.forecast).toBe('on-track')
  })

  it('flags "behind" for unfinished lessons in earlier weeks', () => {
    const s = computePaceStatus(schedule, new Set(['a']), activePacing())
    expect(s.status).toBe('behind')
    expect(s.behindCount).toBe(1) // 'b' from week 1 still open
  })

  it('flags "ahead" for lessons completed in later weeks', () => {
    const s = computePaceStatus(schedule, new Set(['a', 'b', 'c']), activePacing({ currentWeek: 1 }))
    expect(s.status).toBe('ahead')
    expect(s.aheadCount).toBe(1) // only 'c' (week 2) is a completed later-week lesson
  })

  it('flags "on-track" when caught up with nothing pulled forward', () => {
    const s = computePaceStatus(schedule, new Set(['a', 'b']), activePacing({ currentWeek: 1 }))
    expect(s.status).toBe('on-track')
  })

  /*
    The pace is unchanged: ticks over the days so far. The finish it once
    projected from that pace now comes from the learner's position (below):
    with 'b' of Week 1 still open in Week 2, they are a week behind, and the
    projected finish is the planned end a week later.
  */
  it('computes pace from real progress, and the finish from position', () => {
    const s = computePaceStatus(schedule, new Set(['a']), activePacing())
    // 1 lesson over 8 days-in => 0.875/wk, rounded to 0.9
    expect(s.pacePerWeek).toBe(0.9)
    expect(s.completedCount).toBe(1)
    expect(s.remaining).toBe(3)
    expect(s.forecast).toBe('behind')
    expect(s.forecastWeeks).toBe(1)
    expect(s.oldestOpenWeek).toBe(1)
    expect(s.finishShiftDays).toBe(7)
    // planned end 2026-03-21, a week later
    expect(toISODateString(s.projectedFinish)).toBe('2026-03-28')
  })

  it('lists the open earlier-week items oldest first and flags buffer weeks', () => {
    const withBuffer = {
      ...schedule,
      weeks: [...schedule.weeks, { ...span(4), isBuffer: true, lessons: [], gradedItems: [] }],
    }
    const s = computePaceStatus(
      withBuffer,
      new Set(['b']),
      activePacing({ currentWeek: 4, elapsedDays: 21 }),
    )
    expect(s.isBuffer).toBe(true)
    expect(s.behindItems.map((l) => l.id)).toEqual(['a', 'c', 'd'])
    expect(s.behindCount).toBe(3)
    expect(s.weekTotal).toBe(0)
  })

  it('targets the end of the program, not a fixed 14 weeks', () => {
    const s = computePaceStatus(schedule, new Set(), activePacing())
    // start 2026-03-01 + 21 days - 1 = 2026-03-21
    expect(toISODateString(s.plannedEnd)).toBe('2026-03-21')
  })

  /*
    The forecast reads which items are open, so it has something true to say
    before anything is ticked: the status card above it already does.
  */
  it('forecasts from the first visit, before anything is ticked', () => {
    const s = computePaceStatus(schedule, new Set(), activePacing({ currentWeek: 1, elapsedDays: 0 }))
    expect(s.completedCount).toBe(0)
    expect(s.forecast).toBe('on-track')
    expect(s.finishShiftDays).toBe(0)
    expect(toISODateString(s.projectedFinish)).toBe('2026-03-21')
  })

  /*
    The items-a-week figure waits for a week's worth of signal. Projected, one
    tick in a 373-item course after nine days put the finish in 2032; the
    finish no longer comes from it, but a rate from one tick still says
    nothing.
  */
  describe('the items-a-week minimum', () => {
    // Nine days in: Week 2 of either program.
    const nineDaysIn = (program) =>
      computePacing(new Date(2026, 2, 1), new Date(2026, 2, 9), SCHEDULES[program])
    const first = (program, n) => new Set(SCHEDULES[program].lessons.slice(0, n).map((l) => l.id))

    it('withholds the rate after a single tick, but not the forecast', () => {
      // Content Creation: 250 items over 22 weeks. A week's worth is 12.
      const s = computePaceStatus(SCHEDULES.cc, first('cc', 1), nineDaysIn('cc'))
      expect(s.paceNeeds).toBe(11)
      expect(s.forecast).toBe('behind')
      expect(s.projectedFinish).toBeInstanceOf(Date)
    })

    it('shows the rate once a week of items is done', () => {
      expect(computePaceStatus(SCHEDULES.cc, first('cc', 12), nineDaysIn('cc')).paceNeeds).toBe(0)
    })

    it('asks Data Analytics for two lessons — a week of its 27', () => {
      expect(computePaceStatus(SCHEDULES.da, first('da', 1), nineDaysIn('da')).paceNeeds).toBe(1)
      expect(computePaceStatus(SCHEDULES.da, first('da', 2), nineDaysIn('da')).paceNeeds).toBe(0)
    })
  })
})

/*
  The finish forecast, on the real schedules.

  It extrapolated ticks per day, as if every week were as heavy as the next,
  and contradicted the status card beside it: "Right on pace" over "≈ 5 weeks
  ahead", nine lessons behind as "≈ 11 weeks behind", and "≈ 27 weeks behind"
  on a 22-week course. Now it reads the learner's oldest open item, by the
  status card's rule: the current week is never late, and finishing it is not
  yet ahead. Days count, so Graphic Design's half weeks and catch-up weeks are
  measured as they fall.
*/
describe('the finish forecast', () => {
  const START = new Date(2026, 2, 2)
  /** The forecast of `program`, `day` days in, with these ticked. */
  const at = (program, day, done) => {
    const sch = SCHEDULES[program]
    const now = new Date(START)
    now.setDate(now.getDate() + day)
    return computePaceStatus(sch, new Set(done), computePacing(START, now, sch))
  }
  const ids = (program, keep) => SCHEDULES[program].lessons.filter(keep).map((l) => l.id)
  const upTo = (program, week) => ids(program, (l) => l.week < week)
  const through = (program, week) => ids(program, (l) => l.week <= week)
  const all = (program) => ids(program, () => true)
  /** The planned end, `days` later (earlier if negative), as an ISO date. */
  const shifted = (s, days) => {
    const d = new Date(s.plannedEnd)
    d.setDate(d.getDate() + days)
    return toISODateString(d)
  }

  describe('in Data Analytics', () => {
    it('is on track for the planned date when the oldest open lesson is this week’s', () => {
      // Day 24 is Week 4; Weeks 1–3 done. The rate said "≈ 5 weeks ahead".
      const s = at('da', 24, upTo('da', 4))
      expect(s.status).toBe('on-track')
      expect(s.forecast).toBe('on-track')
      expect(s.forecastWeeks).toBe(0)
      expect(toISODateString(s.projectedFinish)).toBe(toISODateString(s.plannedEnd))
    })

    it('is 4 weeks behind, from Week 3, in Week 7 with Weeks 3–6 open', () => {
      // The rate said "≈ 11 weeks behind plan".
      const s = at('da', 45, upTo('da', 3))
      expect(s.status).toBe('behind')
      expect(s.forecast).toBe('behind')
      expect(s.forecastWeeks).toBe(4)
      expect(s.oldestOpenWeek).toBe(3)
      expect(s.finishShiftDays).toBe(28)
      expect(toISODateString(s.projectedFinish)).toBe(shifted(s, 28))
    })

    it('holds still through the week, like the status card', () => {
      for (const day of [42, 45, 48]) {
        const s = at('da', day, upTo('da', 3))
        expect([s.forecastWeeks, s.finishShiftDays], `day ${day}`).toEqual([4, 28])
      }
    })

    it('counts a week finished early as on track, not ahead', () => {
      // Week 4 done on its first day: the status card says "Right on pace" and
      // the checklist offers "Get ahead".
      const s = at('da', 21, through('da', 4))
      expect(s.status).toBe('on-track')
      expect(s.forecast).toBe('on-track')
    })

    it('is ahead by the weeks after this one already done', () => {
      // Week 4, with Weeks 5 and 6 done too.
      const s = at('da', 24, through('da', 6))
      expect(s.status).toBe('ahead')
      expect(s.forecast).toBe('ahead')
      expect(s.forecastWeeks).toBe(2)
      expect(s.finishShiftDays).toBe(-14)
      expect(toISODateString(s.projectedFinish)).toBe(shifted(s, -14))
    })

    it('says finished, with nothing to project, once everything is done', () => {
      const s = at('da', 80, all('da'))
      expect(s.forecast).toBe('finished')
      expect(s.oldestOpenWeek).toBeNull()
      expect(s.finishShiftDays).toBeNull()
      expect(s.projectedFinish).toBeNull()
    })
  })

  describe('in Creative Tech', () => {
    it('is 4 weeks behind on a 22-week course, not 27', () => {
      // Week 6, with 30 of the 42 items of Weeks 1–2 done.
      const s = at('cc', 40, upTo('cc', 3).slice(0, 30))
      expect(s.forecast).toBe('behind')
      expect(s.forecastWeeks).toBe(4)
      expect(s.oldestOpenWeek).toBe(2)
    })

    it('counts a catch-up week as nothing to be ahead of', () => {
      // Week 3 done before its catch-up week, then all caught up during it.
      for (const day of [15, 22]) {
        const s = at('cc', day, through('cc', 3))
        expect(s.status, `day ${day}`).toBe('on-track')
        expect(s.forecast, `day ${day}`).toBe('on-track')
      }
      // Week 5 done as well: one week of content ahead; Week 4 holds none.
      const s = at('cc', 15, through('cc', 5))
      expect(s.forecast).toBe('ahead')
      expect(s.forecastWeeks).toBe(1)
      expect(s.finishShiftDays).toBe(-7)
    })

    it('measures Graphic Design’s half weeks in days', () => {
      // Week 13 lasts 4 days (84–87). Done through 12 on its last day: on track.
      expect(at('gd', 87, upTo('gd', 13)).forecast).toBe('on-track')
      // Its catch-up week 13.5 begins on day 88 with Week 13 open: on track,
      // as the catch-up week is the time set aside for it.
      const w13 = at('gd', 88, upTo('gd', 13))
      expect([w13.forecast, w13.forecastWeeks, w13.finishShiftDays]).toEqual(['on-track', 0, 0])
      // Week 27.5 lasts 3 days (186–188), and catch-up Week 28 follows. Week
      // 27.5 open there is what the catch-up week is for: on track. Week 26.5
      // open is 3 days late, and never less than a week behind.
      expect(at('gd', 189, upTo('gd', 27.5)).forecast).toBe('on-track')
      const w26 = at('gd', 189, upTo('gd', 26.5))
      expect([w26.forecast, w26.forecastWeeks, w26.finishShiftDays]).toEqual(['behind', 1, 3])
      expect(w26.oldestOpenWeek).toBe(26.5)
      // And 3 days ahead is under half a week: ahead, as the status card says,
      // with no weeks to count and the planned date.
      const ahead = at('gd', 179, through('gd', 27.5))
      expect(ahead.week).toBe(26.5)
      expect(ahead.status).toBe('ahead')
      expect([ahead.forecast, ahead.forecastWeeks, ahead.finishShiftDays]).toEqual(['ahead', 0, 0])
    })

    it('counts the catch-up weeks gone by when behind, and not the one under way', () => {
      // Week 13.5 began on day 88; Week 12 began on day 77 and is still open.
      // Its own 7 days are for clearing it: 11 days less 7, so 1 week behind.
      const s = at('gd', 90, upTo('gd', 12))
      expect(s.isBuffer).toBe(true)
      expect([s.forecast, s.forecastWeeks, s.oldestOpenWeek, s.finishShiftDays]).toEqual([
        'behind',
        1,
        12,
        4,
      ])
      // Week 14.5 (day 95 on), Week 12 still open: the catch-up week gone by
      // counts, 18 days.
      const after = at('gd', 96, upTo('gd', 12))
      expect(after.isBuffer).toBe(false)
      expect([after.forecast, after.forecastWeeks, after.finishShiftDays]).toEqual(['behind', 3, 18])
    })

    it('does not put a learner a week further behind the moment a catch-up week begins', () => {
      // Content Creation's Week 3 (days 14–20), Week 2 open: 1 week behind.
      // Week 4, a catch-up week, begins on day 21 with nothing more ticked.
      const before = at('cc', 20, upTo('cc', 2))
      const during = at('cc', 21, upTo('cc', 2))
      expect(during.isBuffer).toBe(true)
      expect([before.forecast, before.forecastWeeks]).toEqual(['behind', 1])
      expect([during.forecast, during.forecastWeeks]).toEqual(['behind', 1])
      expect(during.finishShiftDays).toBe(before.finishShiftDays)
    })

    it('reads a lead of less than a week as ahead, as the status card does', () => {
      // Data Analytics' Week 4 (day 24) done, and Week 5's lesson ticked: the
      // status card says "1 lesson ahead". It said "On track" here.
      const s = at('da', 24, [...through('da', 4), ...ids('da', (l) => l.week === 5)])
      expect(s.status).toBe('ahead')
      expect([s.forecast, s.forecastWeeks, s.finishShiftDays]).toEqual(['ahead', 1, -7])
      const some = at('da', 24, [...through('da', 4), ids('da', (l) => l.week === 6)[0]])
      expect(some.status).toBe('ahead')
      expect([some.forecast, some.forecastWeeks, some.finishShiftDays]).toEqual(['ahead', 0, 0])
    })
  })

  /*
    Every day of every program, with the first N items ticked and with a few
    picked from later weeks: the forecast never contradicts the status card,
    and never claims more weeks than the course has had or has left.
  */
  it('never contradicts the status card', () => {
    const wrong = []
    const check = (ok, where, what) => ok || wrong.push(`${where}: ${what}`)
    for (const program of Object.keys(SCHEDULES)) {
      const sch = SCHEDULES[program]
      const n = sch.lessons.length
      const step = Math.max(1, Math.floor(n / 40))
      const ticks = []
      for (let k = 0; k <= n; k += step) {
        const prefix = sch.lessons.slice(0, k).map((l) => l.id)
        const jumped = [...prefix, ...sch.lessons.slice(k + step, k + 2 * step).map((l) => l.id)]
        ticks.push(new Set(prefix), new Set(jumped))
      }
      for (let day = 0; day < sch.totalDays; day += 1) {
        const now = new Date(START)
        now.setDate(now.getDate() + day)
        const pacing = computePacing(START, now, sch)
        for (const done of ticks) {
          const s = computePaceStatus(sch, done, pacing)
          const { forecast, status, forecastWeeks } = s
          const where = `${program} day ${day}, ${done.size} done`
          // A catch-up week's own days are not late (forecastFrom): there the
          // status card plans the week, and "behind" here still means behind there.
          if (s.isBuffer) check(forecast !== 'behind' || status === 'behind', where, `${forecast} vs ${status}`)
          else check((forecast === 'behind') === (status === 'behind'), where, `${forecast} vs ${status}`)
          check(forecast !== 'ahead' || status === 'ahead', where, `ahead vs ${status}`)
          // And "ahead" there is "ahead" here, by less than a week if need be.
          check(status !== 'ahead' || forecast === 'ahead' || forecast === 'finished', where, `${status} vs ${forecast}`)
          if (forecast === 'behind') {
            check(forecastWeeks <= Math.ceil(day / 7), where, `${forecastWeeks} weeks behind`)
            check(s.oldestOpenWeek === s.behindItems[0].week, where, 'oldest open week')
          }
          if (forecast === 'ahead') {
            const left = Math.ceil((sch.totalDays - day) / 7)
            check(forecastWeeks <= left, where, `${forecastWeeks} weeks ahead`)
          }
          if (forecast !== 'finished') {
            const date = toISODateString(s.projectedFinish)
            check(date === shifted(s, s.finishShiftDays), where, `projected ${date}`)
          }
        }
      }
    }
    expect(wrong).toEqual([])
  })
})

/*
  Creative Tech's catch-up weeks, on the real schedules.

  In a catch-up week the status card sounded the alarm, "Catch-up nudge: 14
  items from earlier weeks still open", in the one week built for catching up.
  It now plans them over the days the week has left, today included; and a
  learner behind in an ordinary week is told when the next catch-up week
  begins. Both read the day timeline, so a catch-up week that begins mid-week
  (Graphic Design's 13.5) counts as it falls.
*/
describe('catch-up weeks', () => {
  const START = new Date(2026, 2, 2)
  /** The status of `program`, `day` days in, with these ticked. */
  const at = (program, day, done = []) => {
    const sch = SCHEDULES[program]
    const now = new Date(START)
    now.setDate(now.getDate() + day)
    return computePaceStatus(sch, new Set(done), computePacing(START, now, sch))
  }
  const upTo = (program, week) =>
    SCHEDULES[program].lessons.filter((l) => l.week < week).map((l) => l.id)
  /** START, `days` later, as an ISO date. */
  const dayOf = (days) => {
    const d = new Date(START)
    d.setDate(d.getDate() + days)
    return toISODateString(d)
  }

  it('counts the days a catch-up week has left, today included', () => {
    // Graphic Design's Week 13.5 runs from day 88 to day 94.
    for (const [day, left] of [[88, 7], [90, 5], [94, 1]]) {
      const s = at('gd', day, upTo('gd', 12))
      expect(s.isBuffer, `day ${day}`).toBe(true)
      expect(s.daysLeft, `day ${day}`).toBe(left)
    }
    // Weeks 12 and 13 still open: 10 and 4 items.
    expect(at('gd', 90, upTo('gd', 12)).behindCount).toBe(14)
  })

  it('counts them in an ordinary week too, half weeks included', () => {
    // Week 13 is half a week, days 84 to 87.
    expect(at('gd', 84).daysLeft).toBe(4)
    expect(at('da', 45).daysLeft).toBe(4) // Week 7: days 42–48
  })

  it('shares the open items out over those days, rounded up', () => {
    expect(perDayToClear(14, 5)).toBe(3)
    expect(perDayToClear(10, 5)).toBe(2)
    expect(perDayToClear(3, 5)).toBe(1)
    expect(perDayToClear(36, 4)).toBe(9)
    expect(perDayToClear(14, 7)).toBe(2)
  })

  it('leaves the share out where it would only repeat a count', () => {
    expect(perDayToClear(1, 5)).toBe(0) // "1 item … (about 1 a day)"
    expect(perDayToClear(14, 1)).toBe(0) // "1 day left (about 14 a day)"
    expect(perDayToClear(0, 5)).toBe(0)
  })

  it('names the next catch-up week, and the day it begins', () => {
    const next = (s) => [s.nextCatchUp.week, toISODateString(s.nextCatchUp.date)]
    // Content Creation's Week 6 (day 40): Week 10 begins on day 63.
    expect(next(at('cc', 40))).toEqual([10, dayOf(63)])
    // Graphic Design's Week 11 (day 72): Week 13.5 begins mid-week, on day 88.
    expect(next(at('gd', 72))).toEqual([13.5, dayOf(88)])
    // In a catch-up week, the one after it.
    expect(at('gd', 90).nextCatchUp.week).toBe(17.5)
  })

  it('has none ahead in Data Analytics, or after the last one', () => {
    expect(at('da', 45).nextCatchUp).toBeNull()
    // Content Creation ends on its catch-up week 22; Graphic Design on Week 32.
    expect(at('cc', 150).nextCatchUp).toBeNull()
    expect(at('gd', 220).nextCatchUp).toBeNull()
  })
})
