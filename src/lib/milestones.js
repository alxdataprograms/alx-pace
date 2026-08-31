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

/** @typedef {{ id: string, kind: 'module'|'programme', code: string|null, title: string, weeks: number, index: number, total: number, lessons: number }} Milestone */

/**
 * Every milestone the learner has now reached, in curriculum order.
 *
 * @param {{ modules: any[], lessons: any[], totalLessons: number }} schedule
 * @param {Set<string>} completedSet
 * @returns {Milestone[]}
 */
export function achievedMilestones(schedule, completedSet) {
  const found = []

  schedule.modules.forEach((module, i) => {
    const lessons = module.weeks.flatMap((w) => w.lessons)
    // A module with no lessons cannot be "complete" — every() is true for an
    // empty array, and that would announce an achievement for finishing nothing.
    if (lessons.length === 0) return
    if (lessons.every((l) => completedSet.has(l.id))) {
      found.push({
        id: `module:${module.code}`,
        kind: 'module',
        code: module.code,
        title: module.title,
        weeks: module.weeks.length,
        lessons: lessons.length,
        // "module 3 of 4" is worth more in a post than the module code, and
        // both come from the schedule rather than being written down anywhere.
        index: i + 1,
        total: schedule.modules.length,
      })
    }
  })

  if (schedule.totalLessons > 0 && schedule.lessons.every((l) => completedSet.has(l.id))) {
    found.push({
      id: 'programme',
      kind: 'programme',
      code: null,
      title: 'Data Analytics',
      weeks: schedule.weeks?.length ?? 14,
      lessons: schedule.totalLessons,
      index: schedule.modules.length,
      total: schedule.modules.length,
    })
  }

  return found
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
export const CAMPAIGN_HASHTAG = '#IAmTheStory_ALX'

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
  const body = milestone.kind === 'programme' ? t.programmeDone(milestone) : t.moduleDone(milestone)
  return `${body}\n\n${CAMPAIGN_HASHTAG}`
}
