import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './i18n/LanguageContext'
import { translations } from './i18n/translations'
import { runHandoff } from './lib/handoff'
import { SCHEDULE } from './lib/schedule'
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
    validLessonIds: new Set(SCHEDULE.lessons.map((l) => l.id)),
    validLangs: new Set(Object.keys(translations)),
  })
} catch {
  /* no storage — the app still runs, the learner re-enters their start date */
}

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
