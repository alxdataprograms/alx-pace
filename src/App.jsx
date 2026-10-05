import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { contentWeeksAfter, getWeek, moduleProgress, weeksBefore } from './lib/schedule'
import { PROGRAMS } from './lib/programs'
import { computePacing, progressPercent } from './lib/pacing'
import {
  achievedMilestones,
  milestoneIds,
  milestonesCrossed,
  nextToCelebrate,
  pruneCelebrated,
} from './lib/milestones'
import { computePaceStatus } from './lib/paceStatus'
import { saveReminderState } from './lib/reminderStore'
import { trackAppOpen, trackPacingDaily } from './lib/analytics'
import { useLang } from './i18n/LanguageContext'
import { useLearnerProfile } from './hooks/useLearnerProfile'
import { useTheme } from './hooks/useTheme'
import { useLocalStorage } from './hooks/useLocalStorage'

import AlxLogo from './components/AlxLogo'
import PaceStatusCard from './components/PaceStatusCard'
import AlreadyStartedCard from './components/AlreadyStartedCard'
import ForecastCard from './components/ForecastCard'
import PersonalizationWidget from './components/PersonalizationWidget'
import InAppBrowserHint from './components/InAppBrowserHint'
import ProgramPicker from './components/ProgramPicker'
import ProgressBar from './components/ProgressBar'
import CurrentFocusCard from './components/CurrentFocusCard'
import GradedMilestonesAlert from './components/GradedMilestonesAlert'
import WeekAccordion from './components/WeekAccordion'
import CountdownState from './components/CountdownState'
import GraduationState from './components/GraduationState'
import StartDatePrompt from './components/StartDatePrompt'
import Footer from './components/Footer'
import { MilestoneCelebration } from './components/MilestoneCelebration'

