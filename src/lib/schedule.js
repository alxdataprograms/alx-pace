import daCsv from '../data/da-schedule.csv?raw'
import ccCsv from '../data/cc-schedule.csv?raw'
import gdCsv from '../data/gd-schedule.csv?raw'
import { buildScheduleFromCsv } from './scheduleModel'
import { PROGRAMS } from './programs'

/**
 * The bundled curriculum models, one per program.
 *
 * Each CSV is imported with Vite's `?raw` suffix, so it is compiled straight
 * into the bundle: no network fetch, no loading state, works offline, and the
 * learner never touches a file input. Built once at module load — the CSVs
 * are static, so there is no reason to recompute per render.
 */
const CSV_BY_PROGRAM = { da: daCsv, cc: ccCsv, gd: gdCsv }

export const SCHEDULES = Object.fromEntries(
  Object.values(PROGRAMS).map((p) => [
    p.id,
    buildScheduleFromCsv(CSV_BY_PROGRAM[p.id], { layout: p.layout }),
  ]),
)

/** The schedule for a program id, or null when no program is chosen. */
export function getSchedule(programId) {
  return SCHEDULES[programId] || null
}

/** Look up a single week object (or null if out of range). */
export function getWeek(schedule, weekNumber) {
  return schedule?.weeks.find((w) => w.week === weekNumber) || null
}

/**
 * The weeks after `weekNumber` with something to tick, in order: where the
 * focus card's "Get ahead" looks once this week is done. A catch-up week
 * carries nothing of its own, so it is never one of them. Empty after the
 * programme's last week with content.
 */
export function contentWeeksAfter(schedule, weekNumber) {
  return schedule?.weeks.filter((w) => w.week > weekNumber && w.lessons.length > 0) ?? []
}

/**
 * The weeks before week `weekNumber`, as "Already started?" offers to tick
 * them: the first and last of them as the curriculum numbers them, and every
 * item they hold, in curriculum order. The span counts a catch-up week like
 * any other: Graphic Design's Week 9 follows "Weeks 1–8", whose Week 8 has
 * nothing of its own. Null in the first week, which has none before it.
 *
 * @returns {{ from: number, to: number, items: object[] } | null}
 */
export function weeksBefore(schedule, weekNumber) {
  const index = schedule?.weeks.findIndex((w) => w.week === weekNumber) ?? -1
  if (index < 1) return null
  const weeks = schedule.weeks.slice(0, index)
  return {
    from: weeks[0].week,
    to: weeks[weeks.length - 1].week,
    items: weeks.flatMap((w) => w.lessons),
  }
}

/**
 * A week's next checkpoint: its first graded item still open, in the sheet's
 * order, and how many open items lead up to it, itself included — the
 * "9 items away" of "Next checkpoint: Quiz 1: Poster Design". Items ticked
 * out of order do not count. Null once nothing graded is left open.
 *
 * @returns {{ item: object, away: number } | null}
 */
export function nextCheckpoint(week, completedSet) {
  let away = 0
  for (const item of week?.lessons ?? []) {
    if (completedSet.has(item.id)) continue
    away += 1
    if (item.isGraded) return { item, away }
  }
  return null
}

/**
 * The module holding week `weekNumber`: its place in the programme ("Module
 * 3 of 10") and how many of its items are done. A catch-up week belongs to the
 * module it closes. Null without a schedule or such a week.
 *
 * @returns {{ code: string, title: string, index: number, total: number, done: number, items: number } | null}
 */
export function moduleProgress(schedule, weekNumber, completedSet) {
  const index = schedule?.modules.findIndex((m) => m.weeks.some((w) => w.week === weekNumber)) ?? -1
  if (index === -1) return null
  const module = schedule.modules[index]
  const items = module.weeks.flatMap((w) => w.lessons)
  return {
    code: module.code,
    title: module.title,
    index: index + 1,
    total: schedule.modules.length,
    done: items.filter((l) => completedSet.has(l.id)).length,
    items: items.length,
  }
}
