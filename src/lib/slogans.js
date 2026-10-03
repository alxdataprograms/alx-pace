import { translations } from '../i18n/translations'
import { PROGRAMS } from './programs'

/**
 * ALX motivational slogans, localized. The pick is deterministic (keyed off
 * the week number) so it never flickers between renders within the same week.
 */

/**
 * Deterministic slogan for a given week (1-based) in the given language.
 *
 * Creative Tech draws from its own list, which differs only where a slogan is
 * about data ("Small Steps, Big Data"). Data Analytics — and anything with no
 * program yet — keeps the original list, so DA learners see what they always did.
 */
export function sloganForWeek(week, lang = 'en', program = 'da') {
  const t = translations[lang] || translations.en
  const list = PROGRAMS[program]?.family === 'creative-tech' ? t.slogansCreative : t.slogans
  // floor: fractional weeks ("Week 13.5") share their whole week's slogan.
  const w = Math.floor(Math.max(1, Number(week) || 1))
  const idx = (((w - 1) % list.length) + list.length) % list.length
  return list[idx]
}
