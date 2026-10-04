/**
 * The moments worth telling someone about.
 *
 * WHY MODULES AND NOT GRADED ITEMS
 * The curriculum has 19 graded items across 14 weeks — a congratulation every
 * few days. Two things go wrong at that rate. People stop reading a dialogue
 * that keeps appearing, so the one that matters is dismissed with the rest.
 * And "I passed a graded test" is not a sentence anyone writes on LinkedIn,
 * whereas "I finished the SQL module" is.
 *
 * So there are five moments in fourteen weeks: each of the four modules, and
 * the programme itself. Roughly one every three weeks, each of them a thing a
 * person would actually say out loud.
 *
 * PURE, AND DERIVED RATHER THAN RECORDED
 * Nothing writes "you completed DA-3" anywhere. Achievement is recomputed from
 * the completed lessons every render, which means it survives a lesson being
 * un-ticked and re-ticked, and it cannot drift from the progress bar beside it.
 * The only thing persisted is which ones have already been SHOWN.
 */

import { shareUrl } from './appUrl'
import { DAYS_PER_WEEK } from './scheduleModel'

const PROGRAM_TITLES = { da: 'Data Analytics', cc: 'Content Creation', gd: 'Graphic Design' }

/**
 * `weeks` is whole or a half (3.5); `lessons` counts every row, which `unit`
 * names; `masteryProject` is the module's capstone by name, or null.
 * @typedef {{ id: string, kind: 'module'|'programme', program: string, code: string|null, title: string, weeks: number, index: number, total: number, lessons: number, unit: 'lesson'|'item', masteryProject: string|null }} Milestone
 */

/*
  A MODULE LASTS AS LONG AS ITS DAYS, NOT ITS WEEK ENTRIES
  Graphic Design's GD-4 holds Week 11, Week 12, Week 13 (½ week) and Week 13.5
  (Buffer): four entries, three and a half weeks. Counting entries told a
  learner "4 weeks" about a module the curriculum calls 3½.

  The timeline starts every week on a whole day — a week labelled mid-week
  begins the next morning — so a module holding a half week spans 24 or 25
  days, not 24½. Every week in the sheets is whole or half (verify-parser
  asserts it), so rounding to the nearest half week gives back the sheet's own
  figure exactly.
*/
const weeksSpanned = (weeks) =>
  Math.round((weeks.reduce((days, w) => days + w.days, 0) / DAYS_PER_WEEK) * 2) / 2

/*
  MILESTONE IDS ARE SHARED ACROSS PROGRAMS, SO THEY MUST NOT COLLIDE
  `alx-celebrated` is one array for every program, like completedLessons.
  Module ids are already distinct — the code comes from the sheet (DA-1, CC-1,
  GD-1). The programme id is not, so it carries the program for everyone except
  Data Analytics, which keeps the bare 'programme' it has always written: that
  is what DA learners already have in storage, and what the bridge carries.
*/
export function programmeId(programId = 'da') {
  return programId === 'da' ? 'programme' : `programme:${programId}`
}

/**
 * Every milestone id this program can ever produce, achieved or not.
 *
 * @param {{ modules: any[] } | null} schedule
 * @param {string} programId
 * @returns {Set<string>}
 */
export function milestoneIds(schedule, programId = 'da') {
  if (!schedule) return new Set()
  return new Set([...schedule.modules.map((m) => `module:${m.code}`), programmeId(programId)])
}

/**
 * Every milestone the learner has now reached, in curriculum order.
 *
 * @param {{ modules: any[], lessons: any[], totalLessons: number, totalWeeks: number, itemNoun?: 'lesson'|'item' } | null} schedule
 * @param {Set<string>} completedSet
 * @param {string} [programId] which program `schedule` is — 'da' by default
 * @returns {Milestone[]}
 */
