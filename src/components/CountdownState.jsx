import { CalendarCheck, CalendarClock, Sparkles } from 'lucide-react'
import { sloganForWeek } from '../lib/slogans'
import { plannedEndDate } from '../lib/pacing'
import { formatHumanDate } from '../lib/formatDate'
import { useLang } from '../i18n/LanguageContext'

/** Shown when the learner's start date is in the future. */
export default function CountdownState({ pacing, firstWeek, schedule, programName }) {
  const { t, lang } = useLang()
  const days = pacing.daysUntilStart
  const finish = plannedEndDate(pacing.startDate, schedule.totalDays)
  return (
    <section className="alx-card border-cobalt/25 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
        <CalendarClock size={28} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
        {t.getReady}
      </p>
      <h2 className="mt-1 text-2xl font-bold">
        {t.beginsIn}{' '}
        <span className="text-cobalt-600 dark:text-lime">{t.beginsInDays(days)}</span>
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft dark:text-paper/75">
        {t.countdownBody(sloganForWeek(1, lang), programName, schedule.totalWeeks)}
      </p>

      {finish && (
        <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-xl bg-cobalt/10 px-3 py-1.5 text-xs font-semibold text-cobalt-600 dark:bg-lime/15 dark:text-lime">
          <CalendarCheck size={14} className="flex-none" aria-hidden="true" />
          {t.targetFinish(formatHumanDate(finish, lang))}
        </div>
      )}

      {firstWeek && (
        <div className="mt-4 rounded-xl bg-tint p-3 text-start dark:bg-white/5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft dark:text-paper/75">
            <Sparkles size={13} aria-hidden="true" /> {t.firstUp(firstWeek.weekLabel)}
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
