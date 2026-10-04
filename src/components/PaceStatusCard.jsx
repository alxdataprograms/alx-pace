import { AlarmClock, CircleCheckBig, Quote, Zap } from 'lucide-react'
import { quoteForDate } from '../lib/quotes'
import { useLang } from '../i18n/LanguageContext'

const VARIANTS = {
  behind: {
    Icon: AlarmClock,
    card: 'border-amber/40 bg-amber/10',
    chip: 'bg-amber text-navy-900',
    headline: (t, s) => t.statusBehind(s.behindCount, s.unit),
  },
  'on-track': {
    Icon: CircleCheckBig,
    card: 'border-cobalt/25 bg-tint dark:bg-white/5',
    chip: 'bg-cobalt text-white',
    headline: (t) => t.statusOnTrack,
  },
  ahead: {
    Icon: Zap,
    card: 'border-alxgreen/30 bg-alxgreen/10',
    chip: 'bg-alxgreen text-navy-900',
    headline: (t, s) => t.statusAhead(s.aheadCount, s.unit),
  },
}

/**
 * Glanceable "where you're at" message: behind / on-track / ahead, what's left
 * this week, overall progress in one line, and the deterministic quote of the
 * day.
 *
 * `progress` is the same { completed, total, percent } the progress card gets.
 * Passing that one object to both is what keeps the two from ever disagreeing.
 *
 * `headingRef` marks the headline, the card's answer to "am I OK?", as the
 * place App moves focus to when a start date set just now brings this card in
 * (see App's takeStep).
 */
export default function PaceStatusCard({ paceStatus, progress, today = new Date(), headingRef }) {
  const { t, lang } = useLang()
  if (!paceStatus) return null
  const v = VARIANTS[paceStatus.status]
  const { Icon } = v

  const parts = [
    t.weekOf(paceStatus.week, paceStatus.totalWeeks),
    paceStatus.isBuffer
      ? t.bufferStatus
      : t.doneThisWeek(paceStatus.weekDone, paceStatus.weekTotal),
  ]
  if (paceStatus.gradedLeft > 0) {
    parts.push(t.gradedStillDue(paceStatus.gradedLeft))
  }

  return (
    <section className={`rounded-2xl border-2 p-4 ${v.card}`} aria-label={t.pacingStatusAria}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${v.chip}`}>
          <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        {/* flex-1 so the progress line's bar can take the width the text leaves. */}
        <div className="min-w-0 flex-1">
          <p ref={headingRef} tabIndex={-1} className="text-sm font-bold leading-snug">
            {v.headline(t, paceStatus)}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink-soft dark:text-paper/75">
            {parts.join(' · ')}
          </p>
          {progress && <ProgressLine {...progress} />}
        </div>
      </div>

      {/*
        Upright, set apart by its rule and quote mark. It was italic, but no
        italic face is loaded, so browsers slanted the upright letters
        themselves, and a faked slant warps Arabic script.
      */}
      <p className="mt-3 flex items-start gap-1.5 border-t border-navy-900/10 pt-2.5 text-xs text-ink-soft dark:border-white/10 dark:text-paper/75">
        <Quote size={12} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>{quoteForDate(today, lang)}</span>
      </p>
    </section>
  )
}

/*
  "41% · 11 of 27" and a thin bar: the progress card's figures, kept on the
  first screen now that this week's checklist sits between this card and that
  one.

  Text, not a second progressbar. The progress card keeps the page's one
  progressbar. A second one with the same value would be listed twice when a
  screen-reader user moves from control to control, and reported twice on
  every tick (NVDA beeps for progress bars by default). Read aloud, the
  shorthand would not say what is 41% done, or 11 of 27 what, so a screen
  reader gets the full sentence in its place, and the shorthand and the bar
  are hidden from it.

  The fill is one solid colour, placed by its width alone, so it grows from the
  start edge: the right in Arabic. A left-to-right gradient, like the progress
  card's, would put its bright end on the wrong side there. If enlarged text
  leaves the bar no room, it wraps under the figures instead of shrinking away.
*/
function ProgressLine({ completed, total, percent }) {
  const { t } = useLang()
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-ink-soft dark:text-paper/75">
      <span className="sr-only">{t.statusProgressAria(percent, completed, total)}</span>
      <span className="tabular-nums" aria-hidden="true">
        {t.statusProgress(percent, completed, total)}
      </span>
      <span
        className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-navy-900/10 dark:bg-white/15"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full bg-cobalt dark:bg-lime"
          style={{ width: `${percent}%` }}
        />
      </span>
    </p>
  )
}
