import { parseISODate } from './pacing'
import { translations } from '../i18n/translations'

/**
 * Human date ("Jul 15, 2026" / "15 juil. 2026" / "15 يوليو 2026") for a Date or
 * ISO string, in one of the app's languages.
 *
 * The language's own `locale` does the formatting, so every date follows the
 * rest of its UI: Arabic's pins Western digits, as every other number there
 * is written. Plain 'ar' left them to the browser, and some versions render
 * Arabic-Indic digits (١٥). A locale string not in the translations is used
 * as it is.
 */
export function formatHumanDate(value, lang = 'en') {
  return format(value, lang, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The same without the year ("Oct 27" / "27 oct." / "27 أكتوبر"), for a date
 * near enough that the year goes without saying: the next catch-up week, at
 * most five weeks off in the current sheets.
 */
export function formatShortDate(value, lang = 'en') {
  return format(value, lang, { day: 'numeric', month: 'short' })
}

function format(value, lang, options) {
  const d = value instanceof Date ? value : parseISODate(value)
  if (!d) return String(value ?? '')
  const locale = translations[lang]?.locale ?? lang
  return d.toLocaleDateString(locale, options)
}
