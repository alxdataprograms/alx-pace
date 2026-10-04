import { useCallback, useMemo } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { getSchedule } from '../lib/schedule'
import { PROGRAM_KEY, isProgramId } from '../lib/programs'

/**
 * Zero-login learner profile persisted entirely in localStorage.
 *
 * Storage key contract:
 *   - program           ('da' | 'cc' | 'gd', or '' until the learner picks)
 *   - learnerName       (string, empty until the learner sets it — the UI
 *                        shows a "Your name" placeholder rather than filler)
 *   - startDate         (ISO date string, e.g. "2026-01-15")
 *   - completedLessons  (JSON array of lesson ids)
 *
 * Lesson ids are namespaced by module code (da-…, cc-…, gd-…), so one
 * completedLessons array safely holds every program's progress: switching
 * program never loses ticks, it only changes which ones are shown.
 */

// Empty by default: a blank name reads as "not set yet" so the greeting can
// invite the learner to add theirs instead of showing a generic placeholder.
export const DEFAULT_NAME = ''

// Older builds seeded this filler name (and may have persisted it on reset),
// so returning learners still have it in storage. Treat it as "not set" so
// they get the friendly "Your name" prompt without having to clear anything.
const LEGACY_DEFAULT_NAME = 'ALX Tech Fellow'

const KEY_NAME = 'learnerName'
const KEY_START = 'startDate'
const KEY_COMPLETED = 'completedLessons'

export function useLearnerProfile() {
  const [storedProgram, setStoredProgram] = useLocalStorage(PROGRAM_KEY, '', { raw: true })
  const program = isProgramId(storedProgram) ? storedProgram : ''
  const schedule = program ? getSchedule(program) : null

  // Only ids that exist in the active program's bundled schedule are valid —
  // protects completedLessons if a curriculum is ever re-versioned, and
  // keeps other programs' ticks out of this program's counts.
  const validIds = useMemo(
    () => new Set(schedule ? schedule.lessons.map((l) => l.id) : []),
    [schedule],
  )

  const [storedName, setLearnerName] = useLocalStorage(KEY_NAME, DEFAULT_NAME, { raw: true })
  // Coerce the legacy filler to empty so the placeholder greeting shows.
  const learnerName = storedName === LEGACY_DEFAULT_NAME ? '' : storedName
  const [startDate, setStartDate] = useLocalStorage(KEY_START, '', { raw: true })
  const [completedRaw, setCompletedRaw] = useLocalStorage(KEY_COMPLETED, [])

  // Guardrail: coerce whatever is in storage into a clean, deduplicated array
  // of known ids, so the visible count can never disagree with the percent.
  const completedLessons = useMemo(() => {
    const list = Array.isArray(completedRaw) ? completedRaw : []
    return Array.from(new Set(list.filter((id) => validIds.has(id))))
  }, [completedRaw, validIds])

  const completedSet = useMemo(() => new Set(completedLessons), [completedLessons])

  /*
    Whether "Reset" has anything to clear: a program, a name, a start date, or
    ticks in ANY program (completedLessons above holds the active program's
    only, and none at all before one is chosen). The footer offers reset only
    then, so a first visit is not offered to reset nothing, and must offer it
    whenever any of this exists, or a learner could not clear their own data.
  */
  const hasLearnerData =
    Boolean(program || learnerName || startDate) ||
    (Array.isArray(completedRaw) && completedRaw.length > 0)

  const toggleLesson = useCallback(
    (id) => {
      if (!validIds.has(id)) return
      setCompletedRaw((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      })
    },
    [setCompletedRaw, validIds],
  )

  const setLessonsCompleted = useCallback(
    (ids, completed) => {
      const target = new Set(ids.filter((id) => validIds.has(id)))
      setCompletedRaw((prev) => {
        const list = new Set(Array.isArray(prev) ? prev : [])
        for (const id of target) {
          if (completed) list.add(id)
          else list.delete(id)
        }
        return Array.from(list)
      })
    },
    [setCompletedRaw, validIds],
  )

  const updateProgram = useCallback(
    (id) => {
      if (isProgramId(id)) setStoredProgram(id)
    },
    [setStoredProgram],
  )

  const updateName = useCallback(
    (name) => {
      setLearnerName((name || '').trim())
    },
    [setLearnerName],
  )

  const updateStartDate = useCallback(
    (iso) => {
      setStartDate(iso || '')
    },
    [setStartDate],
  )

  const resetProfile = useCallback(() => {
    setStoredProgram('')
    setLearnerName(DEFAULT_NAME)
    setStartDate('')
    setCompletedRaw([])
  }, [setStoredProgram, setLearnerName, setStartDate, setCompletedRaw])

  return {
    program,
    schedule,
    learnerName,
    startDate,
    completedLessons,
    completedSet,
    hasLearnerData,
    updateProgram,
    updateName,
    updateStartDate,
    toggleLesson,
    setLessonsCompleted,
    resetProfile,
  }
}
