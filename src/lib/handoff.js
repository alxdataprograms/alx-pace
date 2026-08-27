/**
 * Carrying a learner's progress across an origin change.
 *
 * WHY THIS FILE EXISTS
 * localStorage is scoped to the origin. Moving the app from one GitHub Pages
 * account to another changes the hostname, and every learner's start date and
 * completed lessons would simply cease to exist — silently, with no error and
 * nothing to restore from. The only party that can read the old origin's
 * storage is a page served BY the old origin, so the handoff has to be:
 *
 *     old origin reads storage → encodes into a URL fragment → new origin
 *     decodes it on first load.
 *
 * A fragment, not a query string: fragments are never sent to the server, so a
 * learner's name never reaches GitHub's logs. There is no server in this
 * architecture and this keeps it that way.
 *
 * WHAT DELIBERATELY DOES NOT TRAVEL
 * Two keys are excluded on purpose, and the exclusions matter more than the
 * inclusions:
 *
 *   alx-reminders    records that the learner granted notification permission
 *                    and registered a sync. Permission is origin-scoped and
 *                    does NOT survive the move. Carrying the flag across would
 *                    leave the app claiming reminders are on while the new
 *                    origin holds no permission and no registration — a
 *                    promise of a weekly nudge that can never fire.
 *
 *   alx-metrics-day  the once-per-day analytics dedupe stamp. Carrying it
 *                    would suppress the learner's first day on the new origin
 *                    from the counts, understating exactly the number this
 *                    move is meant to let us watch.
 *
 * THE CODEC IS MIRRORED IN bridge/index.html
 * The bridge page cannot import from here — it is a single dependency-free
 * file served by a different repository. handoff.test.js reads that file off
 * disk, extracts its inlined encoder and asserts it round-trips against the
 * decoder below, so the two cannot drift apart unnoticed.
 */

/** Fragment key, e.g. #alx-handoff=eyJ2Ijox... */
export const HANDOFF_PARAM = 'alx-handoff'

/** Set once a handoff has been applied, so a bookmarked link cannot re-apply. */
export const HANDOFF_DONE_KEY = 'alx-handoff-done'

/** Exactly the keys that travel. See the note above on the two that do not. */
export const HANDOFF_KEYS = Object.freeze([
  'learnerName',
  'startDate',
  'completedLessons',
  'alx-theme',
  'alx-lang',
])

/*
  A ceiling on what will be decoded at all. A full profile — name, date and all
  27 lesson ids — encodes to well under 1 KB; 16 KB is generous enough that no
  real learner can hit it and small enough that a hand-edited fragment cannot
  make us parse megabytes.
*/
const MAX_ENCODED_CHARS = 16_384

