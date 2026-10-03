import { describe, it, expect } from 'vitest'
import { CREATIVE_TECH_TRACKS, PROGRAM_KEY, isProgramId, migrateLegacyProgram } from './programs'

/** Minimal in-memory Storage stand-in. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    get: (k) => map.get(k),
  }
}

describe('programs registry', () => {
  it('knows the three programs and the two Creative Tech tracks', () => {
    expect(isProgramId('da')).toBe(true)
    expect(isProgramId('cc')).toBe(true)
    expect(isProgramId('gd')).toBe(true)
    expect(isProgramId('')).toBe(false)
    expect(isProgramId('toString')).toBe(false)
    expect(CREATIVE_TECH_TRACKS).toEqual(['cc', 'gd'])
  })
})

describe('migrateLegacyProgram', () => {
  it('pins a learner with a start date to Data Analytics', () => {
    const s = fakeStorage({ startDate: '2026-05-01' })
    migrateLegacyProgram(s)
    expect(s.get(PROGRAM_KEY)).toBe('da')
  })

  it('pins a learner with ticked lessons to Data Analytics', () => {
    const s = fakeStorage({ completedLessons: '["da-1-w1-ways-of-work"]' })
    migrateLegacyProgram(s)
    expect(s.get(PROGRAM_KEY)).toBe('da')
  })

  it('marks a brand-new learner as "not chosen yet"', () => {
    const s = fakeStorage({ learnerName: 'Ada' })
    migrateLegacyProgram(s)
    expect(s.get(PROGRAM_KEY)).toBe('')
  })

  it('never touches an existing choice — even an empty one', () => {
    const chosen = fakeStorage({ program: 'gd', startDate: '2026-05-01' })
    migrateLegacyProgram(chosen)
    expect(chosen.get(PROGRAM_KEY)).toBe('gd')

    // A new learner who set a date before picking must not become DA.
    const unset = fakeStorage({ program: '', startDate: '2026-05-01' })
    migrateLegacyProgram(unset)
    expect(unset.get(PROGRAM_KEY)).toBe('')
  })

  it('survives corrupt storage and missing storage', () => {
    const s = fakeStorage({ completedLessons: '{not json' })
    migrateLegacyProgram(s)
    expect(s.get(PROGRAM_KEY)).toBe('')
    expect(() => migrateLegacyProgram(null)).not.toThrow()
  })
})