export function achievedMilestones(schedule, completedSet, programId = 'da') {
  const found = []
  // No program chosen yet: nothing to have achieved.
  if (!schedule) return found

  schedule.modules.forEach((module, i) => {
    const lessons = module.weeks.flatMap((w) => w.lessons)
    // A module with no lessons cannot be "complete" — every() is true for an
    // empty array, and that would announce an achievement for finishing nothing.
    if (lessons.length === 0) return
    if (lessons.every((l) => completedSet.has(l.id))) {
      found.push({
        id: `module:${module.code}`,
        kind: 'module',
        program: programId,
        code: module.code,
        title: module.title,
        weeks: weeksSpanned(module.weeks),
        lessons: lessons.length,
        unit: schedule.itemNoun ?? 'lesson',
        // "module 3 of 4" is worth more in a post than the module code, and
        // both come from the schedule rather than being written down anywhere.
        index: i + 1,
        total: schedule.modules.length,
        // Named in a Creative Tech post: the project is the part of a module
        // a design or content learner can show an employer.
        masteryProject: module.masteryProject ?? null,
      })
    }
  })

  if (schedule.totalLessons > 0 && schedule.lessons.every((l) => completedSet.has(l.id))) {
    found.push({
      id: programmeId(programId),
      kind: 'programme',
      program: programId,
      code: null,
      // The localised program name is applied where the text is built; this
      // is only the English fallback, used for nothing a learner reads.
      title: PROGRAM_TITLES[programId] ?? PROGRAM_TITLES.da,
      // The programme's length, as the picker and the roadmap state it. Not
      // weeks.length: Graphic Design's half week and the buffer that starts
      // half-way through it are two entries, so counting them said 33, not 32.
      weeks: schedule.totalWeeks,
      // All of them, which in Creative Tech includes activities and quizzes —
      // the unit makes the post say "items" there rather than "lessons".
      lessons: schedule.totalLessons,
      unit: schedule.itemNoun ?? 'lesson',
      index: schedule.modules.length,
      total: schedule.modules.length,
      masteryProject: null,
    })
  }

  return found
}

/**
 * The milestones that ticking `ids` as well as `completedSet` reaches, and
 * that `seen` does not hold yet, by id.
 *
 * "Already started?" ticks the weeks before this one in one go for a learner
 * who did them on the ALX platform before finding Pace, and records these as
 * shown. Graphic Design's Weeks 1–8 complete two modules: without the record,
 * a LinkedIn dialogue for a module finished weeks ago would open the moment
 * the learner set the app up. The modules are still achieved, and keep their
 * Share button in the roadmap.
 *
 * @param {{ modules: any[], lessons: any[], totalLessons: number } | null} schedule
 * @param {Set<string>} completedSet
 * @param {string[]} ids
 * @param {string} programId
 * @param {string[]} seen
 * @returns {string[]}
 */
export function milestonesCrossed(schedule, completedSet, ids, programId, seen) {
  const shown = new Set(Array.isArray(seen) ? seen : [])
  return achievedMilestones(schedule, new Set([...completedSet, ...ids]), programId)
    .map((m) => m.id)
    .filter((id) => !shown.has(id))
}

/**
 * The one to celebrate now, or null.
 *
 * The LAST unseen milestone rather than the first. Someone who ticks off a
 * backlog in one sitting can cross two at once, and being congratulated for
 * finishing module two while module three is also done reads as the app being
 * behind them. The others are still marked seen, so nothing reappears later.
 *
 * @param {Milestone[]} achieved
 * @param {string[]} alreadySeen
 * @returns {Milestone|null}
 */
export function nextToCelebrate(achieved, alreadySeen) {
  const seen = new Set(alreadySeen)
  const unseen = achieved.filter((m) => !seen.has(m.id))
  return unseen.length > 0 ? unseen[unseen.length - 1] : null
}

/**
 * The campaign hashtag, in one place.
 *
 * On its own line at the end, which is how ALX writes it and how a person
 * spots it if they trim the post while editing. A hashtag buried mid-sentence
 * is the one that gets deleted by accident.
 */
export const CAMPAIGN_HASHTAG = '#LifeAtALX'

/**
 * What the learner is offered to post.
 *
 * DELIBERATELY PLAIN, AND IN THEIR VOICE
 * A statement of what was finished and where they are, and nothing else. The
 * pull is towards "Thrilled to share that I have embarked on…", and that is
 * exactly what makes a campaign post read as homework rather than as somebody
 * saying something. Specific and flat is more convincing than enthusiastic.
 *
 * Kept short on purpose too: the whole text travels in a URL, and a long post
 * pushes that toward limits that differ by browser.
 *
 * @param {Milestone} milestone
 * @param {{ moduleDone: (m: Milestone) => string, programmeDone: (m: Milestone) => string }} t
 */
export function buildPostText(milestone, t) {
  const { body, url, hashtag } = postParts(milestone, t)
  return `${body}\n\n${url}\n\n${hashtag}`
}

/**
 * The same post, in pieces, for display.
 *
 * The dialogue cannot just print the finished string. Both the URL and the
 * hashtag are Latin runs, and inside the Arabic paragraph the bidirectional
 * algorithm reorders them — the hashtag came out as "IAmTheStory_ALX#" before it
 * was isolated, and a bare URL fares no better. Each needs its own <bdi>.
 *
 * Composed the other way round — buildPostText is built FROM this — so the text
 * that reaches LinkedIn and the text on screen cannot drift apart.
 *
 * `runs` is the body again, cut around its curriculum titles so the dialogue
 * can isolate those as well (see titleRuns). Joined, it is exactly `body`.
 */
