import { useState } from 'react'
import { AlarmClock, CheckCircle2, ChevronDown, CircleDot, Coffee, ListChecks, Share2 } from 'lucide-react'
import LessonRow from './LessonRow'
import { useLang } from '../i18n/LanguageContext'

/**
 * Full curriculum browser: every module → week → lesson, collapsible, with the
 * learner's current week expanded and flagged by default. Buffer weeks render
 * as a compact, non-expandable "catch-up" row; half weeks get a "½ week" chip.
 *
 * `currentWeek` is null until the course begins: then every week starts
 * closed, and none is flagged.
 *
 * A week before the current one with items still open is overdue: amber
 * number, "N overdue" chip. It wore the same grey number as a week still to
 * come, so a learner who is behind could not see where the open items were
 * without opening the weeks one by one.
 *
 * Creative Tech (`creativeTech`) is read by module, because its weeks are
 * long and its modules many. Graphic Design's Week 9 is 31 items, and opened
 * here under the focus card that already lists it, it repeated all 31 in a
 * block about 2,300px tall: the page held 62 checkboxes for 31 items. Every
 * finished module stayed laid out in full, about 400px of green weeks each, so
 * at Week 31 the current week sat 6,800px down a 9,400px page. So there:
 *  - the current week starts closed, still flagged "Current" and openable;
 *  - a finished module folds into one row, "GD-3 Poster Design & Visual
 *    Composition · Weeks 9–10 · 31/31 ✓", with a full bar and its Share
 *    button, and opens to show its weeks (see ModuleRow);
 *  - the current module stays open, finished or not, and every other module
 *    is as it was: one with items overdue is never finished, so it stays open.
 * Data Analytics' 4 modules and 1–5-lesson weeks are left exactly as they were.
 */
