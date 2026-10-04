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
