import { useState } from 'react'
import { CalendarCheck, CalendarPlus, Rocket } from 'lucide-react'
import { plannedEndDate, toISODateString } from '../lib/pacing'
import { formatHumanDate } from '../lib/formatDate'
import { useLang } from '../i18n/LanguageContext'

/**
 * Onboarding fallback shown when no start date is set yet. Defensive guardrail:
 * the app is fully usable before any date exists, and nudges the learner to set
 * one to unlock pacing.
 *
 * `headingRef` lets App move focus to the heading when this card replaces the
 * program picker (see App's takeStep).
 */
export default function StartDatePrompt({ onSetStartDate, schedule, programName, headingRef }) {
  const { t, lang } = useLang()
  const today = toISODateString(new Date())
  const [value, setValue] = useState(today)
  const finish = plannedEndDate(value, schedule.totalDays)

  return (
    <section className="alx-card border-cobalt/25 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
        <Rocket size={28} strokeWidth={2.25} aria-hidden="true" />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold">
        {t.promptTitle}
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft dark:text-paper/75">{t.promptBody(programName, schedule.totalWeeks)}</p>

      <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2 sm:flex-row">
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-xl border border-ink/20 bg-white px-3 py-2.5 text-ink outline-none focus:border-cobalt dark:border-white/20 dark:bg-navy-950 dark:text-paper dark:focus:border-lime"
          aria-label={t.courseStartDate}
        />
        <button
          type="button"
          onClick={() => value && onSetStartDate(value)}
          disabled={!value}
          className="tap-target inline-flex items-center justify-center gap-2 rounded-xl bg-cobalt px-4 py-2.5 font-bold text-white transition-transform hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          <CalendarPlus size={18} aria-hidden="true" />
          {t.startPacing}
        </button>
      </div>

      {/* Auto-calculated end date, updates live as the date changes */}
      {finish && (
        <p className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-1.5 rounded-xl bg-cobalt/10 px-3 py-2 text-xs font-semibold text-cobalt-600 dark:bg-lime/15 dark:text-lime">
          <CalendarCheck size={14} className="flex-none" aria-hidden="true" />
          {t.promptFinishPreview(formatHumanDate(finish, lang))}
        </p>
      )}

      <button
        type="button"
        onClick={() => onSetStartDate(today)}
        className="mt-2 inline-flex min-h-[44px] items-center px-4 text-xs font-semibold text-cobalt-600 hover:underline dark:text-lime"
      >
        {t.startedToday}
      </button>
    </section>
  )
}
