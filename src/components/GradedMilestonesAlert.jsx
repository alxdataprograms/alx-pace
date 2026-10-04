import { useState } from 'react'
import { Award, CheckCircle2 } from 'lucide-react'
import GradedBadge from './GradedBadge'
import { DONE_TEXT } from './LessonRow'
import { useLang } from '../i18n/LanguageContext'

/**
 * Prominently surfaces any Evaluation Quizzes / Graded Tests / Integrated
 * Projects due during the current week.
 *
 * Prominent, not alarming. Every Data Analytics week has graded items, so this
 * card is routine; its header carries the generic graded badge's own icon
 * rather than the warning triangle it once had, which read like an error.
 *
 * Once every one of them is done, the card is one green line, as for a week
 * with none: "Both graded items for Week 4 are done." A learner who finished
 * early met about 300px of crossed-out titles here instead, every visit until
 * the week ended.
 *
 * Decided on arrival, like the checklist's "Show N done". Collapsing the
 * moment the last one was ticked would pull everything below up by 230px or
 * more — the roadmap, where this week sits open too — taking the row just
 * ticked there out from under the learner's finger. App keys the card by week,
 * so the next visit, or the next week, decides afresh. An item unticked in
 * the meantime brings the full card back for the rest of the visit: the line
 * never claims more than is true, and ticking the item again, to undo a
 * mis-tap, does not shrink the card a second time.
 */
export default function GradedMilestonesAlert({ week, completedSet }) {
  const { t } = useLang()
  const items = week?.gradedItems || []
  const allDone = items.length > 0 && items.every((l) => completedSet.has(l.id))
  const [oneLine, setOneLine] = useState(allDone)
  if (oneLine && !allDone) setOneLine(false)
  if (!week) return null

  if (items.length === 0) return <DoneLine text={t.milestonesNone} />
  if (oneLine && allDone) return <DoneLine text={t.milestonesAllDone(items.length, week.week)} />

  return (
    <section
      className="overflow-hidden rounded-2xl border-2 border-violet/30 bg-violet/5 p-4"
      aria-label={t.milestonesAria}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-violet text-white">
          <Award size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            {t.milestonesTitle}
          </h2>
          <p className="text-xs text-ink-soft dark:text-paper/70">
            {t.milestonesDue(items.length, week.weekLabel)}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((lesson) => {
          const done = completedSet.has(lesson.id)
          return (
            <li key={lesson.id} className="rounded-xl bg-white/80 p-2.5 dark:bg-navy-950/50">
              {/*
                The badge heads the item on a line of its own, with the done
                check at its far end, so the title under it gets the card's
                full width. Beside the badge, Data Analytics' Integrated
                Project titles were squeezed into a column about 120px wide:
                6–8 lines at 375px, up to 11 at 320px.
              */}
              <div className="flex items-center justify-between gap-2.5">
                <GradedBadge type={lesson.gradedType} />
                {done && (
                  <CheckCircle2
                    size={18}
                    className="flex-none text-alxgreen-700 dark:text-alxgreen"
                    aria-label={t.completed}
                  />
                )}
              </div>
              <p
                dir="ltr"
                className={`mt-1.5 text-start text-sm font-semibold leading-snug ${
                  done ? `${DONE_TEXT} line-through` : ''
                }`}
              >
                {lesson.graded?.title || lesson.title}
              </p>
              {lesson.graded?.subtitle && (
                <p
                  dir="ltr"
                  className={`mt-0.5 text-start text-xs ${
                    done ? DONE_TEXT : 'text-ink-soft dark:text-paper/70'
                  }`}
                >
                  {lesson.graded.subtitle}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The card as one calm green line: nothing graded this week, or nothing left. */
function DoneLine({ text }) {
  return (
    <section className="alx-card flex items-center gap-3 border-alxgreen/25 bg-alxgreen/5">
      <CheckCircle2
        size={20}
        className="flex-none text-alxgreen-700 dark:text-alxgreen"
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{text}</p>
    </section>
  )
}
