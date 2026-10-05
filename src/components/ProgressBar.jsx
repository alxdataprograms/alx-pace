import { TrendingUp } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/**
 * Overall curriculum progress. Shows % complete and the raw count, with an
 * accessible progressbar role for screen readers.
 *
 * `currentModule` (Creative Tech, in an active week; see moduleProgress) adds
 * a caption under the bar: "Module 3 of 10 · Poster Design & Visual
 * Composition", and how much of it is done, "0/31". Graphic Design's bar moves
 * about 3% a week over 32 weeks, and "module 3 of 10", the unit the app
 * celebrates, appeared only in the dialogue at a module's end, so a learner
 * had no near goal in sight. The module's title is the sheet's own, in English
 * in every language. Data Analytics passes none, and its card is as it was.
 */
export default function ProgressBar({ completed, total, percent, currentModule }) {
  const { t } = useLang()
  return (
    <section className="alx-card" aria-label={t.overallProgress}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
            <TrendingUp size={18} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">{t.progressTitle}</h2>
            <p className="text-xs text-ink-soft dark:text-paper/70">
              {t.itemsComplete(completed, total)}
            </p>
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums text-cobalt-600 dark:text-lime">
          {percent}%
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-navy-900/10 dark:bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t.progressAria(percent)}
      >
        {/*
          The fill grows from the start edge, the right in Arabic, so its
          gradient turns round there too. Left to right in both, Arabic's
          bright lime end sat at the right, where the bar begins, and the
          edge that moves as a learner progresses was the dark one.
        */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-cobalt to-lime transition-[width] duration-500 ease-out rtl:bg-gradient-to-l"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/*
        The count sits at the end of the first line, under the percentage it
        details, so a title that wraps never strands it, or a "·", on a line
        of its own.
      */}
      {currentModule && (
        <p className="mt-2.5 flex items-baseline justify-between gap-3 text-xs text-ink-soft dark:text-paper/70">
          <span className="min-w-0">
            <span className="font-semibold text-ink dark:text-paper">
              {t.moduleOf(currentModule.index, currentModule.total)}
            </span>
            {'\u00a0'}· <span dir="ltr">{currentModule.title}</span>
          </span>
          <span className="flex-none font-semibold tabular-nums text-ink dark:text-paper">
            {currentModule.done}/{currentModule.items}
          </span>
        </p>
      )}
    </section>
  )
}