export function postParts(milestone, t) {
  const compose = milestone.kind === 'programme' ? t.programmeDone : t.moduleDone
  return {
    body: compose(milestone),
    runs: titleRuns(milestone, compose),
    // The learner's program page, so the link previews as their program.
    url: shareUrl(milestone.program),
    hashtag: CAMPAIGN_HASHTAG,
  }
}

/*
  Private-use characters: no curriculum cell contains them, and they are
  only ever composed into the display copy, never into the post.
*/
const TITLE_OPEN = '\uE000'
const TITLE_CLOSE = '\uE001'
const marked = (title) => (title ? `${TITLE_OPEN}${title}${TITLE_CLOSE}` : title)

/**
 * The body as runs of text, with the module and mastery-project titles marked
 * `isolate`.
 *
 * Those titles stay in English in every language — they are the names learners
 * match on the ALX platform — so in the Arabic sentence each is a Latin run,
 * and a Latin run that begins or ends on punctuation is reordered by the
 * bidirectional algorithm the way the hashtag was. Isolating them on screen
 * changes nothing a learner can see today, and keeps it that way.
 *
 * WHY THE TITLES ARE MARKED RATHER THAN SEARCHED FOR
 * GD-3 is "Poster Design & Visual Composition" and its mastery project is
 * "Poster Design", so looking for the project's name in the sentence finds it
 * inside the module's. Composing the body once more with each title wrapped in
 * marks shows exactly where the translation put it.
 */
function titleRuns(milestone, compose) {
  if (milestone.kind !== 'module') return [{ text: compose(milestone), isolate: false }]
  const text = compose({
    ...milestone,
    title: marked(milestone.title),
    masteryProject: marked(milestone.masteryProject),
  })
  const runs = []
  text.split(TITLE_OPEN).forEach((part, i) => {
    const [title, after] = i === 0 ? ['', part] : part.split(TITLE_CLOSE)
    if (title) runs.push({ text: title, isolate: true })
    if (after) runs.push({ text: after, isolate: false })
  })
  return runs
}

/**
 * Drops seen-records for milestones that are no longer achieved.
 *
 * WHY THIS EXISTS — A REAL BUG, FOUND IN THE WILD
 * Achievement is derived from completed lessons, so un-ticking withdraws it.
 * The record of what has been SHOWN was not following the same rule, and the
 * two drifting apart is unrecoverable without a console.
 *
 * The path is ordinary. Someone ticks everything to see what the app does, gets
 * the programme dialogue, dismisses it — and dismissing marks every achieved
 * milestone seen, all five. Then they un-tick back to their real progress. The
 * milestones are withdrawn; the seen-records are not. Every future module
 * completion is now silently suppressed, forever, with nothing on screen to
 * explain why and no way to undo it.
 *
 * Pruning keeps the invariant that makes the feature comprehensible: `seen` is
 * always a subset of `achieved`. Lose a milestone, lose its record; earn it
 * again, and it is celebrated again.
 *
 * The cost is a learner who un-ticks and re-ticks a lesson seeing the dialogue
 * a second time. That is a mild annoyance, and it is visible. The alternative
 * is silence that looks exactly like the feature being broken — which is how
 * this was found.
 *
 * SCOPED TO ONE PROGRAM
 * The seen-list is shared by every program, so "not achieved" only means
 * something for ids the current program owns. Pass `owned` (see
 * {@link milestoneIds}) and every other id is left exactly as it is — otherwise
 * a DA graduate opening Graphic Design would have their DA records pruned, and
 * be congratulated all over again on switching back.
 *
 * @param {Milestone[]} achieved
 * @param {string[]} seen
 * @param {Set<string>} [owned] ids this program can produce; omit to treat every id as owned
 * @returns {string[]|null} the pruned list, or null when nothing needs pruning
 */
export function pruneCelebrated(achieved, seen, owned) {
  const list = Array.isArray(seen) ? seen : []
  const achievedIds = new Set(achieved.map((m) => m.id))
  const keep = (id) => achievedIds.has(id) || (owned instanceof Set && !owned.has(id))
  // null rather than an equal array, so callers can skip a pointless write —
  // this runs on every change to completed lessons.
  if (list.every(keep)) return null
  return list.filter(keep)
}
