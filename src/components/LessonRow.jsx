import { Check, HelpCircle } from 'lucide-react'
import GradedBadge from './GradedBadge'
import { useLang } from '../i18n/LanguageContext'

/**
 * A single checkable curriculum item: the lesson, its (ungraded) Check Your
 * Understanding line, and any graded milestone attached to the row.
 * Lesson titles are the official ALX course names and stay untranslated.
 */
export default function LessonRow({ lesson, checked, onToggle, highlight = false, meta = '' }) {
  const { t } = useLang()
  const graded = lesson.graded

  return (
    <li
      className={`group flex gap-3 rounded-xl p-2.5 transition-colors ${
        highlight ? 'bg-lime/10 dark:bg-lime/5' : ''
      } hover:bg-navy-900/[0.04] dark:hover:bg-white/[0.05]`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onToggle(lesson.id)}
        className={`tap-target mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md border-2 transition-all ${
          checked
            ? 'border-cobalt bg-cobalt text-white'
            : 'border-ink/50 bg-transparent text-transparent hover:border-cobalt dark:border-white/40'
        }`}
        aria-label={checked ? t.markIncomplete(lesson.title) : t.markComplete(lesson.title)}
      >
        <Check size={16} strokeWidth={3} aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        {meta && (
          <p
            dir="ltr"
            className="text-start text-[11px] font-semibold uppercase tracking-wide text-ink-mute dark:text-paper/60"
          >
            {meta}
          </p>
        )}
        <p
          dir="ltr"
          className={`text-start text-sm font-semibold leading-snug transition-colors ${
            checked ? 'text-ink/45 line-through dark:text-paper/45' : ''
          }`}
        >
          {lesson.title}
        </p>

        {lesson.checkYourUnderstanding && (
          <p
            dir="ltr"
            className="mt-1 flex items-start gap-1.5 text-start text-xs text-ink-soft dark:text-paper/70"
          >
            <HelpCircle size={13} className="mt-0.5 flex-none" aria-hidden="true" />
            <span className="min-w-0">{lesson.checkYourUnderstanding}</span>
          </p>
        )}

        {graded && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <GradedBadge type={lesson.gradedType} />
            {/* A graded-only row's title already IS the assessment name. */}
            {lesson.kind !== 'assessment' && (
              <span dir="ltr" className="min-w-0 text-xs font-medium text-ink-soft dark:text-paper/75">
                {graded.title}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
