import { CalendarClock, Sparkles } from 'lucide-react'
import { sloganForWeek } from '../lib/slogans'
import { useLang } from '../i18n/LanguageContext'

/**
 * Shown when the learner's start date is in the future.
 *
 * It names no finish date: the hero above shows "Finish by …" on this screen,
 * and a second, identical chip here only repeated it.
 *
 * `headingRef` lets App move focus to the heading when a start date set just
 * now brings this card in (see App's takeStep).
 */
export default function CountdownState({
  pacing,
  firstWeek,
  schedule,
  program,
  programName,
  headingRef,
}) {
  const { t, lang } = useLang()
  const days = pacing.daysUntilStart
  return (
    <section className="alx-card border-cobalt/25 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
        <CalendarClock size={28} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
        {t.getReady}
      </p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold">
        {t.beginsIn}{' '}
        <span className="text-cobalt-600 dark:text-lime">{t.beginsInDays(days)}</span>
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft dark:text-paper/75">
        {t.countdownBody(sloganForWeek(1, lang, program), programName, schedule.totalWeeks)}
      </p>

      {firstWeek && (
        <div className="mt-4 rounded-xl bg-tint p-3 text-start dark:bg-white/5">
          {/* The week in the learner's language: the sheet's own label is English, "Week 1". */}
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft dark:text-paper/75">
            <Sparkles size={13} aria-hidden="true" /> {t.firstUp(t.weekLabel(firstWeek))}
          </p>
          <p dir="ltr" className="mt-1 text-start text-sm font-semibold">
            {firstWeek.moduleCode}: {firstWeek.moduleTitle}
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-ink-soft dark:text-paper/75">
            {firstWeek.lessons.slice(0, 3).map((l) => (
              <li key={l.id} className="flex gap-2">
                <span className="text-cobalt-600 dark:text-lime" aria-hidden="true">
                  •
                </span>
                <span dir="ltr" className="min-w-0 text-start">
                  {l.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
