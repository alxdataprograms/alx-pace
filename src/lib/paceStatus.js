/**
 * "Where am I?" engine — pure and deterministic, like the rest of the model.
 *
 * Definitions:
 *   - A lesson is DUE if it belongs to a week strictly before the current one
 *     (the current week is still in progress, so it is never "late"). Week
 *     numbers compare numerically, so fractional weeks ("13.5") just work.
 *   - behindItems = due lessons not yet completed (oldest first) — the
 *     catch-up list a buffer week surfaces; behindCount is its length.
 *   - aheadCount  = completed lessons in weeks after the current one.
 *   - status: 'behind' wins over 'ahead' (catch-up first), else 'on-track'.
 *   - forecast: the finish forecast, read from where the learner stands in
 *     the schedule by that same rule — see forecastFrom below.
 *   - paceMin = one average week's worth of items (DA 2, CC 12, GD 12). The
 *     items-a-week figure waits until that much is done — see below.
 *   - daysLeft = this week's days still to come, today included. A catch-up
 *     week's status card plans the items still open over them (perDayToClear).
 *   - nextCatchUp = the first catch-up week after this one and the date it
 *     begins, which "Catch up first" names to a learner who is behind. Null
 *     where none lies ahead, so always in Data Analytics.
 */
import { dateOfDay, plannedEndDate } from './pacing'

export function computePaceStatus(schedule, completedSet, pacing) {
  if (pacing.status !== 'active') return null

  const week = pacing.currentWeek

  const behindItems = []
  let aheadCount = 0
  // Where the learner stands: their oldest open item, in curriculum order.
  let oldestOpen = null
  for (const lesson of schedule.lessons) {
    if (lesson.week == null) continue
    const done = completedSet.has(lesson.id)
    if (!done && !oldestOpen) oldestOpen = lesson
    if (lesson.week < week && !done) behindItems.push(lesson)
    if (lesson.week > week && done) aheadCount += 1
  }
  const behindCount = behindItems.length

  const thisWeek = schedule.weeks.find((w) => w.week === week) || null
  const weekTotal = thisWeek ? thisWeek.lessons.length : 0
  const weekDone = thisWeek ? thisWeek.lessons.filter((l) => completedSet.has(l.id)).length : 0
  const gradedLeft = thisWeek
    ? thisWeek.gradedItems.filter((l) => !completedSet.has(l.id)).length
    : 0

  // Personal pace. Day 1 is the start date itself, so the learner is
  // "daysIn" days into the course (never 0 — avoids division by 0).
  const completedCount = completedSet.size
  const remaining = schedule.totalLessons - completedCount
  const daysIn = Math.max(1, pacing.elapsedDays + 1)
  const pacePerWeek = Math.round((completedCount / (daysIn / 7)) * 10) / 10

  /*
    The items-a-week figure needs a minimum signal. Projected from it, a single
    tick of a 373-item course after 9 days gave finish dates years out ("1 of
    250 after 9 days → 2032"), which reads as a verdict on someone who has
    barely started. The forecast no longer comes from this rate, but a rate
    from one or two ticks still says nothing, so the figure waits for one
    average week's worth of items, and the card counts down to it meanwhile.
  */
  const paceMin = schedule.totalWeeks
    ? Math.max(1, Math.ceil(schedule.totalLessons / schedule.totalWeeks))
    : 1
  const paceNeeds = Math.max(0, paceMin - completedCount)

  const plannedEnd = plannedEndDate(pacing.startDate, schedule.totalDays)
  const { forecast, forecastWeeks, finishShiftDays } = forecastFrom(schedule, thisWeek, oldestOpen, {
    behindCount,
    aheadCount,
  })
  let projectedFinish = null
  if (plannedEnd && finishShiftDays != null) {
    projectedFinish = new Date(plannedEnd)
    projectedFinish.setDate(projectedFinish.getDate() + finishShiftDays)
  }

  // The week runs [startDay, endDay) of the day timeline, and an active
  // learner's day falls inside it, so at least today is left.
  const daysLeft = thisWeek ? thisWeek.endDay - pacing.elapsedDays : 0
  const nextBuffer = schedule.weeks.find((w) => w.isBuffer && w.week > week)

  return {
    status: behindCount > 0 ? 'behind' : aheadCount > 0 ? 'ahead' : 'on-track',
    week,
    totalWeeks: pacing.totalWeeks,
    // 'lesson' | 'item' — what the counts below are counting, for the copy.
    unit: schedule.itemNoun ?? 'lesson',
    // Buffer weeks carry no new content — the UI turns them into catch-up time.
    isBuffer: Boolean(thisWeek?.isBuffer),
    behindCount,
    behindItems,
    aheadCount,
    weekDone,
    weekTotal,
    gradedLeft,
    completedCount,
    remaining,
    pacePerWeek,
    // How many more items until the items-a-week figure shows (0 = shown).
    paceNeeds,
    plannedEnd,
    // 'behind' | 'on-track' | 'ahead' | 'finished' — see forecastFrom.
    forecast,
    // ≈ whole weeks behind or ahead (at least 1 for either); 0 otherwise.
    forecastWeeks,
    // The week of the oldest open item, which the "behind" chip names.
    oldestOpenWeek: oldestOpen ? oldestOpen.week : null,
    // Days the projected finish moves from the planned end: later if
    // positive, earlier if negative, 0 on track; null once finished.
    finishShiftDays,
    // The planned end moved by those days; null once everything is done.
    projectedFinish,
    // This week's days still to come, today included: a 7-day week has 7 on
    // its first day and 1 on its last.
    daysLeft,
    // The first catch-up week after this one: { week, date it begins } | null.
    nextCatchUp: nextBuffer
      ? { week: nextBuffer.week, date: dateOfDay(pacing.startDate, nextBuffer.startDay) }
      : null,
  }
}

