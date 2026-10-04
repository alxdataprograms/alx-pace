/**
 * Deterministic parser verification. Runs the *real* production parser against
 * every bundled program CSV in plain Node (no bundler) and asserts each
 * normalized model is correct. Run with: `npm run parser:check`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildScheduleFromCsv } from '../src/lib/scheduleModel.js'
import { PROGRAMS } from '../src/lib/programs.js'

const here = dirname(fileURLToPath(import.meta.url))

function load(id) {
  const program = PROGRAMS[id]
  const csv = readFileSync(resolve(here, '../src/data', program.csv), 'utf8')
  return buildScheduleFromCsv(csv, { layout: program.layout })
}

let failures = 0
const check = (label, cond, detail = '') => {
  const ok = Boolean(cond)
  if (!ok) failures += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
}

const list = (xs) => xs.join(',')

/** Checks every program must pass, whatever its layout. */
function commonChecks(id, model, { totalWeeks, modules }) {
  check('parsed at least one lesson', model.lessons.length > 0, `${model.lessons.length} lessons`)
  check(`program spans exactly ${totalWeeks} weeks`, model.totalWeeks === totalWeeks, `${model.totalWeeks} weeks / ${model.totalDays} days`)
  check(`exactly ${modules} modules`, model.modules.length === modules, list(model.modules.map((m) => m.code)))

  // Forward-fill: every content lesson must carry a module + week even though the
  // CSV leaves those cells blank on continuation rows.
  const orphanModule = model.lessons.filter((l) => !l.moduleCode)
  const orphanWeek = model.lessons.filter((l) => l.week == null)
  check('forward-fill: every lesson has a module', orphanModule.length === 0, `${orphanModule.length} orphans`)
  check('forward-fill: every lesson has a week', orphanWeek.length === 0, `${orphanWeek.length} orphans`)

  // Timeline: weeks tile the course with no gaps or overlaps, starting on day 0,
  // and each week's label step matches its length (a "½ week" is followed by
  // a week labelled half a week later).
  const gaps = model.weeks.filter((w, i) => i > 0 && w.startDay !== model.weeks[i - 1].endDay)
  check('timeline starts on day 0', model.weeks[0]?.startDay === 0)
  check('timeline is contiguous', gaps.length === 0, gaps.map((w) => w.weekLabel).join(', '))
  const badSteps = model.weeks.filter((w, i) => {
    const next = model.weeks[i + 1]
    return next && next.week - w.week !== (w.isHalf ? 0.5 : 1)
  })
  check('week labels step by their length', badSteps.length === 0, badSteps.map((w) => w.weekLabel).join(', '))

  // No blank separator rows (or buffer markers) leaked in as lessons.
  const blanks = model.lessons.filter((l) => !l.lesson && !l.checkYourUnderstanding && !l.graded && l.kind !== 'activity')
  check('no blank separator rows leaked into lessons', blanks.length === 0, `${blanks.length} blanks`)
  const markers = model.lessons.filter((l) => /^buffer\b/i.test(l.title))
  check('no buffer markers leaked into lessons', markers.length === 0, `${markers.length} markers`)

  check('graded total is consistent', model.totalGraded === model.lessons.filter((l) => l.isGraded).length, `${model.totalGraded} graded`)

  // Stable ids are unique and content-derived (not positional), so editing the
  // CSV can never silently re-map saved completion state.
  const ids = new Set(model.lessons.map((l) => l.id))
  check('lesson ids are unique', ids.size === model.lessons.length, `${ids.size}/${model.lessons.length}`)
  const idPattern = new RegExp(`^${id}-\\d+-w\\d+(\\.\\d+)?-[a-z0-9-]+$`)
  check('lesson ids are content-derived slugs', model.lessons.every((l) => idPattern.test(l.id)), model.lessons[3]?.id)
}

