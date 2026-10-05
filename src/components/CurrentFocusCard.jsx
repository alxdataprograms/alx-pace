import { Fragment, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Flag,
  RefreshCcw,
  Target,
  Zap,
} from 'lucide-react'
import LessonRow from './LessonRow'
import SteadyText, { widestCounts } from './SteadyText'
import { useLang } from '../i18n/LanguageContext'
import { useKeptInPlace, withKept } from '../hooks/useKeptInPlace'
import { nextCheckpoint } from '../lib/schedule'
import { formatShortDate } from '../lib/formatDate'

// How many open items a catch-up week lists at once; ticking one pulls the
// next oldest in, so the card stays short however far behind a learner is,
// and "Show all" opens the rest in place. A ticked item stays in place (struck
// through) until the card remounts, so an accidental tick can be undone right
// where it happened.
const CATCH_UP_LIMIT = 6

// An ordinary week lists fewer, because this week's own lessons follow them:
// three of the oldest are enough to start on, and keep the week's first lesson
// close to the first screen.
const CATCH_UP_FIRST_LIMIT = 3

// How many of next week's open items "Get ahead" lists: enough to start on,
// few enough that a finished week's card stays short. Ticking one pulls the
// next in, as in the catch-up lists.
const GET_AHEAD_LIMIT = 3

// A focus week longer than this tucks its already-done items behind a toggle,
// so the next open item is near the top instead of under a screen of ticks,
// and names its next checkpoint above the list (see NextCheckpoint).
// Creative Tech weeks run to 31 items; Data Analytics never exceeds 5, so a
// DA week folds only once all of it was done (see WeekList), and never names
// a checkpoint.
const LONG_WEEK = 8

/**
 * "This Week's Focus" — the exact Module, Week and lessons the learner should
 * be working on right now, with inline checkboxes.
 *
 * Buffer weeks (Creative Tech) have no new content, so the card turns into a
 * catch-up list: the oldest still-open items from earlier weeks, under the
 * week each comes from.
 *
 * In any other week, a learner with items still open from earlier weeks
 * (`catchUp`, oldest first) meets the oldest of them first, in a "Catch up
 * first" section above this week's lessons. `catchUpRef` marks that section's
 * heading, which the status card's "Catch up now" moves to (see App). In a
 * catch-up week, whose whole card is that list, it marks the list's opening
 * sentence instead, where "Already started?"'s "Not yet, show me what's open"
 * goes (the status card offers no "Catch up now" there). `unit`
 * is what the counts count ('lesson' | 'item'). `nextCatchUp` ({ week, date },
 * Creative Tech only) is the catch-up week ahead, which that section names.
 *
 * Once this week is done, a learner with nothing overdue gets the next thing
 * to tick: "Get ahead" lists the first open items of `upcoming`, the later
 * weeks with something to tick (see contentWeeksAfter).
 *
 * A long week stays open in full, and one line above its list names the next
 * graded item and how far off it is (see NextCheckpoint).
 */
