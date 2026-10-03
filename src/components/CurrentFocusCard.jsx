import { CheckCircle2, RefreshCcw, Target } from 'lucide-react'
import LessonRow from './LessonRow'
import { useLang } from '../i18n/LanguageContext'
import { useKeptInPlace, withKept } from '../hooks/useKeptInPlace'

// How many open items a catch-up week lists at once; ticking one pulls the
// next oldest in, so the card stays short however far behind a learner is.
// A ticked item stays in place (struck through) until the card remounts, so
// an accidental tick can be undone right where it happened.
const CATCH_UP_LIMIT = 6

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

  return (
    <section
      className="relative overflow-hidden rounded-2xl border-2 border-lime bg-white p-4 shadow-glow dark:bg-navy-900"
      aria-label={t.focusAria(week.weekLabel)}
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
        </>
      )}
    </section>
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

  return (
    <>
      {items.length === 0 ? (
        <div className="mb-3">
          <AllClear text={t.catchUpAllClear} />
        </div>
      ) : (
        <p className="mb-3 text-sm font-medium text-ink-soft dark:text-paper/75">
          {t.catchUpBody(items.length)}
        </p>
      )}
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
