import { useId, useState } from 'react'
import { CheckCircle2, ChevronDown, RefreshCcw, Target } from 'lucide-react'
import LessonRow from './LessonRow'
import { useLang } from '../i18n/LanguageContext'
import { useKeptInPlace, withKept } from '../hooks/useKeptInPlace'

// How many open items a catch-up week lists at once; ticking one pulls the
// next oldest in, so the card stays short however far behind a learner is.
// A ticked item stays in place (struck through) until the card remounts, so
// an accidental tick can be undone right where it happened.
const CATCH_UP_LIMIT = 6

// A focus week longer than this tucks its already-done items behind a toggle,
// so the next open item is near the top instead of under a screen of ticks.
// Creative Tech weeks run to 31 items; Data Analytics never exceeds 5, so DA
// learners always see the full list exactly as before.
const LONG_WEEK = 8

/**
 * "This Week's Focus" — the exact Module, Week and lessons the learner should
 * be working on right now, with inline checkboxes.
 *
 * Buffer weeks (Creative Tech) have no new content, so the card turns into a
 * catch-up list: the oldest still-open items from earlier weeks.
 */
export default function CurrentFocusCard({ week, completedSet, onToggle, catchUp = [] }) {
  const { t } = useLang()
  if (!week) return null

  const isCatchUp = week.isBuffer && week.lessons.length === 0
  const done = week.lessons.filter((l) => completedSet.has(l.id)).length
  const total = week.lessons.length
  const Icon = isCatchUp ? RefreshCcw : Target
  // The region's name gives the week in the learner's language. The sheet's
  // own label is English ("Week 4"), and a French screen reader read
  // "Objectif de la semaine : Week 4".
  const weekName = t.weekRange(week.week, week.week)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border-2 border-lime bg-white p-4 shadow-glow dark:bg-navy-900"
      aria-label={t.focusAria(weekName)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-lime text-navy-900">
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
              {isCatchUp ? t.catchUpEyebrow : t.focusEyebrow}
            </p>
            <h2 className="truncate text-base font-bold leading-tight">
              <span dir="ltr">
                {week.weekLabel} · {week.moduleCode}
              </span>
            </h2>
          </div>
        </div>
        {!isCatchUp && (
          <span className="flex-none rounded-full bg-navy-900/5 px-2.5 py-1 text-xs font-bold tabular-nums dark:bg-white/10">
            {done}/{total}
          </span>
        )}
      </div>

      {isCatchUp ? (
        // Keyed per week (module codes are unique across programs), so the rows
        // kept in place reset when the week or the program changes.
        <CatchUpList
          key={`${week.moduleCode}-${week.week}`}
          items={catchUp}
          completedSet={completedSet}
          onToggle={onToggle}
        />
      ) : (
        <>
          <p dir="ltr" className="mb-3 text-start text-sm font-medium text-ink-soft dark:text-paper/75">
            {week.moduleTitle}
          </p>

          {total > LONG_WEEK ? (
            <LongWeekList
              key={`${week.moduleCode}-${week.week}`}
              lessons={week.lessons}
              completedSet={completedSet}
              onToggle={onToggle}
            />
          ) : (
            <ul className="-mx-1 space-y-0.5">
              {week.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  checked={completedSet.has(lesson.id)}
                  onToggle={onToggle}
                  highlight
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/**
 * A long week: open items first-class, finished ones folded away.
 *
 * Items already done when the learner arrived sit behind "Show N done"; the
 * list keeps curriculum order either way, so expanding it restores the week
 * exactly as the sheet lays it out. Anything ticked during this visit — here,
 * or in the roadmap below — stays where it is: folding it away on tick would
 * make a mis-tap impossible to undo here and pull focus out from under the
 * learner (see useKeptInPlace).
 *
 * The "week done" note sits BELOW the list in a polite live region: above it,
 * it pushed the rows down the moment the last one was ticked, moving the
 * control just used, and appearing silently it said nothing to a screen reader.
 */
function LongWeekList({ lessons, completedSet, onToggle }) {
  const { t } = useLang()
  const [kept, keep] = useKeptInPlace(onToggle)
  const [showDone, setShowDone] = useState(false)
  const [doneOnArrival] = useState(
    () => new Set(lessons.filter((l) => completedSet.has(l.id)).map((l) => l.id)),
  )
  const listId = useId()

  const folded = lessons.filter(
    (l) => doneOnArrival.has(l.id) && completedSet.has(l.id) && !kept.has(l.id),
  )
  const shown = showDone ? lessons : lessons.filter((l) => !folded.includes(l))
  const allDone = lessons.every((l) => completedSet.has(l.id))

  return (
    <>
      {folded.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          aria-expanded={showDone}
          aria-controls={listId}
          className="mb-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 text-start text-xs font-semibold text-cobalt-600 hover:bg-navy-900/[0.04] dark:text-lime dark:hover:bg-white/[0.05]"
        >
          <CheckCircle2 size={16} className="flex-none" aria-hidden="true" />
          <span className="flex-1">{showDone ? t.hideDone : t.showDone(folded.length)}</span>
          <ChevronDown
            size={16}
            className={`flex-none transition-transform motion-reduce:transition-none ${
              showDone ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}

      <ul id={listId} className="-mx-1 space-y-0.5">
        {shown.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            checked={completedSet.has(lesson.id)}
            onToggle={() => keep(lesson)}
            highlight
          />
        ))}
      </ul>

      {/* Always in the DOM, so the note is announced when it appears. */}
      <div role="status" aria-live="polite" className={allDone ? 'mt-2' : ''}>
        {allDone && <AllClear text={t.weekAllDone} />}
      </div>
    </>
  )
}

function CatchUpList({ items, completedSet, onToggle }) {
  const { t } = useLang()
  const [kept, keep] = useKeptInPlace(onToggle)

  // The oldest open items, plus anything ticked here this visit — still shown,
  // struck through, so it can be unticked from the same spot.
  const shown = withKept(items.slice(0, CATCH_UP_LIMIT), kept)
  const more = items.length - Math.min(items.length, CATCH_UP_LIMIT)

  if (shown.length === 0) return <AllClear text={t.catchUpAllClear} />

  /*
    Ticking the last open item swaps the intro for the all-clear in the SAME
    paragraph, so the rows under the learner's finger do not move. A visually
    hidden live region announces it; the visible copy is hidden from assistive
    tech meanwhile, so it is not read twice.
  */
  const cleared = items.length === 0

  return (
    <>
      <p
        className="mb-3 text-sm font-medium text-ink-soft dark:text-paper/75"
        aria-hidden={cleared || undefined}
      >
        {cleared ? t.catchUpAllClear : t.catchUpBody(items.length)}
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {cleared ? t.catchUpAllClear : ''}
      </p>
      <ul className="-mx-1 space-y-0.5">
        {shown.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            checked={completedSet.has(lesson.id)}
            onToggle={() => keep(lesson)}
            meta={`${lesson.weekLabel} · ${lesson.moduleCode}`}
            highlight
          />
        ))}
      </ul>
      {more > 0 && (
        <p className="mt-2 px-1 text-xs font-semibold text-cobalt-600 dark:text-lime">
          {t.catchUpMore(more)}
        </p>
      )}
    </>
  )
}

function AllClear({ text }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-alxgreen/10 p-3 text-sm font-medium">
      <CheckCircle2
        size={18}
        className="mt-0.5 flex-none text-alxgreen-700 dark:text-alxgreen"
        aria-hidden="true"
      />
      <span>{text}</span>
    </p>
  )
}