/** Checks shared by the Creative Tech tracks (one item per row, buffers). */
function creativeTechChecks(model, { bufferWeeks, halfWeeks }) {
  const buffers = model.weeks.filter((w) => w.isBuffer).map((w) => w.week)
  check('buffer weeks detected', list(buffers) === list(bufferWeeks), list(buffers))
  check('buffer weeks carry nothing to tick off', model.weeks.filter((w) => w.isBuffer).every((w) => w.lessons.length === 0))
  check('every content week has items', model.weeks.filter((w) => !w.isBuffer).every((w) => w.lessons.length > 0))
  const halves = model.weeks.filter((w) => w.isHalf).map((w) => w.week)
  check('half weeks detected', list(halves) === list(halfWeeks), list(halves) || 'none')

  const kinds = new Set(model.lessons.map((l) => l.kind))
  check('lessons, activities and assessments all present', kinds.has('lesson') && kinds.has('activity') && kinds.has('assessment'))
  check('activity rows never pose as Check Your Understanding', model.lessons.every((l) => l.checkYourUnderstanding === null))
  check('every graded row is a quiz or mastery project', model.lessons.filter((l) => l.isGraded).every((l) => ['quiz', 'mastery-project'].includes(l.gradedType)))

  // Each course (module) has exactly one mastery project.
  const masteryPerModule = model.modules.map(
    (m) => model.lessons.filter((l) => l.moduleCode === m.code && l.gradedType === 'mastery-project').length,
  )
  check('each module has exactly one mastery project', masteryPerModule.every((n) => n === 1), list(masteryPerModule))

  /*
    What a module post says about it: "…including my mastery project: Poster
    Design." Checked against the sheets rather than assumed.

    The project sits in its module's final content week, but it is NOT always
    the module's last row — CC-5 lists a quiz after it. So a module post may
    claim the project only because a module counts as finished once every row
    is ticked, never because of where the project falls.

    The cell reads "Mastery Project: <name>" and the model keeps the name.
    That name ends the Arabic post as a Latin run, which the bidirectional
    algorithm leaves alone only while it begins and ends on a letter or digit.
  */
  const masteryOf = (m) => m.weeks.flatMap((w) => w.lessons).find((l) => l.gradedType === 'mastery-project')
  const lastContentWeek = (m) => m.weeks.filter((w) => !w.isBuffer).at(-1)
  const misplaced = model.modules.filter((m) => masteryOf(m)?.week !== lastContentWeek(m)?.week)
  const notLastRow = model.modules.filter((m) => m.weeks.flatMap((w) => w.lessons).at(-1) !== masteryOf(m))
  check(
    "each mastery project falls in its module's final content week",
    misplaced.length === 0,
    misplaced.length
      ? list(misplaced.map((m) => m.code))
      : notLastRow.length
        ? `but not always the last row: ${list(notLastRow.map((m) => m.code))}`
        : 'and is every module’s last row',
  )
  const badCells = model.modules.filter((m) => {
    const cell = masteryOf(m)?.graded
    return !cell || cell.lines.length !== 1 || !/^Mastery Project: \S/.test(cell.title)
  })
  check('each mastery project is written "Mastery Project: <name>"', badCells.length === 0, list(badCells.map((m) => m.code)))
  const badNames = model.modules.filter((m) => !/^[\p{L}\p{N}](.*[\p{L}\p{N}])?$/u.test(m.masteryProject ?? ''))
  check(
    'each module names its mastery project, starting and ending on a letter or digit',
    badNames.length === 0,
    badNames.length ? list(badNames.map((m) => m.code)) : model.modules.map((m) => m.masteryProject).join(' | '),
  )
}

function summary(model) {
  console.log('\n-- Week-by-week summary --')
  for (const w of model.weeks) {
    const flag = w.isBuffer ? ' (buffer)' : w.isHalf ? ' (½ week)' : ''
    console.log(
      `  Week ${String(w.week).padStart(4)} · days ${String(w.startDay).padStart(3)}–${String(w.endDay - 1).padEnd(3)} · ${w.moduleCode.padEnd(5)} · ${String(w.lessons.length).padStart(2)} items · ${w.gradedItems.length} graded${flag}`,
    )
  }
  console.log(`\nTotals: ${model.totalLessons} items, ${model.totalGraded} graded, ${model.modules.length} modules, ${model.totalWeeks} weeks (${model.totalDays} days)\n`)
}

