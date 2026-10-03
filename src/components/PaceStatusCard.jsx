import { AlarmClock, CircleCheckBig, Quote, Zap } from 'lucide-react'
import { quoteForDate } from '../lib/quotes'
import { useLang } from '../i18n/LanguageContext'

const VARIANTS = {
  behind: {
    Icon: AlarmClock,
    card: 'border-amber/40 bg-amber/10',
    chip: 'bg-amber text-navy-900',
    headline: (t, s) => t.statusBehind(s.behindCount),
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
    headline: (t, s) => t.statusAhead(s.aheadCount),
  },
}

/**
 * Glanceable "where you're at" message: behind / on-track / ahead, what's left
 * this week, and the deterministic quote of the day.
 */
export default function PaceStatusCard({ paceStatus, today = new Date() }) {
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
        <div className="min-w-0">
          <p className="text-sm font-bold leading-snug">{v.headline(t, paceStatus)}</p>
          <p className="mt-0.5 text-xs font-medium text-ink-soft dark:text-paper/75">
            {parts.join(' · ')}
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 border-t border-navy-900/10 pt-2.5 text-xs italic text-ink-soft dark:border-white/10 dark:text-paper/75">
        <Quote size={12} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>{quoteForDate(today, lang)}</span>
      </p>
    </section>
  )
}
