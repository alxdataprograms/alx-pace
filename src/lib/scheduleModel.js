import { parseCsv, forwardFill } from './csvParser.js'

/**
 * Pure curriculum-model builder. Takes raw CSV text and returns the normalized
 * schedule. Kept free of any bundler-specific imports so it runs identically in
 * the browser build and in a plain Node verification script.
 *
 * Every program sheet shares the same five columns, in two layouts:
 *
 *   'cyu'      (Data Analytics)  Module | Week | Lessons | Check Your Understanding | Graded
 *              One row = one lesson; its CYU line and graded milestone ride along.
 *
 *   'activity' (Creative Tech)   Module | Week | Lessons | Activity | Evaluation quiz
 *              One row = exactly one item: a lesson, an activity, or a graded
 *              quiz / mastery project. Buffer weeks carry a single
 *              "Buffer / catch-up week" marker row and nothing to tick off.
 */

export const DAYS_PER_WEEK = 7

// CSV column layout (see the header row of any src/data/*-schedule.csv).
const COL_MODULE = 0
const COL_WEEK = 1
const COL_LESSON = 2
const COL_SECONDARY = 3 // Check Your Understanding (DA) or Activity (Creative Tech)
const COL_GRADED = 4 // Evaluation Quiz / Graded Test

// The marker a Creative Tech sheet puts in a buffer week — not a task.
const BUFFER_ROW = /^buffer\b/i

/** Pull the week number out of a "Week 7" / "Week 13.5 (Buffer)" label. */
function parseWeekNumber(label) {
  const match = /(\d+(?:\.\d+)?)/.exec(label || '')
  return match ? parseFloat(match[1]) : null
}

/** "Week 4 (Buffer)" is a catch-up week; "Week 13 (½ week)" lasts half a week. */
function parseWeekQualifiers(label) {
  const l = (label || '').toLowerCase()
  return {
    isBuffer: l.includes('buffer'),
    isHalf: l.includes('½') || /\bhalf\b/.test(l),
  }
}

/** Split "DA-1: Data and AI Literacy Foundation" into code + title. */
function parseModule(raw) {
  const full = (raw || '').trim()
  const idx = full.indexOf(':')
  if (idx === -1) return { code: full, title: full, full }
  return {
    code: full.slice(0, idx).trim(),
    title: full.slice(idx + 1).trim(),
    full,
  }
}

/**
 * Classify a graded/evaluation cell so the UI can badge it correctly.
 * @returns {'mastery-project'|'quiz'|'exam'|'integrated-project'|'graded-test'|'graded'|null}
 */
function classifyGraded(text) {
  if (!text) return null
  const t = text.toLowerCase()
  if (t.includes('mastery project')) return 'mastery-project'
  if (t.includes('quiz')) return 'quiz'
  if (t.includes('exam')) return 'exam'
  if (t.includes('integrated project')) return 'integrated-project'
  if (t.includes('graded test')) return 'graded-test'
  return 'graded'
}

/**
 * Kebab-case slug for stable, content-derived ids.
 * Strips accents/punctuation deterministically.
 */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 64)
}

/**
 * A graded cell often packs the project name and the graded-test name on two
 * lines. Keep the primary line as the title and the rest as a subtitle.
 */
function splitGraded(text) {
  const lines = String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  return { title: lines[0], subtitle: lines.slice(1).join(' · '), lines }
}

/**
 * Build the normalized schedule from raw CSV text.
 * @param {string} csvText
 * @param {{ layout?: 'cyu'|'activity' }} [options]
 */