export default function WeekAccordion({
  schedule,
  completedSet,
  currentWeek,
  onToggle,
  onSetWeek,
  achieved = [],
  onShare,
  creativeTech = false,
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
  const [openWeeks, setOpenWeeks] = useState(
    () => new Set(currentWeek == null || creativeTech ? [] : [currentWeek]),
  )
  /*
    The finished modules that start folded: decided on arrival, like the focus
    card's "Show N done", and never the module holding this week. A module
    finished during the visit stays open: folding it the moment its last item
    was ticked would take the rows out from under the learner's finger. App
    keys the roadmap by program, so another program decides afresh.
  */
  const [foldedModules, setFoldedModules] = useState(() => {
    if (!creativeTech) return new Set()
    const holdsCurrent = (m) => m.weeks.some((w) => w.week === currentWeek)
    return new Set(
      schedule.modules
        .filter((m) => isFinished(countItems(m, completedSet)) && !holdsCurrent(m))
        .map((m) => m.code),
    )
  })

  /*
    The tab re-reads the clock, and the week can turn at midnight into a
    module folded on arrival. That module opens then, as a fresh visit lays it
    out, so the week flagged "Current" is never hidden inside a folded row.
    Every other fold, the learner's own included, stays as it is.
  */
  const [foldsFor, setFoldsFor] = useState(currentWeek)
  if (foldsFor !== currentWeek) {
    setFoldsFor(currentWeek)
    const holding = schedule.modules.find((m) => m.weeks.some((w) => w.week === currentWeek))
    if (holding && foldedModules.has(holding.code)) {
      const next = new Set(foldedModules)
      next.delete(holding.code)
      setFoldedModules(next)
    }
  }

  const toggleIn = (setter) => (key) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleWeek = toggleIn(setOpenWeeks)
  const toggleModule = toggleIn(setFoldedModules)

  /**
   * One week: a card that opens to its items, or a catch-up week's flat row.
   * Its tile writes the number as the learner's language does: "13,5" in
   * French, beside "Semaine 13,5".
   */
  const weekRow = (week) => {
    const isOpen = openWeeks.has(week.week)
    const isCurrent = week.week === currentWeek
    const done = week.lessons.filter((l) => completedSet.has(l.id)).length
    const total = week.lessons.length
    const allDone = total > 0 && done === total
    // The same rule as the status card's: only weeks strictly before
    // the current one are late, so this week's open items are not.
    const overdue = currentWeek != null && week.week < currentWeek ? total - done : 0
    const panelId = `week-panel-${week.week}`

    if (week.isBuffer && total === 0) {
      return (
        <div
          key={week.week}
          className={`alx-card flex items-center gap-3 border-dashed !p-3.5 ${
            isCurrent ? 'ring-2 ring-lime' : ''
          }`}
        >
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs font-bold ${
              isCurrent
                ? 'bg-lime text-navy-900'
                : 'bg-navy-900/5 text-ink-soft dark:bg-white/10 dark:text-paper/75'
            }`}
          >
            {t.number(week.week)}
          </span>
          <div className="min-w-0 flex-1">
            {/*
              The chips flow under the label when the row runs short,
              and the note takes a second line, where both used to be
              cut: in French, Graphic Design's current catch-up week
              read "Sem…" beside "Rattrapage" and "En cours", and every
              catch-up note stopped at "pas de nouveau…".
            */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-bold">{t.weekRange(week.week, week.week)}</p>
              <span className="alx-chip flex-none bg-navy-900/5 text-ink-soft dark:bg-white/10 dark:text-paper/75">
                <Coffee size={11} aria-hidden="true" /> {t.bufferChip}
              </span>
              {isCurrent && (
                <span className="alx-chip flex-none bg-lime-300 text-navy-900">
                  <CircleDot size={11} aria-hidden="true" /> {t.current}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft dark:text-paper/70">{t.bufferRoadmapNote}</p>
          </div>
        </div>
      )
    }

    return (
      <div
        key={week.week}
        className={`alx-card overflow-hidden !p-0 ${isCurrent ? 'ring-2 ring-lime' : ''}`}
      >
        {/*
          The focus ring is drawn inside the button. The card's
          overflow-hidden clipped the usual ring outside it, so a
          week reached by Tab showed no ring at all. The button takes
          the card's corner (16px, less its 1px border), so the ring
          follows the card's curve instead of being cut off by it.
        */}
        <button
          type="button"
          onClick={() => toggleWeek(week.week)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`flex w-full items-center gap-3 p-3.5 text-start focus-visible:outline-offset-[-3px] ${
            isOpen ? 'rounded-t-[15px]' : 'rounded-[15px]'
          }`}
        >
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs font-bold ${
              allDone
                ? 'bg-alxgreen text-navy-900'
                : isCurrent
                  ? 'bg-lime text-navy-900'
                  : overdue > 0
                    ? 'bg-amber text-navy-900'
                    : 'bg-navy-900/5 text-ink-soft dark:bg-white/10 dark:text-paper/75'
            }`}
          >
            {allDone ? <CheckCircle2 size={18} aria-hidden="true" /> : t.number(week.week)}
          </span>

          <div className="min-w-0 flex-1">
            {/*
              Wraps the same way as a catch-up row: at 320px, French
              cut "Semaine 27.5" short beside its "½ semaine" chip.
              A row that fits looks exactly as it did.
            */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-bold">{t.weekRange(week.week, week.week)}</p>
              {week.isHalf && (
                <span className="alx-chip flex-none bg-cobalt/10 text-cobalt-600 dark:bg-lime/15 dark:text-lime">
                  {t.halfWeekChip}
                </span>
              )}
              {isCurrent && (
                <span className="alx-chip flex-none bg-lime-300 text-navy-900">
                  <CircleDot size={11} aria-hidden="true" /> {t.current}
                </span>
              )}
              {/* The pace card's amber tone: ≥4.5:1 in both themes. */}
              {overdue > 0 && (
                <span className="alx-chip flex-none bg-amber/15 text-amber-700 dark:bg-amber/20 dark:text-amber">
                  <AlarmClock size={11} aria-hidden="true" />{' '}
                  {t.overdueChip(overdue, schedule.itemNoun)}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-soft dark:text-paper/70">
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
  }

  return (
    <section aria-label={t.fullCurriculumAria} className="space-y-5">
      <div className="flex items-center gap-2 px-1">
        <ListChecks size={18} className="text-cobalt-600 dark:text-lime" aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-wide">
          {t.roadmapTitle(schedule.totalWeeks)}
        </h2>
      </div>

      {programme && onShare ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-alxgreen/40 bg-alxgreen/10 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wide text-alxgreen-700 dark:text-alxgreen">
            {t.roadmapProgrammeDone}
          </span>
          <ShareButton
            milestone={programme}
            label={t.roadmapShare}
            aria={t.roadmapShareAria(t.programs[programme.program] ?? programme.title)}
            onShare={onShare}
          />
        </div>
      ) : null}

      {schedule.modules.map((module) => {
        const share =
          shareable.has(module.code) && onShare ? (
            <ShareButton
              milestone={shareable.get(module.code)}
              label={t.roadmapShare}
              aria={t.roadmapShareAria(module.title)}
              onShare={onShare}
            />
          ) : null
        const { done, total } = countItems(module, completedSet)
        // A finished Creative Tech module is one row that opens to its weeks.
        const foldable = creativeTech && isFinished({ done, total })
        const open = !foldable || !foldedModules.has(module.code)
        const panelId = `module-panel-${module.code}`
        const weeks = module.weeks.map(weekRow)

        return (
          <div key={module.code} className="space-y-2">
            {foldable ? (
              <ModuleRow
                module={module}
                done={done}
                total={total}
                open={open}
                panelId={panelId}
                onToggle={() => toggleModule(module.code)}
                share={share}
              />
            ) : (
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
            )}

            {share && !foldable ? (
              <div className="flex items-center justify-between gap-3 px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-alxgreen-700 dark:text-alxgreen">
                  {t.roadmapModuleDone}
                </span>
                {share}
              </div>
            ) : null}

            {/*
              Creative Tech's weeks sit in one panel whether their module is
              finished or not. A module finished during the visit then keeps
              the very rows it had, the box just ticked and its focus among
              them, rather than having them drawn anew under a new heading.
            */}
            {creativeTech
              ? open && (
                  <div id={foldable ? panelId : undefined} className="space-y-2">
                    {weeks}
                  </div>
                )
              : weeks}
          </div>
        )
      })}
    </section>
  )
}

/** How many of a module's items are ticked, of how many. */
function countItems(module, completedSet) {
  const items = module.weeks.flatMap((w) => w.lessons)
  return { done: items.filter((l) => completedSet.has(l.id)).length, total: items.length }
}

/** Every item ticked. A module with none is never finished, as in milestones.js. */
function isFinished({ done, total }) {
  return total > 0 && done === total
}

/**
 * A finished Creative Tech module as one row: "GD-3 Poster Design & Visual
 * Composition", then "Weeks 9–10 · 31/31 ✓" over a full bar. The row is the
 * module's heading and opens or closes its weeks. The Share button sits beside
 * it, never inside it, so each control has one name and one job, and both are
 * at least 44px tall. The bar is for the eye only; a screen reader hears the
 * count, and the tick as "Complete".
 */
function ModuleRow({ module, done, total, open, panelId, onToggle, share }) {
  const { t } = useLang()
  return (
    <div className="flex items-center gap-2">
      <h3 className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-1 py-1.5 text-start transition-colors hover:bg-navy-900/[0.04] dark:hover:bg-white/[0.05]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">
              <span className="text-cobalt-600 dark:text-lime">{module.code}</span>{' '}
              <span dir="ltr" className="text-ink dark:text-paper">
                {module.title}
              </span>
            </span>
            <span className="mt-0.5 block text-xs font-medium text-ink-mute dark:text-paper/65">
              {t.weekRange(module.weekStart, module.weekEnd)}
              {'\u00a0'}·{' '}
              <span className="whitespace-nowrap tabular-nums">
                {done}/{total}{' '}
                <CheckCircle2
                  size={13}
                  strokeWidth={2.5}
                  className="inline-block align-[-2px] text-alxgreen-700 dark:text-alxgreen"
                  role="img"
                  aria-label={t.roadmapModuleDone}
                />
              </span>
            </span>
            <span
              className="mt-2 block h-1 overflow-hidden rounded-full bg-navy-900/10 dark:bg-white/10"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-alxgreen"
                style={{ width: `${Math.round((done / total) * 100)}%` }}
              />
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`flex-none text-ink-mute transition-transform dark:text-paper/60 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>
      {share}
    </div>
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
