/**
 * Program registry — every self-paced program the tracker can pace.
 *
 * Pure data (no bundler imports), so the Node verification script can share
 * it with the app. Display names are localized in src/i18n/translations.js
 * (`t.programs[id]`); everything structural lives here.
 *
 *   family  'data-analytics' | 'creative-tech' — drives the two-step picker
 *   layout  how the sheet's 4th column reads (see scheduleModel.js)
 *   csv     bundled curriculum file in src/data/
 */
export const PROGRAMS = {
  da: { id: 'da', family: 'data-analytics', layout: 'cyu', csv: 'da-schedule.csv' },
  cc: { id: 'cc', family: 'creative-tech', layout: 'activity', csv: 'cc-schedule.csv', hidden: true },
  gd: { id: 'gd', family: 'creative-tech', layout: 'activity', csv: 'gd-schedule.csv', hidden: true },
}

export const PROGRAM_IDS = Object.keys(PROGRAMS)

/** The two Creative Tech tracks, in picker order. */
export const CREATIVE_TECH_TRACKS = PROGRAM_IDS.filter((id) => PROGRAMS[id].family === 'creative-tech')

/** Programs visible in the app. Other courses are kept in code but hidden. */
export const VISIBLE_PROGRAMS = Object.fromEntries(
  Object.entries(PROGRAMS).filter(([, p]) => !p.hidden),
)

export const VISIBLE_PROGRAM_IDS = Object.keys(VISIBLE_PROGRAMS)

export const VISIBLE_CREATIVE_TECH_TRACKS = CREATIVE_TECH_TRACKS.filter(
  (id) => !PROGRAMS[id]?.hidden,
)

/** localStorage key holding the learner's chosen program id ('' = not chosen yet). */
export const PROGRAM_KEY = 'program'

export function isProgramId(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PROGRAMS, value)
}

/**
 * One-time migration for learners from the Data-Analytics-only era: they have
 * a start date or ticked lessons but no `program` key. Pin them to DA so
 * nothing changes for them; everyone else gets an explicit "not chosen yet"
 * so the program picker shows. Idempotent — once the key exists (even as '')
 * it is never touched again, so a new learner who sets a date before picking
 * a program is never silently assigned to DA.
 *
 * @param {Storage} storage  injectable for tests
 */
export function migrateLegacyProgram(storage) {
  try {
    if (!storage || storage.getItem(PROGRAM_KEY) !== null) return
    const start = (storage.getItem('startDate') || '').trim()
    let completed = []
    try {
      completed = JSON.parse(storage.getItem('completedLessons') || '[]')
    } catch {
      completed = []
    }
    const isLegacyLearner = start !== '' || (Array.isArray(completed) && completed.length > 0)
    storage.setItem(PROGRAM_KEY, isLegacyLearner ? 'da' : '')
  } catch {
    /* storage unavailable — the picker simply shows */
  }
}