export function buildScheduleFromCsv(csvText, { layout = 'cyu' } = {}) {
  const rawRows = parseCsv(csvText)
  const activityLayout = layout === 'activity'

  // Find the header row deterministically instead of assuming a fixed offset —
  // guards against an extra/removed banner line at the top of the export.
  const headerIndex = rawRows.findIndex(
    (r) =>
      (r[COL_MODULE] || '').trim().toLowerCase() === 'module' &&
      (r[COL_WEEK] || '').trim().toLowerCase() === 'week',
  )
  const bodyRows = headerIndex === -1 ? rawRows : rawRows.slice(headerIndex + 1)

  // Forward-fill the merged Module and Week columns across continuation rows.
  const filled = forwardFill(bodyRows, [COL_MODULE, COL_WEEK])

  const lessons = []
  // Weeks are declared by rows, not by lessons: a buffer week has no lessons
  // but still occupies its slot on the timeline.
  const weekMap = new Map()
  const idCounts = new Map()
  let sequence = 0

  for (const row of filled) {
    const lessonText = (row[COL_LESSON] ?? '').trim()
    const secondaryText = (row[COL_SECONDARY] ?? '').trim()
    const gradedText = (row[COL_GRADED] ?? '').trim()

    // Skip the blank separator rows between modules — nothing to track.
    if (!lessonText && !secondaryText && !gradedText) continue

    const mod = parseModule(row[COL_MODULE])
    const weekLabel = (row[COL_WEEK] ?? '').trim()
    const week = parseWeekNumber(weekLabel)

    if (week != null && !weekMap.has(week)) {
      weekMap.set(week, {
        week,
        weekLabel: weekLabel || `Week ${week}`,
        ...parseWeekQualifiers(weekLabel),
        moduleCode: mod.code,
        moduleTitle: mod.title,
        moduleFull: mod.full,
        lessons: [],
        gradedItems: [],
      })
    }

    // A buffer marker only declares the week; there is nothing to tick off.
    if (BUFFER_ROW.test(lessonText) && !secondaryText && !gradedText) continue

    const cyuText = activityLayout ? '' : secondaryText
    const activityText = activityLayout ? secondaryText : ''
    const gradedType = classifyGraded(gradedText)
    const gradedSplit = gradedText ? splitGraded(gradedText) : null

    // Content-derived id (module + week + title slug), NOT positional:
    // inserting or removing a CSV row cannot silently re-map another lesson's
    // saved completion state in localStorage. A numeric suffix disambiguates
    // exact-duplicate titles within the same week.
    const titleForId =
      lessonText || activityText || (gradedSplit ? gradedSplit.title : cyuText)
    const baseId = `${slugify(mod.code)}-w${week ?? 0}-${slugify(titleForId)}`
    const dupCount = idCounts.get(baseId) || 0
    idCounts.set(baseId, dupCount + 1)

    const lesson = {
      id: dupCount === 0 ? baseId : `${baseId}-${dupCount + 1}`,
      sequence,
      // 'lesson' | 'activity' | 'assessment' (a graded-only row).
      kind: lessonText ? 'lesson' : activityText ? 'activity' : gradedText ? 'assessment' : 'lesson',
      moduleCode: mod.code,
      moduleTitle: mod.title,
      moduleFull: mod.full,
      week,
      weekLabel: weekLabel || (week ? `Week ${week}` : ''),
      // The primary, checkable label for this row.
      title: titleForId,
      lesson: lessonText,
      checkYourUnderstanding: cyuText || null,
      graded: gradedSplit,
      gradedType,
      isGraded: Boolean(gradedText),
    }
    lessons.push(lesson)
    sequence += 1

    const bucket = week != null ? weekMap.get(week) : null
    if (bucket) {
      bucket.lessons.push(lesson)
      if (lesson.isGraded) bucket.gradedItems.push(lesson)
    }
  }

  const weeks = Array.from(weekMap.values()).sort((a, b) => a.week - b.week)

  // Day timeline. Week W begins (W - 1) × 7 days after the start date, so a
  // "Week 13.5" begins half-way through week 13. A week that would begin at
  // midday begins the next morning (ceil). Each week runs until the next one
  // begins; the final week runs a full week (half, if marked "½ week").
  weeks.forEach((wk, i) => {
    wk.index = i
    wk.startDay = Math.ceil((wk.week - 1) * DAYS_PER_WEEK)
  })
  weeks.forEach((wk, i) => {
    const next = weeks[i + 1]
    wk.endDay = next
      ? next.startDay
      : Math.ceil((wk.week - 1 + (wk.isHalf ? 0.5 : 1)) * DAYS_PER_WEEK)
    wk.days = wk.endDay - wk.startDay
  })
  const totalDays = weeks.length ? weeks[weeks.length - 1].endDay : 0

  // Group weeks into modules, preserving first-seen order.
  const moduleMap = new Map()
  for (const wk of weeks) {
    if (!moduleMap.has(wk.moduleCode)) {
      moduleMap.set(wk.moduleCode, {
        code: wk.moduleCode,
        title: wk.moduleTitle,
        full: wk.moduleFull,
        weeks: [],
      })
    }
    moduleMap.get(wk.moduleCode).weeks.push(wk)
  }
  const modules = Array.from(moduleMap.values()).map((m) => ({
    ...m,
    weekStart: m.weeks[0]?.week ?? null,
    weekEnd: m.weeks[m.weeks.length - 1]?.week ?? null,
  }))

  return {
    lessons,
    weeks,
    modules,
    totalLessons: lessons.length,
    totalGraded: lessons.filter((l) => l.isGraded).length,
    // Course length is derived from the data, never hard-coded, so the app
    // cannot lie if a sheet is edited: DA = 98 days, CC = 154, GD = 224.
    totalDays,
    totalWeeks: Math.round((totalDays / DAYS_PER_WEEK) * 10) / 10,
  }
}