export default function CurrentFocusCard({
  week,
  completedSet,
  onToggle,
  catchUp = [],
  catchUpRef,
  unit,
  upcoming = [],
  nextCatchUp = null,
}) {
  const { t } = useLang()
  const done = week ? week.lessons.filter((l) => completedSet.has(l.id)).length : 0
  const total = week ? week.lessons.length : 0

  /*
    What the card lays out: whether this week is done (the note under its
    list, and "Get ahead") and whether nothing is overdue any more ("Catch up
    first"'s all-clear, and "Get ahead" again). Decided on arrival, and changed
    only by a tick on the card itself, which changes what lies below the finger
    that made it. A tick anywhere else, in the roadmap below, changes boxes and
    counts here but never what is laid out: a section that came or went in
    this card moved the roadmap's rows under the finger ticking there, by up
    to 437px in Safari, which has no scroll anchoring. App keys the card's
    sections by week, so the next week, or the next visit, decides afresh.
  */
  const [layout, setLayout] = useState(() => ({
    weekDone: total > 0 && done === total,
    cleared: catchUp.length === 0,
  }))
  const toggleThisWeek = (id) => {
    const nowDone = !completedSet.has(id)
    const weekDone = week.lessons.every((l) => (l.id === id ? nowDone : completedSet.has(l.id)))
    setLayout((prev) => ({ ...prev, weekDone }))
    onToggle(id)
  }
  const toggleOverdue = (id) => {
    // Ticking the last item open clears them; unticking any reopens them.
    const cleared = !completedSet.has(id) && catchUp.every((l) => l.id === id)
    setLayout((prev) => ({ ...prev, cleared }))
    onToggle(id)
  }

  if (!week) return null

  const isCatchUp = week.isBuffer && week.lessons.length === 0
  const Icon = isCatchUp ? RefreshCcw : Target
  // The region's name gives the week in the learner's language. The sheet's
  // own label is English ("Week 4"), and a French screen reader read
  // "Objectif de la semaine : Week 4".
  const weekName = t.weekRange(week.week, week.week)

  return (
    <section
      className="relative overflow-hidden rounded-2xl border-2 border-lime bg-white p-4 shadow-glow dark:bg-navy-900"
      aria-label={t.focusAria(weekName)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {/*
          The heading names the week in the learner's language, as the sheet
          labels it, its kind included: "Semaine 13,5 (rattrapage) · GD-4",
          "الأسبوع 4 · DA-2". It was the sheet's English in every language, all
          of it held left to right; now only the module code is.

          It wraps when the row runs short, before the week's kind or after the
          "·", into lines of even length ("Semaine 13 / (½ semaine) · GD-4"),
          never inside the module code. It could neither wrap nor shrink: at
          320px, "Week 13 (½ week) · GD-4" pushed the "0/4" beside it past the
          card's edge, and the longer French and Arabic labels would have done
          so at 375px.
        */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-lime text-navy-900">
            <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
              {isCatchUp ? t.catchUpEyebrow : t.focusEyebrow}
            </p>
            <h2 className="text-balance text-base font-bold leading-tight">
              {t.weekLabel(week)}
              {'\u00a0· '}
              <span dir="ltr" className="whitespace-nowrap">
                {week.moduleCode}
              </span>
            </h2>
          </div>
        </div>
        {!isCatchUp && (
          <span className="flex-none rounded-full bg-navy-900/5 px-2.5 py-1 text-xs font-bold tabular-nums dark:bg-white/10">
            {done}/{total}
          </span>
        )}
      </div>

      {isCatchUp ? (
        // Keyed per week (module codes are unique across programs), so the rows
        // kept in place reset when the week or the program changes.
        <CatchUpList
          key={`${week.moduleCode}-${week.week}`}
          items={catchUp}
          completedSet={completedSet}
          onToggle={onToggle}
          introRef={catchUpRef}
        />
      ) : (
        <>
          <p dir="ltr" className="mb-3 text-start text-sm font-medium text-ink-soft dark:text-paper/75">
            {week.moduleTitle}
          </p>

          {/* Keyed per week, like the lists, so its kept rows reset with the week. */}
          <CatchUpFirst
            key={`catch-up-${week.moduleCode}-${week.week}`}
            items={catchUp}
            completedSet={completedSet}
            onToggle={toggleOverdue}
            headingRef={catchUpRef}
            unit={unit}
            nextCatchUp={nextCatchUp}
            cleared={layout.cleared}
            weekDone={done === total}
          />

          {/* Keyed per week too: whether it shows is decided on arrival. */}
          {week.lessons.length > LONG_WEEK && (
            <NextCheckpoint
              key={`checkpoint-${week.moduleCode}-${week.week}`}
              week={week}
              completedSet={completedSet}
              unit={unit}
            />
          )}

          <WeekList
            key={`${week.moduleCode}-${week.week}`}
            lessons={week.lessons}
            completedSet={completedSet}
            onToggle={toggleThisWeek}
            unit={unit}
            noted={layout.weekDone && layout.cleared}
            overdue={catchUp.length > 0}
          />

          {/* Keyed per week too: the rows it keeps reset with the week. */}
          <GetAhead
            key={`ahead-${week.moduleCode}-${week.week}`}
            weeks={upcoming}
            completedSet={completedSet}
            onToggle={onToggle}
            offered={layout.weekDone && layout.cleared}
            unit={unit}
          />
        </>
      )}
    </section>
  )
}

/**
 * This week's own list: open items first-class, finished ones folded away.
 *
 * Items already done when the learner arrived sit behind "Show N done"; the
 * list keeps curriculum order either way, so expanding it restores the week
 * exactly as the sheet lays it out. Anything ticked during this visit — here,
 * or in the roadmap below — stays where it is: folding it away on tick would
 * make a mis-tap impossible to undo here and pull focus out from under the
 * learner (see useKeptInPlace).
 *
 * A long week folds whatever was done. A short one (every Data Analytics
 * week) folds only once it was done in full: part-way through, its few rows
 * read at a glance, and the week looks exactly as it always has. Done in
 * full, it met a learner who finished early with crossed-out rows and nothing
 * after them; now they see "Show 2 done", the note, and "Get ahead" below.
 *
 * The "week done" note sits BELOW the list in a polite live region: above it,
 * it pushed the rows down the moment the last one was ticked, moving the
 * control just used, and appearing silently it said nothing to a screen reader.
 * Only long weeks had it; a week of any length gets it now. It shows where the
 * card lays it out (`noted`: the week done on arrival, or by a tick in this
 * list, with nothing overdue, as "Get ahead" is), and keeps its place, unseen
 * and unread, while a lesson unticked in the roadmap leaves the week undone:
 * gone, it would pull the roadmap up under the finger that unticked it. Not
 * while anything is overdue: "Nicely paced" read under "Catch up first" to a
 * learner six lessons behind, and a screen reader announced it. An earlier
 * lesson unticked in the roadmap hides it the same way, its place held.
 */
function WeekList({ lessons, completedSet, onToggle, unit, noted, overdue }) {
  const { t } = useLang()
  const [kept, keep] = useKeptInPlace(onToggle)
  const [showDone, setShowDone] = useState(false)
  const [doneOnArrival] = useState(
    () => new Set(lessons.filter((l) => completedSet.has(l.id)).map((l) => l.id)),
  )
  const listId = useId()

  const folds = lessons.length > LONG_WEEK || doneOnArrival.size === lessons.length
  /*
    What was done on arrival stays folded for the visit, but for rows touched
    here, which stay where the learner saw them. A row unticked in the roadmap
    stays in the fold too: back in the list, it pushed the roadmap down under
    the finger that unticked it, by 151px for a Data Analytics week done before
    the visit, and 288px once the fold gave up its last row. So the toggle says
    what it holds: "Show 2 done", or "Show 2 (1 open)" once a lesson in it is
    open again, never an open lesson behind "done". The label can take two
    lines inside the toggle's 44px; the toggle never grows.
  */
  const folded = folds ? lessons.filter((l) => doneOnArrival.has(l.id) && !kept.has(l.id)) : []
  const openFolded = folded.filter((l) => !completedSet.has(l.id)).length
  const shown = showDone ? lessons : lessons.filter((l) => !folded.includes(l))
  const allDone = lessons.every((l) => completedSet.has(l.id))

  /*
    The toggle sits above the rows it shows, so it stays while they are open.
    Unticking the last of them, here or in the roadmap, left it nothing to
    fold and took it away, and every row below moved up by its 48px, the one
    just unticked among them: a Data Analytics week of one lesson, done on
    arrival, did that on a single untick. With nothing left to fold it keeps
    its place, empty and out of reach, until the next visit. Folded rows that
    are unticked in the roadmap while the toggle is closed take its place
    themselves, so it goes as it always has.
  */
  const toggleHeld = folded.length === 0 && showDone

  return (
    <>
      {toggleHeld && <div aria-hidden="true" className="invisible mb-1 min-h-[44px]" />}
      {folded.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          aria-expanded={showDone}
          aria-controls={listId}
          className="mb-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 text-start text-xs font-semibold text-cobalt-600 hover:bg-navy-900/[0.04] dark:text-lime dark:hover:bg-white/[0.05]"
        >
          <CheckCircle2 size={16} className="flex-none" aria-hidden="true" />
          <span className="flex-1">
            {showDone
              ? t.hideDone(unit)
              : openFolded > 0
                ? t.showFolded(folded.length, openFolded, unit)
                : t.showDone(folded.length, unit)}
          </span>
          <ChevronDown
            size={16}
            className={`flex-none transition-transform motion-reduce:transition-none ${
              showDone ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}

      <ul id={listId} className="-mx-1 space-y-0.5">
        {shown.map((lesson) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            checked={completedSet.has(lesson.id)}
            onToggle={() => keep(lesson)}
            highlight
          />
        ))}
      </ul>

      {/* Always in the DOM, so the note is announced when it appears. */}
      <div role="status" aria-live="polite" className={noted ? 'mt-2' : ''}>
        {noted &&
          (allDone && !overdue ? (
            <AllClear text={t.weekAllDone} />
          ) : (
            <Held>
              <AllClear text={t.weekAllDone} />
            </Held>
          ))}
      </div>
    </>
  )
}

/** A line's place held for the visit after it has gone: unseen and unread. */
function Held({ children }) {
  return (
    <div aria-hidden="true" className="invisible">
      {children}
    </div>
  )
}

/**
 * "Next checkpoint": a long week's first graded item still open, and how many
 * open items lead up to it.
 *
 * WHY
 * Creative Tech weeks run to 31 items, and the quizzes and the mastery project
 * that close each part of a week looked like any other row: "Module 1 Wrap
 * Up", then "Quiz 1: Poster Design", then the next part. Opening Graphic
 * Design's Week 9 showed a column of 31 rows and no near goal. The week stays
 * open in full, in the sheet's order, so a learner who works out of order
 * still finds every item where it was; this one line above it names the goal:
 * "Next checkpoint: Quiz 1: Poster Design · 9 items away". The count is of the
 * open items up to the checkpoint, itself included (see nextCheckpoint), so it
 * drops with every tick on the way, and moves on to the next graded item once
 * that one is ticked.
 *
 * Decided on arrival, like "Show N done": a week with nothing graded left
 * open shows no line. Once shown, it stays for the visit. Ticking the last
 * graded item turns it into the graded card's "All 3 graded items for Week 9
 * are done." in the same place; taking it away would pull every row below up
 * by a line, the one just ticked with them. Unticking brings the checkpoint
 * back. Not a live region: a count that changes with every tick would be read
 * out after every tick, and the checkbox already says what changed.
 *
 * The title is the sheet's own, in English in every language, set apart so
 * that Arabic cannot reorder it.
 */
function NextCheckpoint({ week, completedSet, unit }) {
  const { t } = useLang()
  const next = nextCheckpoint(week, completedSet)
  const [shown] = useState(next != null)
  if (!shown) return null

  const allDone = t.milestonesAllDone(week.gradedItems.length, week.week)
  // A no-break space holds the "·" to the title, so a line that wraps ends
  // on it rather than starting with it.
  const line = (item, away) => (
    <>
      <span className="font-semibold">{t.nextCheckpoint}</span>{' '}
      <span dir="ltr" className="font-semibold text-ink dark:text-paper">
        {item.graded?.title ?? item.title}
      </span>
      {'\u00a0'}· <span className="whitespace-nowrap">{t.checkpointAway(away, unit)}</span>
    </>
  )
  // The longest count a checkpoint can show: as many items away as it can be
  // (it and everything before it), or one, which Arabic writes longest.
  const longest = (item) => {
    const most = week.lessons.indexOf(item) + 1
    return t.checkpointAway(1, unit).length > t.checkpointAway(most, unit).length ? 1 : most
  }

  return (
    <p className="mb-1 flex items-start gap-2 px-2.5 py-1.5 text-xs text-ink-soft dark:text-paper/75">
      {next ? (
        <Flag size={16} className="flex-none text-cobalt-600 dark:text-lime" aria-hidden="true" />
      ) : (
        <CheckCircle2
          size={16}
          className="flex-none text-alxgreen-700 dark:text-alxgreen"
          aria-hidden="true"
        />
      )}
      {/*
        Every line this visit can show shares one grid cell, all but the one
        in force invisible, and so unread: the line is as tall as the tallest
        of them from the start. Moving on to the next checkpoint, or clearing
        the last, changes its words and never its height; a longer title had
        taken a line more, and the all-clear a line less, moving every row
        below by a line, the one just ticked among them.
      */}
      <span className="grid min-w-0 flex-1">
        {week.gradedItems.map((item) => (
          <span key={item.id} className="invisible col-start-1 row-start-1" aria-hidden="true">
            {line(item, longest(item))}
          </span>
        ))}
        <span className="invisible col-start-1 row-start-1" aria-hidden="true">
          {allDone}
        </span>
        <span className="col-start-1 row-start-1">{next ? line(next.item, next.away) : allDone}</span>
      </span>
    </p>
  )
}

/**
 * A catch-up week's list: the oldest items still open from earlier weeks,
 * under the week each comes from.
 *
 * WHY
 * Every row repeated its week above its title, "WEEK 12 · GD-4", in the
 * sheet's English whatever the learner's language, and the list ended on plain
 * text, "+8 more open — see the roadmap below", pointing at weeks the roadmap
 * kept closed. Now one heading per week names it in the learner's language,
 * with how many of its items are open, "Week 12 · GD-4 — 10 open", and a 44px
 * "Show all 14" opens the whole list where it is ("Show fewer" closes it).
 *
 * A tick stays in place, struck through, under its week, open in full or not
 * (useHeldRows), and the week's count drops with it.
 *
 * `introRef` marks the opening sentence ("…clear the 14 items still open…"),
 * where "Not yet, show me what's open" goes: the margin above it is the one
 * "Catch up first" keeps. Once nothing is open the sentence is hidden from
 * assistive tech, so it lets go of the ref, and App goes elsewhere.
 */
function CatchUpList({ items, completedSet, onToggle, introRef }) {
  const { t } = useLang()
  const [showAll, setShowAll] = useState(false)
  /*
    Its rows hold as "Catch up first"'s do (useHeldRows): the first six on
    arrival, and the next oldest as each is ticked here. A row ticked in the
    roadmap below stays put, struck through, and pulls nothing in: the list
    was rebuilt from what was open on every tick there, and a week's heading
    coming in, or "Show all" going, moved the roadmap's rows by 30 to 118px.
    Open in full, it lists everything still open as well; a row ticked there
    stays when it closes, where it was.
  */
  const { rows, tick: tickHeld } = useHeldRows(items, CATCH_UP_LIMIT, onToggle)
  const [tickedOpen, setTickedOpen] = useState(() => new Map())
  const held = withKept(rows, tickedOpen)
  const onScreen = new Set(held.map((l) => l.id))
  const shown = showAll ? withKept(held, new Map(items.filter((l) => !onScreen.has(l.id)).map((l) => [l.id, l]))) : held
  const keep = (lesson) => {
    if (onScreen.has(lesson.id)) return tickHeld(lesson)
    setTickedOpen((prev) => new Map(prev).set(lesson.id, lesson))
    onToggle(lesson.id)
  }
  const hidden = items.filter((l) => !onScreen.has(l.id)).length
  const listId = useId()
  const showAllButton = useRef(null)
  const closing = useRef(false)
  // What was open on arrival, in all and week by week: the most the counts
  // here can say this visit, which sets the size they hold (SteadyText).
  const [onArrival] = useState(() => ({
    all: items.length,
    week: items.reduce((m, l) => m.set(l.week, (m.get(l.week) ?? 0) + 1), new Map()),
  }))
  const openIn = (week) => items.filter((l) => l.week === week).length

  /*
    "Show fewer" sits under the open list, so closing it lifts the button by
    every row it hides, above the top of the screen when the list was long.
    Then it comes back into view at the bottom edge, the rows still listed
    above it: it keeps the focus, and the learner their place. The scroll
    follows the page's scroll-behavior, instant for anyone who asked for
    reduced motion.
  */
  useLayoutEffect(() => {
    if (!closing.current) return
    closing.current = false
    const button = showAllButton.current
    if (button && button.getBoundingClientRect().top < 0) button.scrollIntoView({ block: 'end' })
  })

  if (shown.length === 0) return <AllClear text={t.catchUpAllClear} />

  /*
    Ticking the last open item swaps the intro for the all-clear in the SAME
    paragraph, which holds the size of the longer of the two, so the rows
    under the learner's finger do not move: the all-clear had been a line
    shorter in French, and at 320px in English, and pulled every row up. A
    visually hidden live region announces it; the visible copy is hidden from
    assistive tech meanwhile, so it is not read twice.
  */
  const cleared = items.length === 0
  const intro = (n) => (n > 0 ? t.catchUpBody(n) : t.catchUpAllClear)

  // The rows, in curriculum order, under the week each comes from.
  const groups = []
  for (const lesson of shown) {
    const group = groups[groups.length - 1]
    if (group?.week === lesson.week) group.lessons.push(lesson)
    else groups.push({ week: lesson.week, moduleCode: lesson.moduleCode, lessons: [lesson] })
  }

  return (
    <>
      <p
        ref={cleared ? undefined : introRef}
        tabIndex={cleared ? undefined : -1}
        className="mb-3 scroll-mt-5 text-sm font-medium text-ink-soft dark:text-paper/75"
        aria-hidden={cleared || undefined}
      >
        <SteadyText texts={widestCounts(onArrival.all).map(intro)}>
          {intro(items.length)}
        </SteadyText>
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {cleared ? t.catchUpAllClear : ''}
      </p>
      <div id={listId} className="space-y-3">
        {groups.map((group) => (
          <div key={group.week}>
            {/*
              Breaks only after the dash, as "Get ahead" breaks after its own
              words: never inside "Week 12 · GD-4", or inside "10 open". The
              count holds its widest width, so a heading that wraps at "10 à
              rattraper" does not fit on one line at "rattrapée" and pull the
              rows below up by a line, or the other way round.
            */}
            <h3 className="mb-1 px-1.5 text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
              <span className="whitespace-nowrap">
                {t.weekRange(group.week, group.week)} · <span dir="ltr">{group.moduleCode}</span>
              </span>
              {'\u00a0'}—{' '}
              <span className="whitespace-nowrap">
                <SteadyText
                  inline
                  texts={widestCounts(onArrival.week.get(group.week) ?? 0).map((n) =>
                    t.catchUpWeekOpen(n),
                  )}
                >
                  {t.catchUpWeekOpen(openIn(group.week))}
                </SteadyText>
              </span>
            </h3>
            <ul className="-mx-1 space-y-0.5">
              {group.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  checked={completedSet.has(lesson.id)}
                  onToggle={() => keep(lesson)}
                  highlight
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/*
        There when more was open on arrival than the first six, and for the
        visit, so it can close what it opened. With nothing left beyond the
        rows on screen it keeps its place, unseen and out of reach: going, it
        pulled the roadmap below up under a finger ticking there.
      */}
      {onArrival.all > CATCH_UP_LIMIT && !showAll && hidden === 0 && (
        <div aria-hidden="true" className="invisible mt-2 min-h-[44px]" />
      )}
      {onArrival.all > CATCH_UP_LIMIT && (showAll || hidden > 0) && (
        <button
          ref={showAllButton}
          type="button"
          onClick={() => {
            closing.current = showAll
            setShowAll((v) => !v)
          }}
          aria-expanded={showAll}
          aria-controls={listId}
          className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 text-start text-xs font-semibold text-cobalt-600 hover:bg-navy-900/[0.04] dark:text-lime dark:hover:bg-white/[0.05]"
        >
          <span className="flex-1">
            {showAll ? t.catchUpShowFewer : t.catchUpShowAll(items.length)}
          </span>
          <ChevronDown
            size={16}
            className={`flex-none transition-transform motion-reduce:transition-none ${
              showAll ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    </>
  )
}

/**
 * The rows of a list that refills as the learner ticks it: the first `limit`
 * of `open` on arrival and, for each one ticked here, the next open item not
 * on screen yet, so `limit` stay open to work on. Nothing else adds a row or
 * takes one away for the rest of the visit. A row ticked here stays where it
 * is, struck through, so a mis-tap can be undone on the spot (see
 * useKeptInPlace); so does a row ticked anywhere else. These lists sit above
 * the roadmap, and a row that left one, or a list that left the card, moved
 * the roadmap's rows under the finger ticking there: by up to 437px in
 * Safari, which has no scroll anchoring.
 *
 * `more` counts the open items not on screen; `moreOnArrival` what it was on
 * arrival, which decides whether the line that counts them has a place.
 */
function useHeldRows(open, limit, onToggle, initial) {
  const [rows, setRows] = useState(() => initial ?? open.slice(0, limit))
  const [moreOnArrival] = useState(() => open.length - Math.min(open.length, limit))
  const onScreen = new Set(rows.map((l) => l.id))
  const tick = (lesson) => {
    if (open.some((l) => l.id === lesson.id)) {
      const next = open.find((l) => l.id !== lesson.id && !onScreen.has(l.id))
      if (next) setRows((prev) => [...prev, next])
    }
    onToggle(lesson.id)
  }
  return { rows, more: open.filter((l) => !onScreen.has(l.id)).length, moreOnArrival, tick }
}

/**
 * "Catch up first": an ordinary week opens with the oldest items still open
 * from earlier weeks, when there are any.
 *
 * WHY
 * Only a catch-up week listed overdue items, and Data Analytics has none, so a
 * behind DA learner read "9 lessons from earlier weeks still open" above a
 * checklist holding only this week's one lesson. The nine sat in four
 * collapsed roadmap weeks, about 1,600px further down.
 *
 * So the three oldest come first, each labelled with its week and module in
 * the learner's language (the sheet's own label is English). Oldest first, as
 * in a catch-up week, because each week builds on the ones before it. A tick
 * stays where it is, struck through, and the next oldest joins below it, so
 * three stay open (useHeldRows). This week's lessons follow under their own
 * heading.
 *
 * Decided on arrival, as the status card's "Catch up now" is: a learner on
 * track or ahead sees the card exactly as before, for the whole visit, and
 * one who is behind keeps the section until the next visit. Clearing the last
 * overdue item here (`cleared`, which only a tick here sets) brings the
 * all-clear, below the rows in a polite live region, where it moves nothing.
 * Cleared from the roadmap, the rows say so, struck through, and nothing
 * moves: the line counting the rest, and the all-clear once it has shown,
 * keep their places, unseen and unread, while they have nothing to say.
 *
 * In Creative Tech, where the curriculum sets whole weeks aside for catching
 * up, the section ends by naming the next of them (`nextCatchUp`): "Next
 * catch-up week: Week 10, from Oct 27". That week sat as a dashed row deep in
 * the roadmap, while a learner 51 items behind read only the count. The line
 * goes here, under "+48 more overdue", where a learner meets the size of the
 * backlog, rather than in the status card above: that card stays the
 * one-glance answer it was, at its height, so nothing above the first overdue
 * item moves. It gives way to the all-clear.
 */
function CatchUpFirst({ items, completedSet, onToggle, headingRef, unit, nextCatchUp, cleared, weekDone }) {
  const { t, lang } = useLang()
  const { rows, more, moreOnArrival, tick } = useHeldRows(items, CATCH_UP_FIRST_LIMIT, onToggle)

  if (rows.length === 0) return null
  const moreLine = (n) => (
    <p className="mt-1 px-2.5 text-xs font-semibold text-amber-700 dark:text-amber">
      {t.catchUpFirstMore(n, unit)}
    </p>
  )

  return (
    <>
      <div className="-mx-1 mb-4 rounded-xl border-2 border-amber/40 bg-amber/10 p-2">
        {/*
          The status card's "Catch up now" scrolls this heading into view and
          focuses it; the scroll margin keeps the section's edge on screen.
        */}
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="flex scroll-mt-5 items-center gap-1.5 px-2.5 pb-1 pt-0.5 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber"
        >
          <RefreshCcw size={14} strokeWidth={2.5} className="flex-none" aria-hidden="true" />
          {t.catchUpFirst}
        </h3>
        <ul className="space-y-0.5">
          {rows.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              checked={completedSet.has(lesson.id)}
              onToggle={() => tick(lesson)}
              meta={
                <>
                  {t.weekRange(lesson.week, lesson.week)} ·{' '}
                  <span dir="ltr">{lesson.moduleCode}</span>
                </>
              }
            />
          ))}
        </ul>
        {moreOnArrival > 0 && (more > 0 ? moreLine(more) : <Held>{moreLine(moreOnArrival)}</Held>)}
        {nextCatchUp && !cleared && (
          <p className="mt-1 flex items-start gap-1.5 px-2.5 text-xs font-medium text-ink-soft dark:text-paper/75">
            <CalendarClock size={14} className="mt-px flex-none" aria-hidden="true" />
            <span>
              {t.nextCatchUpWeek(nextCatchUp.week, formatShortDate(nextCatchUp.date, lang))}
            </span>
          </p>
        )}
        {/*
          Always in the DOM, so the all-clear is announced when it appears. It
          says what comes next: this week's lessons, or, with the week done
          already, a rest or a head start ("Get ahead" follows below). "On to
          this week" had pointed a learner who finished the week before
          catching up at a week with nothing left in it. Held at the size of
          both wordings, as the week can come undone below it.
        */}
        <div role="status" aria-live="polite" className={cleared ? 'mt-2' : ''}>
          {cleared &&
            (items.length === 0 ? (
              <AllClear
                text={weekDone ? t.catchUpAllClear : t.catchUpFirstDone}
                texts={[t.catchUpFirstDone, t.catchUpAllClear]}
              />
            ) : (
              <Held>
                <AllClear text={t.catchUpFirstDone} texts={[t.catchUpFirstDone, t.catchUpAllClear]} />
              </Held>
            ))}
        </div>
      </div>

      <h3 className="mb-1 px-1.5 text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
        {t.thisWeek}
      </h3>
    </>
  )
}

/**
 * "Get ahead": once this week is done, the first open items of the next week
 * with anything to tick.
 *
 * WHY
 * A learner who finished the week early came back the next day to a card of
 * crossed-out rows and no next step. Getting ahead, which is what turns the
 * status card green, meant scrolling to the roadmap and opening next week.
 * Now the first three open items of that week follow the week-done note,
 * under "Get ahead · Week 5 · DA-2", in the learner's language. A catch-up
 * week has nothing to tick, so it is skipped, and so is a week already done.
 * The rows go without the lime tint of this week's own: nothing here is due.
 *
 * Not offered while anything is overdue (that learner has "Catch up first"
 * above instead, and "get ahead" would contradict it), or after the
 * programme's last week with content: there is nothing ahead to get to.
 * `offered` is the card's to decide (see CurrentFocusCard's layout): on
 * arrival, and by ticks on the card, never by ticks in the roadmap below.
 *
 * The catch-up lists' rule again (useHeldRows): a tick stays in place, struck
 * through, and the next open item joins below it. The week it offers is
 * chosen when it is offered and kept while it shows, and once something is
 * ticked here, the section stays, on that week, until the next visit, so the
 * tick can be undone where it happened even if the week above stops being
 * done. Once that week has nothing left to join, the next week's items do,
 * under their own "Week 6 · DA-3": a learner who ticked both of Week 2's
 * lessons here ended on two struck-through rows, with the next one only in the
 * roadmap.
 */
function GetAhead({ weeks, completedSet, onToggle, offered, unit }) {
  const [week, setWeek] = useState(null)
  const [ticked, setTicked] = useState(false)
  const showing = offered || ticked
  if (showing && !week) {
    const next = weeks.find((w) => w.lessons.some((l) => !completedSet.has(l.id)))
    if (next) setWeek(next)
  } else if (!showing && week) {
    setWeek(null)
  }
  if (!showing || !week) return null

  return (
    <GetAheadList
      key={week.week}
      weeks={weeks.filter((w) => w.week >= week.week)}
      completedSet={completedSet}
      onToggle={(id) => {
        setTicked(true)
        onToggle(id)
      }}
      unit={unit}
    />
  )
}

function GetAheadList({ weeks, completedSet, onToggle, unit }) {
  const { t } = useLang()
  const [week] = weeks
  const isOpen = (l) => !completedSet.has(l.id)
  // The week it offers first; the next weeks' items join once it runs out.
  const first = week.lessons.filter(isOpen)
  const { rows, tick } = useHeldRows(
    weeks.flatMap((w) => w.lessons.filter(isOpen)),
    GET_AHEAD_LIMIT,
    onToggle,
    first.slice(0, GET_AHEAD_LIMIT),
  )
  const onScreen = new Set(rows.map((l) => l.id))
  // "+11 more in Week 11": the week it offers, as on arrival.
  const more = first.filter((l) => !onScreen.has(l.id)).length
  const [moreOnArrival] = useState(() => Math.max(0, first.length - GET_AHEAD_LIMIT))
  const moreLine = (n) => (
    <p className="mt-1 px-1.5 text-xs font-semibold text-cobalt-600 dark:text-lime">
      {t.getAheadMore(n, week.week, unit)}
    </p>
  )
  // The rows in the order they joined, under the week each comes from.
  const groups = []
  for (const lesson of rows) {
    const group = groups[groups.length - 1]
    if (group?.week === lesson.week) group.lessons.push(lesson)
    else groups.push({ week: lesson.week, moduleCode: lesson.moduleCode, lessons: [lesson] })
  }

  return (
    <div className="mt-4 border-t border-navy-900/10 pt-3 dark:border-white/10">
      {/*
        French runs the heading to two lines at 375px, as larger text would in
        any language: it breaks after "Get ahead", never inside "Week 11 ·
        GD-4", and the icon stays with the first line.
      */}
      <h3 className="mb-1 flex items-start gap-1.5 px-1.5 text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
        <Zap size={14} strokeWidth={2.5} className="mt-px flex-none" aria-hidden="true" />
        <span>
          {t.getAhead} ·{' '}
          <span className="whitespace-nowrap">
            {t.weekRange(week.week, week.week)} · <span dir="ltr">{week.moduleCode}</span>
          </span>
        </span>
      </h3>
      {groups.map((group, i) => (
        <Fragment key={`${group.week}-${i}`}>
          {i > 0 && (
            <h4 className="mb-1 mt-3 px-1.5 text-xs font-bold uppercase tracking-widest text-cobalt-600 dark:text-lime">
              <span className="whitespace-nowrap">
                {t.weekRange(group.week, group.week)} · <span dir="ltr">{group.moduleCode}</span>
              </span>
            </h4>
          )}
          <ul className="-mx-1 space-y-0.5">
            {group.lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                checked={completedSet.has(lesson.id)}
                onToggle={() => tick(lesson)}
              />
            ))}
          </ul>
        </Fragment>
      ))}
      {moreOnArrival > 0 && (more > 0 ? moreLine(more) : <Held>{moreLine(moreOnArrival)}</Held>)}
    </div>
  )
}

/** A green all-clear; `texts`, every wording it can come to, holds its size. */
function AllClear({ text, texts }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-alxgreen/10 p-3 text-sm font-medium">
      <CheckCircle2
        size={18}
        className="mt-0.5 flex-none text-alxgreen-700 dark:text-alxgreen"
        aria-hidden="true"
      />
      {texts ? <SteadyText texts={texts}>{text}</SteadyText> : <span>{text}</span>}
    </p>
  )
}