/**
 * A catch-up week's daily share: the items a day that clear `open` items in
 * the `daysLeft` days left, rounded up, so keeping to it clears them in time
 * (14 in 5 days: 3 a day). 0 where the figure would only repeat a count: a
 * single item left ("about 1 a day"), or a single day ("about 14 a day").
 */
export function perDayToClear(open, daysLeft) {
  return open > 1 && daysLeft > 1 ? Math.ceil(open / daysLeft) : 0
}

/*
  The finish forecast.

  It used to extrapolate ticks per day, as if every week were as heavy as the
  next. They are not: Data Analytics weeks 1–4 hold 13 of its 27 lessons. So a
  learner the status card called "Right on pace" read "≈ 5 weeks ahead" just
  below it, one with 9 lessons open read "≈ 11 weeks behind", and a Content
  Creation learner 4 weeks behind read "≈ 27 weeks behind", on a 22-week course.

  Now it reads the learner's place in the schedule, by the status card's own
  rule. The learner stands at their oldest open item; the plan stands in the
  current week, which is still in progress, so it never counts as late, and
  finishing it early is not yet "ahead" (that takes ticks in a later week, as
  the status card and "Get ahead" have it):

    oldest open item in an earlier week → 'behind', by the planned days from
      the start of that week to the start of this one. A catch-up week is
      the time the curriculum sets aside for what is still open, so its own
      days are not late: the plan stands at its end. Items from the week just
      before it are on track, and a learner does not fall a week further
      behind the moment it begins, while the status card plans the week;
    in this week                       → 'on-track';
    in a later week                    → 'ahead', by the planned days of the
      weeks after this one that are already done. A catch-up week has nothing
      to tick, so passing one is not progress: only weeks with content count;
    nothing open                       → 'finished'.
  And whenever the status card says "ahead", items ticked in later weeks
  with nothing overdue, so does this: 'ahead' by less than a week counts
  no weeks ("Ahead of plan"). After a first "Get ahead" tick, the status
  card read "You're 1 lesson ahead of schedule" over "On track for …".

  Days, not week numbers, because Graphic Design's half weeks and the weeks
  labelled 13.5, 14.5, … begin mid-week. In weeks they are rounded: at least 1
  behind, and less than half a week ahead (Week 27.5 lasts 3 days) is on
  track. The projected finish is the planned end moved by the same days.

  Measured from this week's start and end, not from today. From today, the
  days already gone in the week would count as late and the days left in it
  as ahead: a learner who finished Week 4 on its first day would read "Right
  on pace" beside "≈ 1 week ahead of plan", and the chip would change from one
  day to the next with nothing ticked. Like the status card, it moves only
  when the learner ticks or the week turns.
*/
function forecastFrom(schedule, thisWeek, oldestOpen, { behindCount, aheadCount }) {
  if (!oldestOpen) return { forecast: 'finished', forecastWeeks: 0, finishShiftDays: null }
  // No week to measure from: read as on track, as every figure above reads a
  // missing week as empty, rather than take the page down.
  if (!thisWeek) return { forecast: 'on-track', forecastWeeks: 0, finishShiftDays: 0 }
  if (oldestOpen.week < thisWeek.week) {
    const openWeek = schedule.weeks.find((w) => w.week === oldestOpen.week)
    const allowance = thisWeek.isBuffer ? thisWeek.days : 0
    const days = thisWeek.startDay - openWeek.startDay - allowance
    if (days > 0) {
      return {
        forecast: 'behind',
        forecastWeeks: Math.max(1, Math.round(days / 7)),
        finishShiftDays: days,
      }
    }
  }
  if (oldestOpen.week > thisWeek.week) {
    const days = schedule.weeks
      .filter((w) => w.week > thisWeek.week && w.week < oldestOpen.week && w.lessons.length > 0)
      .reduce((sum, w) => sum + w.days, 0)
    const weeks = Math.round(days / 7)
    if (weeks > 0) return { forecast: 'ahead', forecastWeeks: weeks, finishShiftDays: -days }
  }
  if (behindCount === 0 && aheadCount > 0) {
    return { forecast: 'ahead', forecastWeeks: 0, finishShiftDays: 0 }
  }
  return { forecast: 'on-track', forecastWeeks: 0, finishShiftDays: 0 }
}
