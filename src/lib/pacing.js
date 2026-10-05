/**
 * Deterministic pacing engine — pure functions, no side effects, no clock reads
 * except the one `now` you pass in. This keeps it trivially testable and means
 * the UI computes the same answer every render for a given (startDate, now).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Normalize a Date to local midnight so day math is not skewed by the time of
 * day. Two dates on the same calendar day => 0 elapsed days.
 */
export function atMidnight(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Whole days from `start` to `now` (can be negative for future start dates). */
export function daysBetween(start, now) {
  const a = atMidnight(start).getTime()
  const b = atMidnight(now).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

/**
 * Parse an ISO date string (YYYY-MM-DD) as a *local* date.
 *
 * `new Date('2026-01-15')` parses as UTC midnight, which can shift a day in
 * negative timezones. Splitting the parts keeps the calendar date intact.
 * Returns null for empty/invalid input (a defensive guardrail).
 */
export function parseISODate(value) {
  if (!value || typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const d = new Date(year, month - 1, day)
  // Reject impossible dates like 2026-02-31 that JS would silently roll over.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null
  }
  return d
}

/** Format a Date as a local ISO date string (YYYY-MM-DD) for <input type=date>. */
export function toISODateString(date) {
  const d = atMidnight(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * A plain N-week timeline (week W = days (W-1)*7 .. W*7-1). Built schedules
 * carry their own, richer timeline; this one is for tests and fallbacks.
 */
export function uniformTimeline(weekCount) {
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    week: i + 1,
    startDay: i * 7,
    endDay: (i + 1) * 7,
  }))
  return { weeks, totalDays: weekCount * 7, totalWeeks: weekCount }
}

/**
 * The timeline week that contains `day` (0 = the start date itself), clamped
 * to the first/last week. Works for fractional weeks ("Week 13.5") because it
 * walks the precomputed day ranges instead of dividing by 7.
 */
export function weekForDay(timeline, day) {
  const weeks = timeline?.weeks || []
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (day >= weeks[i].startDay) return weeks[i]
  }
  return weeks[0] || null
}

/**
 * Compute the learner's pacing status against a program timeline (any object
 * with `weeks[{ week, startDay, endDay }]`, `totalDays` and `totalWeeks` — a
 * built schedule qualifies).
 *
 * For a uniform timeline this is exactly the original spec formula:
 *   elapsedDays  = today - startDate
 *   currentWeek  = min(N, max(1, floor(elapsedDays / 7) + 1))
 * Programs with half and buffer weeks simply look the day up in their ranges.
 *
 * @param {string|Date|null} startDateInput  ISO string or Date
 * @param {Date} [now=new Date()]            injectable "today" for testing
 * @param {{weeks: object[], totalDays: number, totalWeeks: number}|null} timeline
 * @returns {{
 *   status: 'no-program'|'no-start-date'|'future'|'active'|'completed',
 *   startDate: Date|null,
 *   elapsedDays: number,
 *   daysUntilStart: number,
 *   currentWeek: number,
 *   rawWeek: number,
 *   totalWeeks: number,
 *   totalDays: number,
 *   daysRemaining: number,
 * }}
 */
export function computePacing(startDateInput, now = new Date(), timeline = null) {
  const startDate = startDateInput instanceof Date ? startDateInput : parseISODate(startDateInput)
  const today = atMidnight(now)

  // Guardrail: no program chosen yet -> there is nothing to pace against.
  if (!timeline || !timeline.weeks?.length) {
    return {
      status: 'no-program',
      startDate,
      elapsedDays: 0,
      daysUntilStart: 0,
      currentWeek: 1,
      rawWeek: 1,
      totalWeeks: 0,
      totalDays: 0,
      daysRemaining: 0,
    }
  }

  const { totalDays, totalWeeks } = timeline
  const firstWeek = timeline.weeks[0].week
  const lastWeek = timeline.weeks[timeline.weeks.length - 1].week

  // Guardrail: no valid start date yet -> onboarding state.
  if (!startDate) {
    return {
      status: 'no-start-date',
      startDate: null,
      elapsedDays: 0,
      daysUntilStart: 0,
      currentWeek: firstWeek,
      rawWeek: 1,
      totalWeeks,
      totalDays,
      daysRemaining: totalDays,
    }
  }

  const elapsedDays = daysBetween(startDate, today)

  // Guardrail: start date is in the future -> countdown state.
  if (elapsedDays < 0) {
    return {
      status: 'future',
      startDate,
      elapsedDays,
      daysUntilStart: Math.abs(elapsedDays),
      currentWeek: firstWeek,
      rawWeek: 0,
      totalWeeks,
      totalDays,
      daysRemaining: totalDays,
    }
  }

  const rawWeek = Math.floor(elapsedDays / 7) + 1

  // Guardrail: past the final week -> graduation state.
  if (elapsedDays >= totalDays) {
    return {
      status: 'completed',
      startDate,
      elapsedDays,
      daysUntilStart: 0,
      currentWeek: lastWeek,
      rawWeek,
      totalWeeks,
      totalDays,
      daysRemaining: 0,
    }
  }

  return {
    status: 'active',
    startDate,
    elapsedDays,
    daysUntilStart: 0,
    currentWeek: weekForDay(timeline, elapsedDays).week,
    rawWeek,
    totalWeeks,
    totalDays,
    daysRemaining: Math.max(0, totalDays - elapsedDays),
  }
}

/**
 * The calendar date of day `day` of a course begun on `startDateInput`, at
 * local midnight: day 0 is the start date itself, as in computePacing. Null
 * without a valid start date.
 */
export function dateOfDay(startDateInput, day) {
  const start = startDateInput instanceof Date ? startDateInput : parseISODate(startDateInput)
  if (!start) return null
  const date = atMidnight(start)
  date.setDate(date.getDate() + day)
  return date
}

/**
 * The planned "done by" date: the last day of the program (start +
 * totalDays - 1, since day 1 is the start date itself — 97 days for the
 * 14-week DA track). Null without a valid start date or program.
 */
export function plannedEndDate(startDateInput, totalDays) {
  return totalDays ? dateOfDay(startDateInput, totalDays - 1) : null
}

/**
 * Progress percentage from completed lesson ids.
 * @param {string[]|Set<string>} completed
 * @param {number} total
 * @returns {number} 0..100 (integer)
 */
export function progressPercent(completed, total) {
  if (!total) return 0
  const count = completed instanceof Set ? completed.size : (completed || []).length
  return Math.min(100, Math.round((count / total) * 100))
}