/* ---------------- Data Analytics ---------------- */
{
  console.log('\n== ALX DA schedule parser verification ==\n')
  const model = load('da')
  commonChecks('da', model, { totalWeeks: 14, modules: 4 })

  check('week numbers are 1..14 in order', model.weeks.map((w) => w.week).join(',') === Array.from({ length: 14 }, (_, i) => i + 1).join(','))

  // A continuation row (blank Module cell in the source) still resolves to DA-1.
  const week1 = model.weeks.find((w) => w.week === 1)
  check('Week 1 belongs to DA-1', week1 && week1.moduleCode === 'DA-1', week1 && week1.moduleCode)
  check('Week 1 has multiple lessons (continuation rows filled)', week1 && week1.lessons.length >= 5, week1 && `${week1.lessons.length} lessons`)

  // Module boundaries.
  const modByCode = Object.fromEntries(model.modules.map((m) => [m.code, m]))
  check('DA-1 spans weeks 1–2', modByCode['DA-1']?.weekStart === 1 && modByCode['DA-1']?.weekEnd === 2)
  check('DA-2 spans weeks 3–5', modByCode['DA-2']?.weekStart === 3 && modByCode['DA-2']?.weekEnd === 5)
  check('DA-3 spans weeks 6–10', modByCode['DA-3']?.weekStart === 6 && modByCode['DA-3']?.weekEnd === 10)
  check('DA-4 spans weeks 11–14', modByCode['DA-4']?.weekStart === 11 && modByCode['DA-4']?.weekEnd === 14)

  // Multiline quoted cell: Week 3 has an Integrated Project whose graded cell
  // packs the project name + graded test on two lines.
  const week3 = model.weeks.find((w) => w.week === 3)
  const ip = week3?.lessons.find((l) => l.gradedType === 'integrated-project')
  check('multiline graded cell parsed (Week 3 Integrated Project)', Boolean(ip), ip && ip.graded?.title?.slice(0, 42))
  check('multiline graded cell kept its second line as subtitle', Boolean(ip?.graded?.subtitle), ip?.graded?.subtitle?.slice(0, 42))

  // Graded classification sanity.
  check('some graded exams detected', model.lessons.some((l) => l.gradedType === 'exam'))
  check('some graded tests detected', model.lessons.some((l) => l.gradedType === 'graded-test'))
  check('every DA row is a lesson', model.lessons.every((l) => l.kind === 'lesson'))
  check('no buffer weeks in DA', model.weeks.every((w) => !w.isBuffer))
  // A DA module post names no mastery project, so it reads as it always has.
  check('no DA module has a mastery project', model.modules.every((m) => m.masteryProject === null))

  // The Week-12 source paste artifact (duplicated project title) stays fixed.
  const w12 = model.weeks.find((w) => w.week === 12)
  const w12graded = w12?.lessons.find((l) => l.isGraded)
  check(
    'Week 12 graded title is not duplicated',
    w12graded && !/NdogoIntegrated/.test(w12graded.graded.title),
    w12graded?.graded?.title?.slice(0, 60),
  )
  summary(model)
}

/* ---------------- Creative Tech · Content Creation ---------------- */
{
  console.log('== ALX Creative Tech · Content Creation parser verification ==\n')
  const model = load('cc')
  commonChecks('cc', model, { totalWeeks: 22, modules: 5 })
  creativeTechChecks(model, { bufferWeeks: [4, 10, 14, 20, 22], halfWeeks: [] })

  // "Week 3" first appears mid-module on an activity row: the rows above it
  // must still forward-fill to Week 2.
  const w3 = model.weeks.find((w) => w.week === 3)
  check('mid-module week label starts on an activity row', w3?.lessons[0]?.kind === 'activity', w3?.lessons[0]?.title)
  summary(model)
}

/* ---------------- Creative Tech · Graphic Design ---------------- */
{
  console.log('== ALX Creative Tech · Graphic Design parser verification ==\n')
  const model = load('gd')
  commonChecks('gd', model, { totalWeeks: 32, modules: 10 })
  creativeTechChecks(model, {
    bufferWeeks: [4, 8, 10, 13.5, 17.5, 20.5, 24.5, 28, 30, 32],
    halfWeeks: [13, 27.5],
  })

  const modByCode = Object.fromEntries(model.modules.map((m) => [m.code, m]))
  check('GD-5 spans weeks 14.5–17.5', modByCode['GD-5']?.weekStart === 14.5 && modByCode['GD-5']?.weekEnd === 17.5)
  check('GD-10 spans weeks 31–32', modByCode['GD-10']?.weekStart === 31 && modByCode['GD-10']?.weekEnd === 32)
  summary(model)
}

/* ---------------- Cross-program ---------------- */
{
  console.log('== Cross-program ==\n')
  const all = Object.keys(PROGRAMS).flatMap((id) => load(id).lessons.map((l) => l.id))
  check('no lesson id is shared between programs', new Set(all).size === all.length, `${all.length} ids`)
}

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed.\n`)
  process.exit(1)
}
console.log('\n✅ All parser checks passed.\n')
