import { useState } from 'react'
import { CalendarCheck, Gauge } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { formatHumanDate } from '../lib/formatDate'

/*
  The chip's tone is the verdict's, in the status card's colours: amber behind,
  cobalt on track, green ahead or finished. Each has its own dark pair. The
  amber one had none, so in dark mode "≈ 11 weeks behind plan" kept amber-700,
  made for white, and measured 2.6:1 on the navy card; bright amber on its own
  tint is about 6.5:1.
*/
const GREEN = 'bg-alxgreen/15 text-alxgreen-700 dark:bg-alxgreen/20 dark:text-alxgreen'
const TONE = {
  behind: 'bg-amber/15 text-amber-700 dark:bg-amber/20 dark:text-amber',
  'on-track': 'bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime',
  ahead: GREEN,
  finished: GREEN,
}

/**
 * Personal pace + finish forecast: how many lessons (or, in Creative Tech,
 * items) a week the learner averages, and where they stand against the plan,
 * read from their oldest open item (see computePaceStatus). Behind or ahead,
 * the card also gives the finish that puts them on: the planned end, moved by
 * the same gap.
 *
 * The verdict shows from the first visit; only the items-a-week figure waits
 * for a week's worth of ticks. A rate from one tick is noise (it once projected
 * a finish in 2032), but the verdict extrapolates nothing: it reads which items
 * are open, as the status card above does from day one, so holding it back
 * would only leave this card silent where that one already speaks.
 *
 * No "Target" row: the hero already says "Finish by …", and the card repeated
 * it. On track, the projected finish IS that date, so the chip names it once
 * ("On track for Dec 16, 2026") rather than a row and a chip both saying it.
 */
export default function ForecastCard({ paceStatus }) {
  const { t, lang } = useLang()
  // Behind or ahead by a week or more: the finish that puts the learner on.
  const showFinish =
    Boolean(paceStatus?.projectedFinish) &&
    (paceStatus.forecast === 'behind' || paceStatus.forecast === 'ahead') &&
    paceStatus.finishShiftDays !== 0
  /*
    Whether the projected finish has a place is decided on arrival, and kept
    for the visit: unseen and unread while the verdict has none to give. A
    learner behind who cleared the last overdue item in the roadmap below
    turned the verdict to "On track", and the row going pulled the roadmap up
    under that finger; one who unticked an earlier lesson there brought the row
    in, and pushed it down. App keys the card by week, so the next week, or
    the next visit, decides afresh.
  */
  const [finishShown] = useState(showFinish)
  if (!paceStatus) return null

  const {
    completedCount,
    pacePerWeek,
    paceNeeds,
    unit,
    plannedEnd,
    forecast,
    forecastWeeks,
    oldestOpenWeek,
    projectedFinish,
  } = paceStatus

  /*
    French and Arabic run the chip to two lines on a phone (English at 320px).
    Behind, its two parts are boxes of their own, so the line breaks between
    them, never inside "oldest open: Week 3", and the dot stays with the first.
    On track, the date is held together: Arabic had left "16" at the end of
    one line and "ديسمبر 2026" on the next.
  */
  const verdict =
    forecast === 'behind' ? (
      <>
        <span className="inline-block">{t.forecastBehind(forecastWeeks)}</span>
        {'\u00a0· '}
        <span className="inline-block">{t.forecastOldestOpen(oldestOpenWeek)}</span>
      </>
    ) : forecast === 'ahead' ? (
      forecastWeeks > 0 ? t.forecastAhead(forecastWeeks) : t.forecastAheadSome
    ) : forecast === 'finished' ? (
      t.forecastFinished
    ) : (
      t.forecastOnTrack(formatHumanDate(plannedEnd, lang).replace(/ /g, '\u00a0'))
    )

  return (
    <section className="alx-card" aria-label={t.yourPace}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
          <Gauge size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide">{t.yourPace}</h2>
      </div>

      {paceNeeds === 0 ? (
        <p className="mt-3 text-2xl font-bold text-ink dark:text-paper">
          {t.paceValue(pacePerWeek, unit)}
        </p>
      ) : (
        <p className="mt-3 text-sm text-ink-soft dark:text-paper/75">
          {completedCount > 0
            ? t.noPaceYetMore(paceNeeds, unit)
            : paceNeeds > 1
              ? t.noPaceYetCount(paceNeeds, unit)
              : t.noPaceYet(unit)}
        </p>
      )}

      {finishShown && (
        <dl
          className={`mt-3 text-sm ${showFinish ? '' : 'invisible'}`}
          aria-hidden={showFinish ? undefined : 'true'}
        >
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-ink-soft dark:text-paper/75">
              <CalendarCheck size={15} className="flex-none" aria-hidden="true" />
              {t.projectedFinishLabel}
            </dt>
            <dd className="font-semibold">
              {formatHumanDate(showFinish ? projectedFinish : plannedEnd, lang)}
            </dd>
          </div>
        </dl>
      )}

      {/* One line, it is the pill it always was; two, a rounded box (see verdict). */}
      <p className={`mt-3 w-fit rounded-xl px-3 py-1 text-xs font-bold ${TONE[forecast]}`}>
        {verdict}
      </p>
    </section>
  )
}