/*
  base64url over UTF-8 bytes. Not plain btoa(): learner names contain accented
  and Arabic characters, and btoa() throws on any codepoint above U+00FF, which
  would have failed precisely for the learners the localisation work exists to
  serve.
*/
export function encodeHandoff(payload) {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Returns the decoded object, or null for anything malformed. Never throws. */
export function decodeHandoff(encoded) {
  if (typeof encoded !== 'string' || !encoded || encoded.length > MAX_ENCODED_CHARS) return null
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const value = JSON.parse(new TextDecoder().decode(bytes))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/*
  Everything below validates and applies a decoded handoff. It is written
  against plain objects — no React, no globals — so the merge rules can be
  tested directly rather than inferred from behaviour in a browser.
*/

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_NAME_CHARS = 80
const THEMES = new Set(['light', 'dark'])

/**
 * Keeps only what is provably valid, and drops the rest silently.
 *
 * The fragment arrives from another origin and is trivially hand-editable, so
 * nothing here trusts it. Lesson ids are checked against the schedule this
 * build actually ships, which means a stale link cannot resurrect a lesson id
 * that no longer exists — the same guarantee useLearnerProfile already gives
 * storage written locally.
 */
export function sanitizeHandoff(raw, { validLessonIds, validLangs } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const lessons = validLessonIds instanceof Set ? validLessonIds : new Set(validLessonIds ?? [])
  const langs = validLangs instanceof Set ? validLangs : new Set(validLangs ?? [])
  const out = {}

  if (typeof raw.learnerName === 'string') {
    const name = raw.learnerName.trim().slice(0, MAX_NAME_CHARS)
    if (name) out.learnerName = name
  }

  /*
    A date that fails this check is dropped rather than corrected. Guessing at
    a learner's start date would put them in the wrong week of a 14-week plan,
    which is worse than asking them for it again.
  */
  if (typeof raw.startDate === 'string' && ISO_DATE.test(raw.startDate)) {
    const [y, m, d] = raw.startDate.split('-').map(Number)
    const probe = new Date(y, m - 1, d)
    const roundTrips =
      probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d
    if (roundTrips) out.startDate = raw.startDate
  }

  if (Array.isArray(raw.completedLessons)) {
    const ids = Array.from(
      new Set(raw.completedLessons.filter((id) => typeof id === 'string' && lessons.has(id))),
    )
    if (ids.length) out.completedLessons = ids
  }

  if (typeof raw['alx-theme'] === 'string' && THEMES.has(raw['alx-theme'])) {
    out['alx-theme'] = raw['alx-theme']
  }

  if (typeof raw['alx-lang'] === 'string' && langs.has(raw['alx-lang'])) {
    out['alx-lang'] = raw['alx-lang']
  }

  return out
}

/**
 * Writes a sanitized handoff into storage.
 *
 * MERGE RULES, and why they are asymmetric.
 *
 * Completed lessons are UNIONED. Anything else risks un-ticking work the
 * learner really did, and a lesson wrongly ticked costs them one click to
 * correct while a lesson wrongly cleared is indistinguishable from work they
 * never did.
 *
 * Every other key is written only if the new origin has nothing there. A
 * learner who has already set a start date here has told us something more
 * recent than an old link does, and a stale bookmark must not overwrite it.
 *
 * Runs at most once per device: the marker key is checked first and set last.
 */
export function applyHandoff(clean, storage) {
  const result = { applied: false, keys: [], reason: null }
  if (!storage) {
    result.reason = 'no-storage'
    return result
  }

  try {
    if (storage.getItem(HANDOFF_DONE_KEY)) {
      result.reason = 'already-applied'
      return result
    }

    for (const key of HANDOFF_KEYS) {
      if (!(key in clean)) continue

      if (key === 'completedLessons') {
        let existing = []
        try {
          const stored = JSON.parse(storage.getItem('completedLessons') ?? '[]')
          if (Array.isArray(stored)) existing = stored.filter((x) => typeof x === 'string')
        } catch {
          existing = []
        }
        const merged = Array.from(new Set([...existing, ...clean.completedLessons]))
        if (merged.length !== existing.length) {
          storage.setItem('completedLessons', JSON.stringify(merged))
          result.keys.push(key)
        }
        continue
      }

      // Raw string keys — written exactly as useLocalStorage({raw:true}) does,
      // with no JSON quoting, or the app would read back a quoted string.
      const current = storage.getItem(key)
      if (current === null || current === '') {
        storage.setItem(key, String(clean[key]))
        result.keys.push(key)
      }
    }

    storage.setItem(HANDOFF_DONE_KEY, new Date().toISOString().slice(0, 10))
    result.applied = result.keys.length > 0
    return result
  } catch {
    // Private mode, quota, disabled storage. The app still runs; the learner
    // re-enters their date. Never let a migration break the page.
    result.reason = 'storage-unavailable'
    return result
  }
}

/** Reads the encoded handoff out of a location's fragment, if present. */
export function readHandoff(hash) {
  if (typeof hash !== 'string' || !hash) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.get(HANDOFF_PARAM)
}

/**
 * The whole flow, called once before React mounts.
 *
 * Ordering is load-bearing: useLocalStorage reads storage in a useState
 * initialiser, which runs once at mount and never re-reads. Applying the
 * handoff after render would leave the learner staring at an empty app with
 * their restored data sitting in storage until they reloaded.
 */
export function runHandoff({ location, history, storage, validLessonIds, validLangs }) {
  try {
    const encoded = readHandoff(location?.hash)
    if (!encoded) return { applied: false, keys: [], reason: 'no-handoff' }

    const result = applyHandoff(
      sanitizeHandoff(decodeHandoff(encoded), { validLessonIds, validLangs }),
      storage,
    )

    // Strip the fragment either way, so a refresh or a shared screenshot of
    // the URL bar does not carry the learner's name around.
    if (history?.replaceState) {
      history.replaceState(null, '', location.pathname + location.search)
    }
    return result
  } catch {
    return { applied: false, keys: [], reason: 'error' }
  }
}
