import { CalendarCheck, Flag, Gauge } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { formatHumanDate } from '../lib/formatDate'

/**
 * Personal pace + finish forecast: how many lessons (or, in Creative Tech,
 * items) a week the learner is averaging, and — projected from that pace — the
 * date they'll actually finish versus the planned target.
 */
export default function ForecastCard({ paceStatus }) {
  const { t, lang } = useLang()
  if (!paceStatus) return null

  const {
    completedCount,
    pacePerWeek,
    projectedFinish,
    plannedEnd,
    finishDeltaDays,
    forecastNeeds,
    unit,
  } = paceStatus
  // computePaceStatus withholds the projection until there is a week's worth
  // of signal; until then the empty state counts down to it.
  const hasData = Boolean(projectedFinish)

  // Each tone has its own dark pair. The amber one had none, so in dark mode
  // "≈ 11 weeks behind plan" kept amber-700, made for white, and measured
  // 2.6:1 on the navy card; bright amber on its own tint is about 6.5:1.
  const deltaTone =
    finishDeltaDays == null || Math.abs(finishDeltaDays) <= 2
      ? 'bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime'
      : finishDeltaDays > 0
        ? 'bg-alxgreen/15 text-alxgreen-700 dark:bg-alxgreen/20 dark:text-alxgreen'
        : 'bg-amber/15 text-amber-700 dark:bg-amber/20 dark:text-amber'

  return (
    <section className="alx-card" aria-label={t.yourPace}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
          <Gauge size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide">{t.yourPace}</h2>
      </div>

      {hasData ? (
        <>
          <p className="mt-3 text-2xl font-bold text-ink dark:text-paper">
            {t.paceValue(pacePerWeek, unit)}
          </p>

          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-ink-soft dark:text-paper/75">
                <CalendarCheck size={15} className="flex-none" aria-hidden="true" />
                {t.projectedFinishLabel}
              </dt>
              <dd className="font-semibold">{formatHumanDate(projectedFinish, lang)}</dd>
            </div>
            {plannedEnd && (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-ink-soft dark:text-paper/75">
                  <Flag size={15} className="flex-none" aria-hidden="true" />
                  {t.targetLabel}
                </dt>
                <dd className="font-semibold">{formatHumanDate(plannedEnd, lang)}</dd>
              </div>
            )}
          </dl>

          {finishDeltaDays != null && (
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${deltaTone}`}>
              {t.finishDelta(finishDeltaDays)}
            </p>
          )}
        </>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-soft dark:text-paper/75">
            {completedCount > 0
              ? t.noPaceYetMore(forecastNeeds, unit)
              : forecastNeeds > 1
                ? t.noPaceYetCount(forecastNeeds, unit)
                : t.noPaceYet(unit)}
          </p>
          {plannedEnd && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-cobalt/10 px-2.5 py-1 text-xs font-semibold text-cobalt-600 dark:bg-lime/15 dark:text-lime">
              <Flag size={13} aria-hidden="true" />
              {t.targetFinish(formatHumanDate(plannedEnd, lang))}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