export default function App() {
  const { t } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  const {
    program,
    schedule,
    learnerName,
    startDate,
    completedLessons,
    completedSet,
    hasLearnerData,
    updateProgram,
    updateName,
    updateStartDate,
    toggleLesson,
    setLessonsCompleted,
    resetProfile,
  } = useLearnerProfile()

  // The picker shows until a program is chosen, and again whenever the
  // learner taps "change" on the program row.
  const [pickingProgram, setPickingProgram] = useState(false)
  const showPicker = !schedule || pickingProgram

  /*
    Focus after a setup step.

    The button a learner presses to choose a program or a start date goes
    with its card: the picker gives way to the start-date card, and that to
    the status card, the countdown or the graduation card. Focus fell to the
    page body each time, which sends a screen-reader user back to the top of
    the page after every decision. So a step hands focus, once, to the
    heading of the card that takes its place. stepHeading is that heading:
    the picker and those four cards each pass it to their own, and only one
    of them is ever on screen. Nothing moves focus on load, or when a
    countdown reaches its start day in a tab left open. (The picker's own
    Creative Tech → track step is the picker's to handle.)
  */
  const stepHeading = useRef(null)
  const stepTaken = useRef(false)
  const takeStep = () => {
    stepTaken.current = true
  }

  const selectProgram = (id) => {
    updateProgram(id)
    setPickingProgram(false)
    takeStep()
  }
  const setStartFromPrompt = (iso) => {
    updateStartDate(iso)
    takeStep()
  }
  // Reset starts the setup over, on the picker's question; the reset button
  // itself is gone once there is nothing left to reset.
  const resetAndRestart = () => {
    resetProfile()
    takeStep()
  }
  // The hero's "change" opens the picker on its heading. Cancel hands focus
  // back to "change", which stays on screen.
  const pickerOpener = useRef(null)
  const openPicker = () => {
    pickerOpener.current = document.activeElement
    // Already open, nothing re-renders to spend a step on: go straight there.
    if (pickingProgram) {
      stepHeading.current?.focus()
      return
    }
    setPickingProgram(true)
    takeStep()
  }
  const cancelPicker = () => {
    setPickingProgram(false)
    if (pickerOpener.current?.isConnected) pickerOpener.current.focus()
  }

  const programName = program ? t.programs[program] : ''

  // "Today" as state so pacing advances while the tab stays open: a minute
  // tick that only commits (and re-renders) when the calendar day changes.
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const next = new Date()
        return next.toDateString() === prev.toDateString() ? prev : next
      })
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Deterministic pacing: pure function of (startDate, today, program timeline).
  const pacing = useMemo(
    () => computePacing(startDate, today, schedule),
    [startDate, today, schedule],
  )

  const currentWeek = getWeek(schedule, pacing.currentWeek)
  // The weeks after this one with something to tick: where the focus card's
  // "Get ahead" looks once this week is done.
  const upcomingWeeks = useMemo(
    () => contentWeeksAfter(schedule, pacing.currentWeek),
    [schedule, pacing.currentWeek],
  )
  // The weeks before this one, which "Already started?" offers to tick; null
  // in the first week.
  const earlierWeeks = useMemo(
    () => weeksBefore(schedule, pacing.currentWeek),
    [schedule, pacing.currentWeek],
  )
  const firstWeek = schedule?.weeks[0] ?? null
  const totalLessons = schedule?.totalLessons ?? 0

  const completedCount = completedLessons.length
  const percent = progressPercent(completedSet, totalLessons)
  // The progress card's figures, also summed up in one line of the status card.
  // Both get this one object, so the two can never disagree.
  const progress = { completed: completedCount, total: totalLessons, percent }
  const gradedDone = useMemo(
    () =>
      schedule ? schedule.lessons.filter((l) => l.isGraded && completedSet.has(l.id)).length : 0,
    [schedule, completedSet],
  )

  const { status } = pacing
  // A start date is set: counting down to it, in a week, or past the last one.
  const hasStartDate = status === 'future' || status === 'active' || status === 'completed'
  // The course has begun, so one of its weeks is the current week.
  const hasBegun = status === 'active' || status === 'completed'

  // Pure in the schedule, the ticks and the week: today reaches it through pacing.
  const paceStatus = useMemo(
    () => (schedule ? computePaceStatus(schedule, completedSet, pacing) : null),
    [schedule, completedSet, pacing],
  )

  /*
    Creative Tech runs to 10 modules, 32 weeks and weeks of up to 31 items, so
    it is read by module: the progress card names the module of the week, and
    the roadmap folds the finished ones and leaves this week to the checklist
    (see WeekAccordion). Data Analytics' 4 modules and short weeks read as
    they always have.
  */
  const creativeTech = PROGRAMS[program]?.family === 'creative-tech'
  const weekModule = useMemo(
    () =>
      creativeTech && status === 'active'
        ? moduleProgress(schedule, pacing.currentWeek, completedSet)
        : null,
    [creativeTech, status, schedule, pacing.currentWeek, completedSet],
  )

  /*
    "Catch up now", in the status card of a learner who is behind, goes to the
    "Catch up first" section that opens the checklist: it scrolls the section
    to the top of the screen and hands focus to its heading, so a keyboard or
    screen-reader user carries on from there rather than from the button.

    The scroll follows the page's scroll-behavior: smooth, and instant for
    anyone who asked for reduced motion (index.css's one rule for that).
    Focus moves without a scroll of its own, so that one is the only movement.
  */
  const catchUpHeading = useRef(null)
  const goToCatchUp = () => {
    const heading = catchUpHeading.current
    if (!heading) return
    heading.scrollIntoView({ block: 'start' })
    heading.focus({ preventScroll: true })
  }
  // "Not yet, show me what's open" (AlreadyStartedCard) goes there too. A
  // catch-up week's whole checklist is its open items, so the list's opening
  // sentence takes the place of "Catch up first" (see CurrentFocusCard).
  // Should neither be on screen, the status card's headline, which counts
  // them, takes the focus.
  const showWhatsOpen = () => {
    if (catchUpHeading.current) goToCatchUp()
    else stepHeading.current?.focus()
  }

  /*
    Milestones.

    Achievement is DERIVED from completed lessons every render — nothing writes
    down "you finished DA-3" — so it cannot drift from the progress bar beside
    it, and it survives a lesson being un-ticked and re-ticked. The only thing
    persisted is which ones have already been SHOWN.

    Dismissing marks every currently-achieved milestone seen, not just the one
    on screen. Somebody catching up can cross two at once, and a second dialogue
    appearing the instant they close the first would be worse than either.
  */
  const [celebrated, setCelebrated] = useLocalStorage('alx-celebrated', [])
  const achieved = useMemo(
    () => achievedMilestones(schedule, completedSet, program),
    [schedule, completedSet, program],
  )
  const milestone = useMemo(
    () => nextToCelebrate(achieved, Array.isArray(celebrated) ? celebrated : []),
    [achieved, celebrated],
  )
  /*
    Keep `celebrated` a subset of what is currently achieved.

    Without this, dismissing one dialogue burns every milestone achieved at that
    moment, and un-ticking afterwards leaves those records stranded — silently
    suppressing celebrations for work the learner has yet to redo, with nothing
    on screen to explain it. See pruneCelebrated for the path that produced it.
  */
  useEffect(() => {
    // Only this program's records: `alx-celebrated` is shared by every program,
    // and another program's milestones are not "withdrawn" just because the
    // learner is looking at a different curriculum right now.
    if (!schedule) return
    const pruned = pruneCelebrated(achieved, celebrated, milestoneIds(schedule, program))
    if (pruned) setCelebrated(pruned)
  }, [schedule, program, achieved, celebrated, setCelebrated])

  const dismissMilestone = useCallback(() => {
    setCelebrated((prev) => {
      const seen = new Set(Array.isArray(prev) ? prev : [])
      for (const m of achieved) seen.add(m.id)
      return Array.from(seen)
    })
  }, [achieved, setCelebrated])

  /*
    "Already started?" (AlreadyStartedCard): "Yes" ticks what is still open in
    the weeks before this one, and records the milestones that crosses as
    shown, in the same render, so no LinkedIn dialogue opens for a module the
    learner finished on ALX weeks ago. Undo takes back exactly that: those
    items, which were open before, and those records, which were not there.
    Anything ticked or celebrated meanwhile stays, and so does every other
    program's progress, which shares both lists.

    Either answer lays out afresh the cards below it, the checklist and the
    pace card, as a new visit would (`laidOut` is in their keys). Ticks made
    elsewhere leave what those cards lay out as it was on arrival, so that
    nothing moves under the finger in the roadmap (see CurrentFocusCard); kept
    so here, "Catch up first" would stay on screen, every row struck through,
    for weeks the learner has just said are done. Nothing below this card is
    under the finger that answered it.
  */
  const [laidOut, setLaidOut] = useState(0)
  const tickWeeksBefore = useCallback(() => {
    const ids = earlierWeeks.items.filter((l) => !completedSet.has(l.id)).map((l) => l.id)
    const crossed = milestonesCrossed(schedule, completedSet, ids, program, celebrated)
    setLessonsCompleted(ids, true)
    if (crossed.length > 0) {
      setCelebrated((prev) => [...(Array.isArray(prev) ? prev : []), ...crossed])
    }
    setLaidOut((n) => n + 1)
    return { ids, crossed }
  }, [earlierWeeks, completedSet, schedule, program, celebrated, setLessonsCompleted, setCelebrated])

  const untickWeeksBefore = useCallback(
    ({ ids, crossed }) => {
      setLessonsCompleted(ids, false)
      if (crossed.length > 0) {
        setCelebrated((prev) =>
          Array.isArray(prev) ? prev.filter((id) => !crossed.includes(id)) : prev,
        )
      }
      setLaidOut((n) => n + 1)
    },
    [setLessonsCompleted, setCelebrated],
  )

  /*
    A milestone opened deliberately from the roadmap, rather than by crossing it.

    Kept separate from the automatic one so that closing it does not consume a
    celebration the learner has not been shown yet. The exception is closing a
    re-share of the very milestone that is currently pending: dismissing that
    should count, or the automatic dialogue reopens the instant this one closes.
  */
  const [manualMilestone, setManualMilestone] = useState(null)
  const shownMilestone = manualMilestone ?? milestone

  const closeMilestone = useCallback(() => {
    if (manualMilestone) {
      const wasAlsoPending = milestone?.id === manualMilestone.id
      setManualMilestone(null)
      if (wasAlsoPending) dismissMilestone()
      return
    }
    dismissMilestone()
  }, [manualMilestone, milestone, dismissMilestone])

  // See takeStep. Declared after shownMilestone, which it reads: a milestone
  // dialogue that the step brought up (switching to a program with a module
  // done but not yet celebrated) keeps the focus it took.
  useEffect(() => {
    if (!stepTaken.current) return
    stepTaken.current = false
    if (!shownMilestone) stepHeading.current?.focus()
  })

  // Anonymous usage tallies (no-ops until GOATCOUNTER_SITE is configured).
  useEffect(() => {
    trackAppOpen()
  }, [])
  useEffect(() => {
    trackPacingDaily(paceStatus, program)
  }, [paceStatus, program])

  // Mirror a pre-composed reminder message into IndexedDB (in the learner's
  // language) so the service worker can show it while the app is closed.
  useEffect(() => {
    if (status !== 'active' || !paceStatus) return
    const s = paceStatus
    const body = s.isBuffer
      ? t.reminderBuffer(s.behindCount)
      : s.status === 'behind'
        ? t.reminderBehind(s.behindCount, s.gradedLeft, s.unit)
        : s.gradedLeft > 0
          ? t.reminderGraded(s.gradedLeft)
          : t.reminderOnTrack(s.weekTotal - s.weekDone, s.unit)
    saveReminderState({ title: t.reminderTitle(s.week, s.totalWeeks), body })
  }, [status, paceStatus, t])

  // Installed-app icon badge: how many items are left in the current week.
  // Supported on Android/desktop Chromium and iOS 16.4+ home-screen apps;
  // silently a no-op everywhere else.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return
    const left = status === 'active' && currentWeek
      ? currentWeek.lessons.filter((l) => !completedSet.has(l.id)).length
      : 0
    if (left > 0) navigator.setAppBadge(left).catch(() => {})
    else navigator.clearAppBadge?.().catch(() => {})
  }, [status, currentWeek, completedSet])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 pb-6 pt-5 sm:px-5">
      {/*
        Brand bar. The logo never shrinks: when the row ran short, flexbox
        squeezed it (to 34px wide in French, from 55) before wrapping the
        tagline beside it.
      */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlxLogo className="h-7 w-auto flex-none text-ink dark:text-paper" />
          <div className="border-s border-ink/15 ps-3 leading-none dark:border-white/20">
            <p className="text-sm font-bold tracking-tight">Pace</p>
            <p className="text-[11px] font-medium text-ink-mute dark:text-paper/70">
              {t.tagline(programName)}
            </p>
          </div>
        </div>
        {/*
          On one line from 360px, the common Android width, in every language;
          the tagline beside it wraps instead. "Parcours 14 semaines" had
          broken into a two-line lozenge even at 414px. Only on a 320px screen
          may it still wrap: held to one line there, it left the tagline a
          column so narrow that French ran to five lines.
        */}
        {schedule && (
          <span className="alx-chip bg-lime-300 text-navy-900 min-[360px]:whitespace-nowrap">
            {t.trackChip(schedule.totalWeeks)}
          </span>
        )}
      </header>

      <main className="animate-fade-up space-y-4">
        {!program && <InAppBrowserHint />}

        <PersonalizationWidget
          learnerName={learnerName}
          startDate={startDate}
          pacing={pacing}
          schedule={schedule}
          program={program}
          programName={programName}
          onUpdateName={updateName}
          onUpdateStartDate={updateStartDate}
          onChangeProgram={openPicker}
        />

        {showPicker ? (
          <ProgramPicker
            program={program}
            onSelect={selectProgram}
            onCancel={schedule ? cancelPicker : undefined}
            headingRef={stepHeading}
          />
        ) : (
          <>
            {/*
              An active week puts the work before the stats: where you stand,
              then this week's checklist, then progress, pace and the graded
              card. With progress and pace above the checklist, the first
              checkbox ended 1.3 screens down (y=1084 at 375×812), so the daily
              "open the app, tick a lesson" began with a scroll; now it ends at
              y=776, on the first screen. The status card keeps the percentage
              up there in one line, and screen-reader users reach the checklist
              two cards sooner.
            */}
            {status === 'active' && (
              <>
                {/*
                  Where-you're-at: behind / on-track / ahead, a progress line,
                  daily quote. Keyed by program and week, so the catch-up row it
                  keeps for the rest of a visit starts over with a new week.
                */}
                <PaceStatusCard
                  key={`${program}:${pacing.currentWeek}`}
                  paceStatus={paceStatus}
                  progress={progress}
                  today={today}
                  headingRef={stepHeading}
                  onCatchUp={goToCatchUp}
                />
                {/*
                  Past the first week with nothing in the program ticked, the
                  question about the weeks before, under the status card that
                  counts them. Offered on arrival and kept for the visit, so it
                  is keyed like the status card, by program and week.
                */}
                {earlierWeeks && (
                  <AlreadyStartedCard
                    key={`started:${program}:${pacing.currentWeek}`}
                    offered={completedCount === 0}
                    week={pacing.currentWeek}
                    from={earlierWeeks.from}
                    to={earlierWeeks.to}
                    programName={programName}
                    unit={paceStatus?.unit}
                    onYes={tickWeeksBefore}
                    onUndo={untickWeeksBefore}
                    onNotYet={showWhatsOpen}
                  />
                )}
                {/*
                  Keyed like the status card: what the card lays out is decided
                  on arrival in each week (see CurrentFocusCard).
                */}
                <CurrentFocusCard
                  key={`focus:${program}:${pacing.currentWeek}:${laidOut}`}
                  week={currentWeek}
                  completedSet={completedSet}
                  onToggle={toggleLesson}
                  catchUp={paceStatus?.behindItems}
                  catchUpRef={catchUpHeading}
                  unit={paceStatus?.unit}
                  upcoming={upcomingWeeks}
                  nextCatchUp={paceStatus?.nextCatchUp}
                />
                <ProgressBar {...progress} currentModule={weekModule} />
                <ForecastCard
                  key={`forecast:${program}:${pacing.currentWeek}:${laidOut}`}
                  paceStatus={paceStatus}
                />
                {/*
                  Keyed like the status card: whether the week's graded items
                  were all done on arrival is decided afresh for a new week.
                */}
                {!currentWeek?.isBuffer && (
                  <GradedMilestonesAlert
                    key={`graded:${program}:${pacing.currentWeek}`}
                    week={currentWeek}
                    completedSet={completedSet}
                  />
                )}
              </>
            )}

            {/*
              State machine: onboarding → future → active → completed. The
              states without a week to work on keep their own card first.
            */}
            {status === 'no-start-date' && (
              <StartDatePrompt
                onSetStartDate={setStartFromPrompt}
                schedule={schedule}
                programName={programName}
                headingRef={stepHeading}
              />
            )}

            {status === 'future' && (
              <CountdownState
                pacing={pacing}
                firstWeek={firstWeek}
                schedule={schedule}
                program={program}
                programName={programName}
                headingRef={stepHeading}
              />
            )}

            {status === 'completed' && (
              <GraduationState
                completedCount={completedCount}
                totalLessons={totalLessons}
                gradedDone={gradedDone}
                totalGraded={schedule.totalGraded}
                totalWeeks={schedule.totalWeeks}
                unit={schedule.itemNoun}
                headingRef={stepHeading}
              />
            )}

            {/* Without a week to work on, overall progress follows the state's own card. */}
            {(status === 'completed' || status === 'no-start-date') && (
              <ProgressBar {...progress} />
            )}

            {/*
              No week is "Current" before the course begins. Pacing points at
              Week 1 then, as the week to come, and passing that on badged it
              "Current" and opened it under "Course begins in 10 days".

              Keyed by program, so switching lays out the new program's roadmap
              afresh, and by whether the course has begun, so a countdown that
              reaches its start day in a tab left open flags Week 1 at midnight
              (and in Data Analytics opens it), as a fresh visit would.
            */}
            <WeekAccordion
              key={`${program}:${hasBegun ? 'begun' : 'not-begun'}`}
              schedule={schedule}
              completedSet={completedSet}
              currentWeek={hasBegun ? pacing.currentWeek : null}
              onToggle={toggleLesson}
              onSetWeek={setLessonsCompleted}
              achieved={achieved}
              onShare={setManualMilestone}
              creativeTech={creativeTech}
            />
          </>
        )}

        {/*
          The footer offers only what applies yet. Reminders wait for a start
          date: before one there is no week to remind anyone about. Reset waits
          for something to reset, and stays for as long as any of it exists.
        */}
        <Footer
          theme={theme}
          onToggleTheme={toggleTheme}
          onReset={hasLearnerData ? resetAndRestart : undefined}
          showReminders={hasStartDate}
          programName={programName}
        />
      </main>

      {/*
        Last in the tree so it lays over everything without needing a portal;
        the dialogue makes its siblings, the page, inert while it is open.
        Keyed by milestone, so one that follows another (closing a re-share
        while another is pending) opens as a dialogue of its own: announced,
        on its primary action, still handing focus back to the original
        opener when it closes.
      */}
      {shownMilestone ? (
        <MilestoneCelebration
          key={shownMilestone.id}
          milestone={shownMilestone}
          onDismiss={closeMilestone}
        />
      ) : null}
    </div>
  )
}
