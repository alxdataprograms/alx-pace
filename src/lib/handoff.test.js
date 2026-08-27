import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  HANDOFF_DONE_KEY,
  applyHandoff,
  decodeHandoff,
  encodeHandoff,
  readHandoff,
  runHandoff,
  sanitizeHandoff,
} from './handoff'
import { SCHEDULE } from './schedule'
import { translations } from '../i18n/translations'

const LESSON_IDS = new Set(SCHEDULE.lessons.map((l) => l.id))
const LANGS = new Set(Object.keys(translations))
const SOME_LESSON = SCHEDULE.lessons[0].id
const ANOTHER_LESSON = SCHEDULE.lessons[1].id

/** Minimal localStorage stand-in with the same string-in/string-out contract. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map),
  }
}

describe('codec', () => {
  it('round-trips a full profile', () => {
    const payload = {
      learnerName: 'Kayode',
      startDate: '2026-01-15',
      completedLessons: [SOME_LESSON, ANOTHER_LESSON],
      'alx-theme': 'dark',
      'alx-lang': 'fr',
    }
    expect(decodeHandoff(encodeHandoff(payload))).toEqual(payload)
  })

  it('survives non-Latin names — btoa alone would throw on these', () => {
    for (const name of ['عبد الرحمن', 'Aminata Diallo', 'Chikaodinaka Ọbiọma', '日本語']) {
      expect(decodeHandoff(encodeHandoff({ learnerName: name })).learnerName).toBe(name)
    }
  })

  it('is URL-fragment safe — no +, / or = in the output', () => {
    const encoded = encodeHandoff({ learnerName: 'ÿÿÿ?>~', completedLessons: [SOME_LESSON] })
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns null rather than throwing on anything malformed', () => {
    for (const bad of ['', 'not-base64!!', 'eyJ', null, undefined, 42, 'W10', 'IjEi']) {
      expect(decodeHandoff(bad)).toBeNull()
    }
  })

  it('refuses an oversized fragment instead of parsing it', () => {
    expect(decodeHandoff('A'.repeat(16_385))).toBeNull()
  })
})

/*
  The bridge page is served from a different repository and cannot import from
  this module, so its encoder is a hand-mirrored copy. This is what stops the
  copy from silently drifting: the block between the sentinels is extracted and
  round-tripped against the decoder the app actually ships.
*/
describe("the bridge page's inlined encoder", () => {
  const html = readFileSync(fileURLToPath(new URL('../../bridge/index.html', import.meta.url)), 'utf8')

  it('is present and delimited', () => {
    expect(html).toContain('/* handoff-codec:start')
    expect(html).toContain('/* handoff-codec:end */')
  })

  it('produces output this module can decode', () => {
    const source = html.split('/* handoff-codec:start')[1].split('/* handoff-codec:end */')[0]
    const body = source.slice(source.indexOf('*/') + 2)
    const bridgeEncode = new Function(`${body}; return encodeHandoff`)()

    const payload = {
      learnerName: 'عبد الرحمن',
      startDate: '2026-03-02',
      completedLessons: [SOME_LESSON],
      'alx-theme': 'dark',
      'alx-lang': 'ar',
    }
    expect(bridgeEncode(payload)).toBe(encodeHandoff(payload))
    expect(decodeHandoff(bridgeEncode(payload))).toEqual(payload)
  })

  it('points at the new home and carries no query string', () => {
    expect(html).toContain('https://alxdataprograms.github.io/alx-pace/')
    expect(html).toContain("'#alx-handoff='")
  })

  it('leaves the origin-scoped keys behind', () => {
    const keyLine = html.split('var KEYS =')[1].split('\n')[0]
    expect(keyLine).not.toContain('alx-reminders')
    expect(keyLine).not.toContain('alx-metrics-day')
  })
})

describe('sanitizeHandoff', () => {
  const opts = { validLessonIds: LESSON_IDS, validLangs: LANGS }

  it('keeps only lesson ids this build actually ships', () => {
    const out = sanitizeHandoff(
      { completedLessons: [SOME_LESSON, 'da-9-w99-invented', 42, null, SOME_LESSON] },
      opts,
    )
    expect(out.completedLessons).toEqual([SOME_LESSON])
  })

  it('drops a date that does not exist rather than correcting it', () => {
    expect(sanitizeHandoff({ startDate: '2026-02-30' }, opts).startDate).toBeUndefined()
    expect(sanitizeHandoff({ startDate: '2026-13-01' }, opts).startDate).toBeUndefined()
    expect(sanitizeHandoff({ startDate: '15/01/2026' }, opts).startDate).toBeUndefined()
    expect(sanitizeHandoff({ startDate: '2026-02-28' }, opts).startDate).toBe('2026-02-28')
  })

  it('rejects an unsupported theme or language', () => {
    expect(sanitizeHandoff({ 'alx-theme': 'neon' }, opts)['alx-theme']).toBeUndefined()
    expect(sanitizeHandoff({ 'alx-lang': 'xx' }, opts)['alx-lang']).toBeUndefined()
    expect(sanitizeHandoff({ 'alx-lang': 'ar' }, opts)['alx-lang']).toBe('ar')
  })

  it('trims and caps a name, and drops an empty one', () => {
    expect(sanitizeHandoff({ learnerName: '  Kayode  ' }, opts).learnerName).toBe('Kayode')
    expect(sanitizeHandoff({ learnerName: '   ' }, opts).learnerName).toBeUndefined()
    expect(sanitizeHandoff({ learnerName: 'x'.repeat(500) }, opts).learnerName).toHaveLength(80)
  })

  it('ignores keys that are not part of the contract', () => {
    const out = sanitizeHandoff({ 'alx-reminders': 'periodic', evil: true }, opts)
    expect(out).toEqual({})
  })

  it('never throws on hostile input', () => {
    for (const bad of [null, undefined, [], 'string', 42, { completedLessons: 'nope' }]) {
      expect(() => sanitizeHandoff(bad, opts)).not.toThrow()
    }
  })
})

