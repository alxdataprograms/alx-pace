import { translations } from '../i18n/translations'

/**
 * ALX motivational slogans, localized. The pick is deterministic (keyed off
 * the week number) so it never flickers between renders within the same week.
 */

/** Deterministic slogan for a given week (1-based) in the given language. */
export function sloganForWeek(week, lang = 'en') {
  const list = (translations[lang] || translations.en).slogans
  // floor: fractional weeks ("Week 13.5") share their whole week's slogan.
  const w = Math.floor(Math.max(1, Number(week) || 1))
  const idx = (((w - 1) % list.length) + list.length) % list.length
  return list[idx]
}
