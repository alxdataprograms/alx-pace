import { useState } from 'react'
import { CheckCircle2, ChevronDown, CircleDot, ListChecks, Share2 } from 'lucide-react'
import LessonRow from './LessonRow'
import { useLang } from '../i18n/LanguageContext'

/**
 * Full curriculum browser: every module → week → lesson, collapsible, with the
 * learner's current week expanded and flagged by default.
 */
export default function WeekAccordion({
  schedule,
  completedSet,
  currentWeek,
  onToggle,
  onSetWeek,
  achieved = [],
  onShare,
}) {
  /*
    A milestone stays shareable for good.

    The celebration dialogue is a moment and is deliberately shown once — a box
    that reappears until you post would be a dark pattern. But "once" was also
    the ONLY way to reach the post, so a learner who dismissed it, or who simply
    was not ready to publish that day, had no way back to it. Reported from real
    use: the dialogue does not return for a milestone already crossed.

    So the roadmap carries a permanent route to the same post. The moment is
    still a moment; it is just no longer the only door.
  */
  const shareable = new Map(achieved.map((m) => [m.code ?? 'programme', m]))
  const programme = shareable.get('programme')
  const { t } = useLang()
  const [openWeeks, setOpenWeeks] = useState(() => new Set([currentWeek]))

  const toggleWeek = (weekNumber) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(weekNumber)) next.delete(weekNumber)
      else next.add(weekNumber)
      return next
    })
  }

  return (
    <section aria-label={t.fullCurriculumAria} className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <ListChecks size={18} className="text-cobalt-600 dark:text-lime" aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-wide">{t.roadmapTitle}</h2>
      </div>

      {programme && onShare ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-alxgreen/40 bg-alxgreen/10 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-alxgreen-700 dark:text-alxgreen">
            {t.roadmapProgrammeDone}
          </span>
          <ShareButton
            milestone={programme}
            label={t.roadmapShare}
            aria={t.roadmapShareAria(programme.title)}
            onShare={onShare}
          />
        </div>
      ) : null}

      {schedule.modules.map((module) => (
        <div key={module.code} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-1">
            <h3 className="text-sm font-bold">
              <span className="text-cobalt-600 dark:text-lime">{module.code}</span>{' '}
              <span dir="ltr" className="text-ink dark:text-paper">
                {module.title}
              </span>
            </h3>
            <span className="flex-none text-xs font-medium text-ink-mute dark:text-paper/65">
              {t.weekRange(module.weekStart, module.weekEnd)}
            </span>
          </div>

          {shareable.has(module.code) && onShare ? (
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-alxgreen-700 dark:text-alxgreen">
                {t.roadmapModuleDone}
              </span>
              <ShareButton
                milestone={shareable.get(module.code)}
                label={t.roadmapShare}
                aria={t.roadmapShareAria(module.title)}
                onShare={onShare}
              />
            </div>
          ) : null}

          {module.weeks.map((week) => {
            const isOpen = openWeeks.has(week.week)
            const isCurrent = week.week === currentWeek
            const done = week.lessons.filter((l) => completedSet.has(l.id)).length
            const total = week.lessons.length
            const allDone = total > 0 && done === total
            const panelId = `week-panel-${week.week}`

            return (
              <div
                key={week.week}
                className={`alx-card overflow-hidden !p-0 ${isCurrent ? 'ring-2 ring-lime' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => toggleWeek(week.week)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-center gap-3 p-3.5 text-start"
                >
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs font-bold ${
                      allDone
                        ? 'bg-alxgreen text-navy-900'
                        : isCurrent
                          ? 'bg-lime text-navy-900'
                          : 'bg-navy-900/5 text-ink-soft dark:bg-white/10 dark:text-paper/75'
                    }`}
                  >
                    {allDone ? <CheckCircle2 size={18} aria-hidden="true" /> : week.week}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{t.weekRange(week.week, week.week)}</p>
                      {isCurrent && (
                        <span className="alx-chip flex-none bg-lime-300 text-navy-900">
                          <CircleDot size={11} aria-hidden="true" /> {t.current}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-ink-soft dark:text-paper/70">
                      {t.doneCount(done, total)}
                      {week.gradedItems.length > 0 && ` · ${t.gradedCount(week.gradedItems.length)}`}
                    </p>
                  </div>

                  <ChevronDown
                    size={18}
                    className={`flex-none text-ink-mute transition-transform dark:text-paper/60 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div id={panelId} className="border-t border-navy-900/10 px-2 py-2 dark:border-white/10">
                    <ul className="space-y-0.5">
                      {week.lessons.map((lesson) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          checked={completedSet.has(lesson.id)}
                          onToggle={onToggle}
                        />
                      ))}
                    </ul>
                    <div className="flex justify-end px-2 pb-1 pt-1">
                      <button
                        type="button"
                        onClick={() => onSetWeek(week.lessons.map((l) => l.id), !allDone)}
                        className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-semibold text-cobalt-600 hover:bg-cobalt/10 dark:text-lime dark:hover:bg-lime/10"
                      >
                        {allDone ? t.clearWeek : t.markWeekComplete}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </section>
  )
}

/**
 * The permanent route back to a milestone's post.
 *
 * Sized to the 44px tap target the whole app is built to rather than shrunk to
 * fit the header row — it sits on its own line for exactly that reason. A
 * control a learner cannot reliably hit on a phone is not a control.
 */
function ShareButton({ milestone, label, aria, onShare }) {
  return (
    <button
      type="button"
      onClick={() => onShare(milestone)}
      aria-label={aria}
      className="inline-flex min-h-[44px] flex-none items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-cobalt-600 transition-colors hover:bg-cobalt/10 dark:text-lime dark:hover:bg-lime/10"
    >
      <Share2 size={14} aria-hidden="true" />
      {label}
    </button>
  )
}
