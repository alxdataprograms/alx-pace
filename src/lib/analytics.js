import { GOATCOUNTER_SITE } from './analyticsConfig'

/**
 * Anonymous, cookieless usage tallies via GoatCounter's pixel API.
 *
 * Deliberately NOT the vendor <script>: we fire plain GET beacons ourselves,
 * so no third-party code ever executes in the app, nothing is stored on the
 * device for tracking, and the beacon silently no-ops offline. Aggregate
 * counts only — no ids, no names, nothing that can identify a learner.
 */

function enabled() {
  return (
    Boolean(GOATCOUNTER_SITE) &&
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !navigator.webdriver &&
    navigator.doNotTrack !== '1' &&
    !navigator.globalPrivacyControl
  )
}

function send(path, { event = true } = {}) {
  if (!enabled()) return
  try {
    const params = new URLSearchParams({
      p: path,
      e: event ? 'true' : 'false',
      rnd: String(Date.now()),
    })
    fetch(`https://${GOATCOUNTER_SITE}.goatcounter.com/count?${params}`, {
      mode: 'no-cors',
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  } catch {
    /* analytics must never break the app */
  }
}

/** One pageview per app open, plus how the app is running. */
export function trackAppOpen() {
  send('/', { event: false })
  const standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true // iOS Safari
  send(standalone ? 'open-installed' : 'open-browser')
}

/**
 * Aggregate pacing snapshot — at most once per device per calendar day, so
 * the dashboard reads as "daily active learners in program P / at week N /
 * status X". DA keeps its original bare `week-N` event names so existing
 * dashboards stay continuous; other programs prefix theirs (`cc-week-N`).
 */
export function trackPacingDaily(paceStatus, program = 'da') {
  if (!enabled() || !paceStatus) return
  try {
    const today = new Date().toDateString()
    if (window.localStorage.getItem('alx-metrics-day') === today) return
    window.localStorage.setItem('alx-metrics-day', today)
  } catch {
    return // storage unavailable — skip rather than over-count
  }
  send(`program-${program}`)
  send(program === 'da' ? `week-${paceStatus.week}` : `${program}-week-${paceStatus.week}`)
  send(`status-${paceStatus.status}`)
}
