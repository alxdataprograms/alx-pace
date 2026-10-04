import { useCallback, useEffect, useMemo, useState } from 'react'
import { getWeek } from './lib/schedule'
import { computePacing, progressPercent } from './lib/pacing'
import { achievedMilestones, milestoneIds, nextToCelebrate, pruneCelebrated } from './lib/milestones'
import { computePaceStatus } from './lib/paceStatus'
import { saveReminderState } from './lib/reminderStore'
import { trackAppOpen, trackPacingDaily } from './lib/analytics'
import { useLang } from './i18n/LanguageContext'
import { useLearnerProfile } from './hooks/useLearnerProfile'
import { useTheme } from './hooks/useTheme'
import { useLocalStorage } from './hooks/useLocalStorage'

import AlxLogo from './components/AlxLogo'
import PaceStatusCard from './components/PaceStatusCard'
import ForecastCard from './components/ForecastCard'
import PersonalizationWidget from './components/PersonalizationWidget'
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
  const selectProgram = (id) => {
    updateProgram(id)
    setPickingProgram(false)
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

  const paceStatus = useMemo(
    () => (schedule ? computePaceStatus(schedule, completedSet, pacing, today) : null),
    [schedule, completedSet, pacing, today],
  )

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
        <PersonalizationWidget
          learnerName={learnerName}
          startDate={startDate}
          pacing={pacing}
          schedule={schedule}
          program={program}
          programName={programName}
          onUpdateName={updateName}
          onUpdateStartDate={updateStartDate}
          onChangeProgram={() => setPickingProgram(true)}
        />

        {showPicker ? (
          <ProgramPicker
            program={program}
            onSelect={selectProgram}
            onCancel={schedule ? () => setPickingProgram(false) : undefined}
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
                {/* Where-you're-at: behind / on-track / ahead, a progress line, daily quote */}
                <PaceStatusCard paceStatus={paceStatus} progress={progress} today={today} />
                <CurrentFocusCard
                  week={currentWeek}
                  completedSet={completedSet}
                  onToggle={toggleLesson}
                  catchUp={paceStatus?.behindItems}
                />
                <ProgressBar {...progress} />
                <ForecastCard paceStatus={paceStatus} />
                {!currentWeek?.isBuffer && (
                  <GradedMilestonesAlert week={currentWeek} completedSet={completedSet} />
                )}
              </>
            )}

            {/*
              State machine: onboarding → future → active → completed. The
              states without a week to work on keep their own card first.
            */}
            {status === 'no-start-date' && (
              <StartDatePrompt
                onSetStartDate={updateStartDate}
                schedule={schedule}
                programName={programName}
              />
            )}

            {status === 'future' && (
              <CountdownState
                pacing={pacing}
                firstWeek={firstWeek}
                schedule={schedule}
                program={program}
                programName={programName}
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

              Keyed by program, so switching re-opens the new current week, and
              by whether the course has begun, so a countdown that reaches its
              start day in a tab left open opens Week 1 at midnight, as a fresh
              visit would.
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
          onReset={hasLearnerData ? resetProfile : undefined}
          showReminders={hasStartDate}
          programName={programName}
        />
      </main>

      {/* Last in the tree so it lays over everything without needing a portal. */}
      {shownMilestone ? (
        <MilestoneCelebration milestone={shownMilestone} onDismiss={closeMilestone} />
      ) : null}
    </div>
  )
}
