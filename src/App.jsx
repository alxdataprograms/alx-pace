import { useCallback, useEffect, useMemo, useState } from 'react'
import { SCHEDULE, getWeek } from './lib/schedule'
import { computePacing, progressPercent } from './lib/pacing'
import { achievedMilestones, nextToCelebrate } from './lib/milestones'
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
    learnerName,
    startDate,
    completedLessons,
    completedSet,
    updateName,
    updateStartDate,
    toggleLesson,
    setLessonsCompleted,
    resetProfile,
  } = useLearnerProfile()

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

  // Deterministic pacing: pure function of (startDate, today).
  const pacing = useMemo(() => computePacing(startDate, today), [startDate, today])

  const currentWeek = getWeek(pacing.currentWeek)
  const firstWeek = SCHEDULE.weeks[0]

  const completedCount = completedLessons.length
  const percent = progressPercent(completedSet, SCHEDULE.totalLessons)
  const gradedDone = useMemo(
    () => SCHEDULE.lessons.filter((l) => l.isGraded && completedSet.has(l.id)).length,
    [completedSet],
  )

  const { status } = pacing

  const paceStatus = useMemo(
    () => computePaceStatus(SCHEDULE, completedSet, pacing, today),
    [completedSet, pacing, today],
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
  const achieved = useMemo(() => achievedMilestones(SCHEDULE, completedSet), [completedSet])
  const milestone = useMemo(
    () => nextToCelebrate(achieved, Array.isArray(celebrated) ? celebrated : []),
    [achieved, celebrated],
  )
  const dismissMilestone = useCallback(() => {
    setCelebrated((prev) => {
      const seen = new Set(Array.isArray(prev) ? prev : [])
      for (const m of achieved) seen.add(m.id)
      return Array.from(seen)
    })
  }, [achieved, setCelebrated])

  // Anonymous usage tallies (no-ops until GOATCOUNTER_SITE is configured).
  useEffect(() => {
    trackAppOpen()
  }, [])
  useEffect(() => {
    trackPacingDaily(paceStatus)
  }, [paceStatus])

  // Mirror a pre-composed reminder message into IndexedDB (in the learner's
  // language) so the service worker can show it while the app is closed.
  useEffect(() => {
    if (status !== 'active' || !paceStatus) return
    const s = paceStatus
    const body =
      s.status === 'behind'
        ? t.reminderBehind(s.behindCount, s.gradedLeft)
        : s.gradedLeft > 0
          ? t.reminderGraded(s.gradedLeft)
          : t.reminderOnTrack(s.weekTotal - s.weekDone)
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
      {/* Brand bar */}
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlxLogo className="h-7 w-auto text-ink dark:text-paper" />
          <div className="border-s border-ink/15 ps-3 leading-none dark:border-white/20">
            <p className="text-sm font-bold tracking-tight">Pace</p>
            <p className="text-[11px] font-medium text-ink-mute dark:text-paper/70">{t.tagline}</p>
          </div>
        </div>
        <span className="alx-chip bg-lime-300 text-navy-900">{t.trackChip}</span>
      </header>

      <main className="animate-fade-up space-y-4">
        <PersonalizationWidget
          learnerName={learnerName}
          startDate={startDate}
          pacing={pacing}
          onUpdateName={updateName}
          onUpdateStartDate={updateStartDate}
        />

        {/* Where-you're-at message: behind / on-track / ahead + daily quote */}
        {status === 'active' && <PaceStatusCard paceStatus={paceStatus} today={today} />}

        {/* State machine: onboarding → future → active → completed */}
        {status === 'no-start-date' && <StartDatePrompt onSetStartDate={updateStartDate} />}

        {status === 'future' && <CountdownState pacing={pacing} firstWeek={firstWeek} />}

        {status === 'completed' && (
          <GraduationState
            completedCount={completedCount}
            totalLessons={SCHEDULE.totalLessons}
            gradedDone={gradedDone}
            totalGraded={SCHEDULE.totalGraded}
          />
        )}

        {/* Progress + focus are shown whenever there is a timeline to pace. */}
        {(status === 'active' || status === 'completed' || status === 'no-start-date') && (
          <ProgressBar completed={completedCount} total={SCHEDULE.totalLessons} percent={percent} />
        )}

        {status === 'active' && (
          <>
            <ForecastCard paceStatus={paceStatus} />
            <CurrentFocusCard week={currentWeek} completedSet={completedSet} onToggle={toggleLesson} />
            <GradedMilestonesAlert week={currentWeek} completedSet={completedSet} />
          </>
        )}

        <WeekAccordion
          schedule={SCHEDULE}
          completedSet={completedSet}
          currentWeek={pacing.currentWeek}
          onToggle={toggleLesson}
          onSetWeek={setLessonsCompleted}
        />

        <Footer theme={theme} onToggleTheme={toggleTheme} onReset={resetProfile} />
      </main>

      {/* Last in the tree so it lays over everything without needing a portal. */}
      {milestone ? (
        <MilestoneCelebration milestone={milestone} onDismiss={dismissMilestone} />
      ) : null}
    </div>
  )
}