describe('applyHandoff', () => {
  const clean = {
    learnerName: 'Kayode',
    startDate: '2026-01-15',
    completedLessons: [SOME_LESSON],
    'alx-theme': 'dark',
    'alx-lang': 'fr',
  }

  it('writes raw strings unquoted, the way useLocalStorage reads them', () => {
    const storage = fakeStorage()
    applyHandoff(clean, storage)
    expect(storage.getItem('learnerName')).toBe('Kayode')
    expect(storage.getItem('startDate')).toBe('2026-01-15')
    expect(storage.getItem('alx-theme')).toBe('dark')
    expect(JSON.parse(storage.getItem('completedLessons'))).toEqual([SOME_LESSON])
  })

  it('never overwrites a start date the learner already set here', () => {
    const storage = fakeStorage({ startDate: '2026-06-01' })
    const result = applyHandoff(clean, storage)
    expect(storage.getItem('startDate')).toBe('2026-06-01')
    expect(result.keys).not.toContain('startDate')
  })

  it('unions completed lessons rather than replacing them', () => {
    const storage = fakeStorage({ completedLessons: JSON.stringify([ANOTHER_LESSON]) })
    applyHandoff(clean, storage)
    expect(JSON.parse(storage.getItem('completedLessons')).sort()).toEqual(
      [SOME_LESSON, ANOTHER_LESSON].sort(),
    )
  })

  it('recovers from a corrupt completedLessons rather than throwing it away silently', () => {
    const storage = fakeStorage({ completedLessons: '{not json' })
    applyHandoff(clean, storage)
    expect(JSON.parse(storage.getItem('completedLessons'))).toEqual([SOME_LESSON])
  })

  it('applies at most once, so a bookmarked link cannot re-tick cleared lessons', () => {
    const storage = fakeStorage()
    expect(applyHandoff(clean, storage).applied).toBe(true)
    storage.setItem('completedLessons', JSON.stringify([]))
    const second = applyHandoff(clean, storage)
    expect(second.applied).toBe(false)
    expect(second.reason).toBe('already-applied')
    expect(JSON.parse(storage.getItem('completedLessons'))).toEqual([])
  })

  it('marks itself done even when the handoff carried nothing new', () => {
    const storage = fakeStorage()
    applyHandoff({}, storage)
    expect(storage.getItem(HANDOFF_DONE_KEY)).toBeTruthy()
  })

  it('degrades quietly when storage throws', () => {
    const hostile = {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('SecurityError') },
    }
    expect(() => applyHandoff(clean, hostile)).not.toThrow()
    expect(applyHandoff(clean, hostile).reason).toBe('storage-unavailable')
    expect(applyHandoff(clean, null).reason).toBe('no-storage')
  })
})

describe('readHandoff', () => {
  it('finds the payload in a fragment', () => {
    expect(readHandoff('#alx-handoff=abc')).toBe('abc')
    expect(readHandoff('#other=1&alx-handoff=abc')).toBe('abc')
  })

  it('returns null when there is none', () => {
    for (const hash of ['', '#', '#other=1', null, undefined]) {
      expect(readHandoff(hash)).toBeNull()
    }
  })
})

describe('runHandoff', () => {
  const location = (hash) => ({ hash, pathname: '/alx-pace/', search: '' })

  it('restores a learner and then strips the fragment from the URL', () => {
    const storage = fakeStorage()
    const replaced = []
    const result = runHandoff({
      location: location(`#alx-handoff=${encodeHandoff({ startDate: '2026-01-15' })}`),
      history: { replaceState: (_s, _t, url) => replaced.push(url) },
      storage,
      validLessonIds: LESSON_IDS,
      validLangs: LANGS,
    })
    expect(result.applied).toBe(true)
    expect(storage.getItem('startDate')).toBe('2026-01-15')
    expect(replaced).toEqual(['/alx-pace/'])
  })

  it('strips the fragment even when the payload was garbage', () => {
    const replaced = []
    runHandoff({
      location: location('#alx-handoff=not-real'),
      history: { replaceState: (_s, _t, url) => replaced.push(url) },
      storage: fakeStorage(),
      validLessonIds: LESSON_IDS,
      validLangs: LANGS,
    })
    expect(replaced).toEqual(['/alx-pace/'])
  })

  it('does nothing at all on an ordinary visit', () => {
    const storage = fakeStorage()
    const result = runHandoff({
      location: location(''),
      history: { replaceState: () => {} },
      storage,
      validLessonIds: LESSON_IDS,
      validLangs: LANGS,
    })
    expect(result.reason).toBe('no-handoff')
    expect(storage._dump()).toEqual({})
  })
})
