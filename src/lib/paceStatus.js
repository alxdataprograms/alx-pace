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
 */
import { atMidnight, plannedEndDate } from './pacing'

export function computePaceStatus(schedule, completedSet, pacing, now = new Date()) {
  if (pacing.status !== 'active') return null

  const week = pacing.currentWeek

  const behindItems = []
  let aheadCount = 0
  for (const lesson of schedule.lessons) {
    if (lesson.week == null) continue
    const done = completedSet.has(lesson.id)
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

  // Personal pace + finish forecast. Day 1 is the start date itself, so the
  // learner is "daysIn" days into the course (never 0 — avoids division by 0).
  const completedCount = completedSet.size
  const remaining = schedule.totalLessons - completedCount
  const daysIn = Math.max(1, pacing.elapsedDays + 1)
  const pacePerWeek = Math.round((completedCount / (daysIn / 7)) * 10) / 10

  const plannedEnd = plannedEndDate(pacing.startDate, schedule.totalDays)
  let projectedFinish = null
  let finishDeltaDays = null
  if (completedCount > 0) {
    const perDay = completedCount / daysIn
    const daysLeft = Math.ceil(remaining / perDay)
    projectedFinish = atMidnight(now)
    projectedFinish.setDate(projectedFinish.getDate() + daysLeft)
    if (plannedEnd) {
      finishDeltaDays = Math.round((plannedEnd - projectedFinish) / (24 * 60 * 60 * 1000))
    }
  }

  return {
    status: behindCount > 0 ? 'behind' : aheadCount > 0 ? 'ahead' : 'on-track',
    week,
    totalWeeks: pacing.totalWeeks,
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
    plannedEnd,
    projectedFinish,
    // Positive = projected to finish EARLY by that many days; negative = late.
    finishDeltaDays,
  }
}
