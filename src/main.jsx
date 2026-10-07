import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { runHandoff } from './lib/handoff'
import { captureInstallPrompt } from './lib/install'
import { PROGRAMS, migrateLegacyProgram } from './lib/programs'
import { SCHEDULES } from './lib/schedule'
import './index.css'

/*
  Restore a learner arriving from the app's previous origin — BEFORE React
  mounts. useLocalStorage reads storage in a useState initialiser, which runs
  once and never re-reads, so a handoff applied after render would sit in
  storage invisibly until the learner happened to reload.

  Reading window.localStorage can itself throw when a browser is set to block
  site data, so the property access is inside the try, not just its use.
*/
try {
  runHandoff({
    location: window.location,
    history: window.history,
    storage: window.localStorage,
    // The old address only ever paced Data Analytics, but validating against
    // every shipped program costs nothing and keeps the check honest.
    validLessonIds: new Set(Object.values(SCHEDULES).flatMap((s) => s.lessons.map((l) => l.id))),
    validLangs: new Set(Object.keys(translations)),
  })
} catch {
  /* no storage — the app still runs, the learner re-enters their start date */
}

/*
  AFTER the handoff, never before. Learners from the Data-Analytics-only era
  keep their tracker exactly as it was (pinned to DA); new learners see the
  program picker. Run first, it would find a handoff arrival's storage still
  empty, record "no program chosen", and greet a DA learner with the picker.
  Idempotent — once the key exists it is never touched again.
*/
try {
  migrateLegacyProgram(window.localStorage)
  const currentProgram = window.localStorage.getItem('program')
  if (currentProgram && PROGRAMS[currentProgram]?.hidden) {
    window.localStorage.setItem('program', 'da')
  }
} catch {
  /* storage blocked — the picker simply shows */
}

/*
  Before the first render too: Chromium fires its one install prompt whenever
  it decides the page is installable, which can precede the footer that offers
  the button. Held in src/lib/install.js until the learner asks for it.
*/
captureInstallPrompt(window)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)

// PWA: offline support + installability. Production only, so dev never
// serves stale bundles from the service-worker cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* SW is an enhancement — the app works fully without it */
    })
  })
}
