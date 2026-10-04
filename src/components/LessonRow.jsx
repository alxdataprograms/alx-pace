import { useId, useRef } from 'react'
import { Check, HelpCircle, PencilRuler } from 'lucide-react'
import GradedBadge from './GradedBadge'
import { useLang } from '../i18n/LanguageContext'

/**
 * A single checkable curriculum item: the lesson, its (ungraded) Check Your
 * Understanding line, and any graded milestone attached to the row.
 * Lesson titles are the official ALX course names and stay untranslated.
 *
 * Creative Tech activities (hands-on practice rows) get a quiet neutral marker
 * so they read as something to DO rather than another lesson to watch. Neutral
 * on purpose: the coloured chips mean "graded", and an activity is not. Every
 * activity in the sheets is already titled "Activity: …", so the marker is an
 * icon beside the title rather than a chip repeating the word; a chip with the
 * word appears only for an activity whose title does not say so.
 */
const TITLED_AS_ACTIVITY = /^activity\b/i

/*
  Finished text: faded, so a done row reads as done at a glance, but never
  below AA. The title used to fade to ink/45, which measured 2.8:1 (4.1:1 for
  paper/45 in dark). ink-mute is 5.5–6:1 on every background a row sits on —
  white, the focus card's lime tint, the hover tint — and paper/60 is 6–6.4:1
  on navy: the muted pair the meta line already uses. The graded card's
  finished items share it, so "done" looks the same wherever it appears.
*/
export const DONE_TEXT = 'text-ink-mute dark:text-paper/60'

export default function LessonRow({ lesson, checked, onToggle, highlight = false, meta = '' }) {
  const { t } = useLang()
  const titleId = useId()
  // Whether this row's previous click toggled it as a single click: the way a
  // double or triple click that selects the row's text begins.
  const toggledByLastClick = useRef(false)
  const graded = lesson.graded
  const isActivity = lesson.kind === 'activity'

  /*
    A tap anywhere on the row ticks it, the way a tap on a native checkbox's
    label would. The 44px box alone was 4–9% of a row, at the edge a right
    thumb reaches least easily, and tapping the lesson's name did nothing.

    Pointer only, on purpose: the box stays the row's one control. Keyboard and
    screen-reader users keep exactly one tab stop and one name per lesson, and
    nothing interactive is nested inside anything else. That is also why the
    row listens with onClickCapture rather than onClick: React gives an element
    with an onClick an inline click handler of its own (an old Mobile Safari
    workaround), and Chromium exposes any element with one to assistive tech as
    clickable, a second control wrapped around the box. Capture handlers live on
    the app root, which carries that workaround already, so taps still arrive.
  */
  const tickFromRow = (event) => {
    const undoable = toggledByLastClick.current
    toggledByLastClick.current = false
    // A click on the box — or on any control a row might gain — is that
    // control's own: the box toggles the lesson itself.
    if (event.target.closest('a, button, input, label, select, textarea')) return
    // A click that ends a text selection in this row is a learner copying the
    // title (to look it up on the ALX platform), not ticking it: a drag across
    // it, or a double or triple click. The first click of those cannot be told
    // from a tap and has already toggled the lesson; the second takes it back.
    const row = event.currentTarget
    const selection = window.getSelection()
    if (
      selection &&
      !selection.isCollapsed &&
      (row.contains(selection.anchorNode) || row.contains(selection.focusNode))
    ) {
      if (event.detail > 1 && undoable) onToggle(lesson.id)
      return
    }
    // Focus stays where it was. Moving it to the box, as a native label does,
    // drew the keyboard focus ring around the box after every tap on a title:
    // Chromium shows the ring for focus that a script moves.
    onToggle(lesson.id)
    toggledByLastClick.current = event.detail === 1
  }

  return (
    <li
      onClickCapture={tickFromRow}
      className={`group flex cursor-pointer touch-manipulation gap-3 rounded-xl p-2.5 transition-colors ${
        highlight ? 'bg-lime/10 dark:bg-lime/5' : ''
      } hover:bg-navy-900/[0.04] dark:hover:bg-white/[0.05]`}
    >
      {/*
        Named by the lesson itself, so a screen reader says "<title>, checkbox,
        checked". The old "Mark … incomplete" label contradicted the state read
        straight after it, and changed with every tick.
      */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={titleId}
        onClick={() => onToggle(lesson.id)}
        className={`tap-target mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? 'border-cobalt bg-cobalt text-white'
            : 'border-ink/50 bg-transparent text-transparent hover:border-cobalt dark:border-white/40'
        }`}
      >
        <Check size={16} strokeWidth={3} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        {/*
          The line takes the direction of its own first word. "Catch up first"
          labels a row with its week in the learner's language, never the
          sheet's English, so in Arabic it runs right to left, its module code
          kept left to right by the caller.
        */}
        {meta && (
          <p
            dir="auto"
            className="text-start text-[11px] font-semibold uppercase tracking-wide text-ink-mute dark:text-paper/60"
          >
            {meta}
          </p>
        )}
        <p
          id={titleId}
          dir="ltr"
          className={`text-start text-sm font-semibold leading-snug transition-colors ${
            checked ? `${DONE_TEXT} line-through` : ''
          }`}
        >
          {isActivity && (
            <span
              className="me-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-navy-900/5 align-[-5px] text-ink-soft dark:bg-white/10 dark:text-paper/75"
              aria-hidden="true"
            >
              <PencilRuler size={12} strokeWidth={2.5} />
            </span>
          )}
          {lesson.title}
        </p>

        {/* A finished row fades as a whole; only its title is struck through. */}
        {lesson.checkYourUnderstanding && (
          <p
            dir="ltr"
            className={`mt-1 flex items-start gap-1.5 text-start text-xs transition-colors ${
              checked ? DONE_TEXT : 'text-ink-soft dark:text-paper/70'
            }`}
          >
            <HelpCircle size={13} className="mt-0.5 flex-none" aria-hidden="true" />
            <span className="min-w-0">{lesson.checkYourUnderstanding}</span>
          </p>
        )}

        {isActivity && !TITLED_AS_ACTIVITY.test(lesson.title) && (
          <div className="mt-1.5">
            <span className="alx-chip bg-navy-900/5 text-ink-soft dark:bg-white/10 dark:text-paper/75">
              <PencilRuler size={12} strokeWidth={2.5} aria-hidden="true" />
              {t.activityChip}
            </span>
          </div>
        )}

        {graded && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <GradedBadge type={lesson.gradedType} />
            {/* A graded-only row's title already IS the assessment name. */}
            {lesson.kind !== 'assessment' && (
              <span
                dir="ltr"
                className={`min-w-0 text-xs font-medium transition-colors ${
                  checked ? DONE_TEXT : 'text-ink-soft dark:text-paper/75'
                }`}
              >
                {graded.title}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
