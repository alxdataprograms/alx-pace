import { useLayoutEffect, useRef, useState } from 'react'
import { CheckCheck, CheckCircle2, History } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

/**
 * "Already started?": a learner past the first week with nothing in the
 * program ticked is asked whether they have done the weeks before this one on
 * the ALX platform, and can tick them all with one tap.
 *
 * WHY
 * Learners who find Pace part-way through the course, often through a
 * classmate's LinkedIn post, did those weeks on ALX and have ticked nothing
 * here. Their first sight of the app was "Catch-up nudge: 108 items from
 * earlier weeks still open", and the only way to say otherwise was "Mark week
 * complete", one roadmap week at a time: about 12 taps down a page 7,400px
 * long, for Graphic Design's Week 9. Now "Yes, tick Weeks 1–8" does it, and
 * says so: "Marked 108 items done", with Undo, which unticks exactly those and
 * nothing ticked since (App's tickWeeksBefore and untickWeeksBefore). "Not
 * yet, show me what's open" puts the card away for the visit and goes to the
 * oldest open items, as the status card's "Catch up now" does. Nothing offers
 * to move the start date to today: the plan would stop matching the learner's
 * real ALX deadline.
 *
 * WHERE
 * Under the status card, not in its place. That card stays the first answer
 * to "am I OK?", and honest: amber until the learner says the weeks are done,
 * then "Right on pace" right above the confirmation. Read from the top, the
 * backlog comes first and this question about it second, and a screen reader
 * left on the status card's headline by a setup step (App's takeStep) reads
 * on into it. The checklist it changes follows directly below.
 *
 * WHEN
 * Offered on arrival only, while nothing in the program is ticked (`offered`),
 * so no storage key remembers an answer: once anything is ticked, the next
 * visit leaves the question out. A learner who ticks something else instead
 * keeps the card for the rest of the visit, as it was, so nothing moves under
 * the finger that ticked. App keys it by program and week, which decide
 * afresh.
 *
 * `from` and `to` are the weeks before this one ("Weeks 1–8"); `onYes` ticks
 * what is open in them and returns what to hand `onUndo`; `onNotYet` moves to
 * what is open once the card is gone.
 */
export default function AlreadyStartedCard({
  offered,
  week,
  from,
  to,
  programName,
  unit,
  onYes,
  onUndo,
  onNotYet,
}) {
  const { t } = useLang()
  const [shown] = useState(offered)
  // 'ask', then 'done' (with what was ticked, for Undo) or 'away' (Not yet).
  const [step, setStep] = useState({ name: 'ask' })
  const question = useRef(null)
  const confirmation = useRef(null)
  const after = useRef(null)

  /*
    The button pressed goes with the step it ends, so focus follows the
    learner instead of falling to the page body: Yes hands it to the
    confirmation, which a screen reader then reads, Undo back to the question,
    and Not yet, once the card is gone, to what is open (`onNotYet`). After the
    DOM changes, so a scroll measures the page without the card.
  */
  useLayoutEffect(() => {
    const next = after.current
    after.current = null
    if (next === 'away') onNotYet?.()
    else if (next) next.current?.focus()
  })

  if (!shown || step.name === 'away') return null

  const yes = () => {
    after.current = confirmation
    setStep({ name: 'done', marked: onYes() })
  }
  const undo = () => {
    onUndo(step.marked)
    after.current = question
    setStep({ name: 'ask' })
  }
  const notYet = () => {
    after.current = 'away'
    setStep({ name: 'away' })
  }
  const asking = step.name === 'ask'
  const count = step.marked?.ids.length ?? 0

  /*
    A fixed id, as the milestone dialogue's title has: one such card at a time.
    useId would be called by a card that renders nothing for every learner past
    Week 1, and React numbers ids in the order they are called, so the ids of
    the checklist below it would change for a learner who is never asked.
  */
  return (
    <section className="alx-card border-cobalt/25" aria-labelledby="already-started-title">
      <div className={`flex gap-2.5 ${asking ? 'items-start' : 'items-center'}`}>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
          <History size={18} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="already-started-title"
            className="text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime"
          >
            {t.alreadyStarted}
          </h2>
          {asking && (
            <p ref={question} tabIndex={-1} className="mt-0.5 text-sm font-semibold leading-snug">
              {t.alreadyStartedAsk(week, programName, from, to)}
            </p>
          )}
        </div>
      </div>

      {/*
        The app's pair of actions, as in the milestone dialogue: the answer
        that does something is the filled cobalt one. A label that runs to two
        lines (French at 320px) wraps inside its button, which grows.
      */}
      {asking ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={yes}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cobalt px-5 py-2 text-start text-sm font-semibold text-white transition-colors hover:bg-cobalt-600"
          >
            <CheckCheck size={16} strokeWidth={2.5} className="flex-none" aria-hidden="true" />
            {t.alreadyStartedYes(from, to)}
          </button>
          <button
            type="button"
            onClick={notYet}
            className="inline-flex min-h-[44px] items-center rounded-full border border-cobalt/40 px-5 py-2 text-start text-sm font-semibold text-cobalt-600 transition-colors hover:bg-cobalt/10 dark:border-lime/40 dark:text-lime dark:hover:bg-lime/10"
          >
            {t.alreadyStartedNotYet}
          </button>
        </div>
      ) : (
        /*
          The count and Undo, across the card like the answers they replace,
          so both fit on one line at 375px in every language: Undo goes without
          an icon, which ran the Arabic 11px over and put it on a line of its
          own. Weeks ticked by hand meanwhile can leave nothing for Yes to
          tick: then the card says the learner is all caught up, and has
          nothing to undo.
        */
        <div className="mt-2 flex flex-wrap items-center gap-x-3">
          <p
            ref={confirmation}
            tabIndex={-1}
            className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold"
          >
            <CheckCircle2
              size={18}
              className="flex-none text-alxgreen-700 dark:text-alxgreen"
              aria-hidden="true"
            />
            {count > 0 ? t.alreadyStartedDone(count, unit) : t.catchUpFirstDone}
          </p>
          {count > 0 && (
            <button
              type="button"
              onClick={undo}
              className="inline-flex min-h-[44px] items-center rounded-full border border-cobalt/40 px-4 text-xs font-semibold text-cobalt-600 transition-colors hover:bg-cobalt/10 dark:border-lime/40 dark:text-lime dark:hover:bg-lime/10"
            >
              {t.undo}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
