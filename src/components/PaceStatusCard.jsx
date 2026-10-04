import { useState } from 'react'
import {
  AlarmClock,
  ArrowDown,
  CheckCircle2,
  CircleCheckBig,
  Quote,
  RefreshCcw,
  Zap,
} from 'lucide-react'
import SteadyText, { widestCounts } from './SteadyText'
import { quoteForDate } from '../lib/quotes'
import { perDayToClear } from '../lib/paceStatus'
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
  /*
    A Creative Tech catch-up week. The curriculum sets the week aside for the
    items still open, so they are the week's plan, not an alarm: the amber
    alarm clock had greeted a learner with "Catch-up nudge: 14 items…" in the
    one week built for catching up. The focus card's catch-up icon on its lime
    chip, on the calm card of "Right on pace"; the lime border stays the
    checklist's alone. The headline is CatchUpWeekHeadline's.
  */
  'catch-up': {
    Icon: RefreshCcw,
    card: 'border-cobalt/25 bg-tint dark:bg-white/5',
    chip: 'bg-lime text-navy-900',
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
 *
 * `onCatchUp` takes a learner who is behind to the "Catch up first" section
 * that opens the checklist below. A catch-up week has no such section: its
 * whole card is that list already, so this card plans the week instead.
 *
 * In the first week, until anything in the program is ticked, the headline
 * says how Pace works (see FirstWeekHeadline).
 */
export default function PaceStatusCard({
  paceStatus,
  progress,
  today = new Date(),
  headingRef,
  onCatchUp,
}) {
  const { t, lang } = useLang()
  const offerCatchUp =
    Boolean(onCatchUp) && paceStatus?.status === 'behind' && !paceStatus.isBuffer
  // What a catch-up week had open on arrival: the longest its headline gets
  // this visit (see CatchUpWeekHeadline). App keys the card by week.
  const [openOnArrival] = useState(paceStatus?.behindCount ?? 0)
  // Nothing ticked in the program, and nothing overdue: the first week, as
  // every later week has earlier items to be overdue. Decided on arrival, as
  // the catch-up row is: the how-to is for someone who has not started, so a
  // learner who unticks their only tick keeps "Right on pace".
  const firstSteps = paceStatus?.status === 'on-track' && paceStatus.completedCount === 0
  const [firstStepsOnArrival] = useState(firstSteps)

  /*
    Once offered, the button's row stays for the rest of the visit. Ticking the
    last overdue item turns this card to "Right on pace"; had the button gone
    with it, the card would have shrunk by the row's 52px and pulled the
    checklist below up with it, taking the row just ticked out from under the
    learner's finger. So the row says "All caught up" instead, until the card is
    mounted afresh: the next visit, or another week or program (App keys it).
  */
  const [offeredCatchUp, setOfferedCatchUp] = useState(offerCatchUp)
  if (offerCatchUp && !offeredCatchUp) setOfferedCatchUp(true)

  if (!paceStatus) return null
  const v = VARIANTS[paceStatus.isBuffer ? 'catch-up' : paceStatus.status]
  const { Icon } = v

  // A catch-up week's headline says so already, and the week has nothing of
  // its own to count done.
  const parts = [t.weekOf(paceStatus.week, paceStatus.totalWeeks)]
  if (!paceStatus.isBuffer) {
    parts.push(t.doneThisWeek(paceStatus.weekDone, paceStatus.weekTotal))
  }
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
            {paceStatus.isBuffer ? (
              <CatchUpWeekHeadline
                open={paceStatus.behindCount}
                openOnArrival={openOnArrival}
                daysLeft={paceStatus.daysLeft}
              />
            ) : firstStepsOnArrival ? (
              <FirstWeekHeadline paceStatus={paceStatus} howTo={firstSteps}>
                {v.headline(t, paceStatus)}
              </FirstWeekHeadline>
            ) : (
              v.headline(t, paceStatus)
            )}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink-soft dark:text-paper/75">
            {parts.join(' · ')}
          </p>
          {progress && <ProgressLine {...progress} />}
          {/*
            The nudge said what was open but offered nowhere to act on it.
            One tap now reaches the oldest open items: a 44px button in the
            app's in-card action style, below the card's figures.
          */}
          {offerCatchUp ? (
            <button
              type="button"
              onClick={onCatchUp}
              className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-cobalt/40 px-4 text-xs font-semibold text-cobalt-600 transition-colors hover:bg-cobalt/10 dark:border-lime/40 dark:text-lime dark:hover:bg-lime/10"
            >
              {t.catchUpNow}
              <ArrowDown size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : offeredCatchUp ? (
            <p className="mt-2 flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-alxgreen-700 dark:text-alxgreen">
              <CheckCircle2 size={14} strokeWidth={2.5} className="flex-none" aria-hidden="true" />
              {t.caughtUp}
            </p>
          ) : null}
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
  A catch-up week's headline: "Catch-up week: 14 items to clear · 5 days left
  (about 3 a day)", the open items as a plan for the days the week has left,
  today included. "Catch-up week: you're all caught up." once nothing is open,
  ahead or not: in this week, being clear is the news.

  It changes with every tick in the catch-up list below, so it holds the size
  of the longest wording it can come to (SteadyText) and the list never moves
  under the learner's finger: the count on arrival, or one or two in Arabic,
  which writes them out ("عنصر واحد"), or the all-clear.
*/
function CatchUpWeekHeadline({ open, openOnArrival, daysLeft }) {
  const { t } = useLang()
  const say = (n) =>
    n > 0 ? t.statusCatchUpWeek(n, daysLeft, perDayToClear(n, daysLeft)) : t.statusCatchUpWeekClear
  return <SteadyText texts={widestCounts(openOnArrival).map(say)}>{say(open)}</SteadyText>
}

/*
  The first week's headline, until anything in the program is ticked: "Week 1
  is under way. Study each lesson on ALX, then tick it off here." Nothing on
  the page had said that lessons are taken on ALX and ticked here, and "Right
  on pace — keep the streak alive." spoke of a streak to someone with nothing
  done. "Under way" holds on any day of the week, the start date included.

  The first tick brings "Right on pace" (`children`, the card's own headline
  by then) into the how-to's place, which holds its size for the rest of the
  visit (SteadyText). A line shorter in French, and at 320px in every
  language, it would otherwise pull the checklist up under the finger that
  just ticked. The next visit has a tick to its name, and the card as it
  always was.
*/
function FirstWeekHeadline({ paceStatus, howTo, children }) {
  const { t } = useLang()
  const text = t.statusFirstWeek(paceStatus.week, paceStatus.unit)
  return <SteadyText texts={[text, t.statusOnTrack]}>{howTo ? text : children}</SteadyText>
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
