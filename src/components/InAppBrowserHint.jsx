import { ExternalLink } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import { isLinkedInInApp } from '../lib/install'

/**
 * One line for learners who opened Pace from inside LinkedIn's app.
 *
 * Most first visits arrive from a classmate's milestone post, so many open
 * in LinkedIn's built-in browser. That browser keeps its own storage, apart
 * from the phone's: progress saved there is not in Chrome or Safari, and not
 * in an installed app, the next time the learner opens Pace. Nothing would
 * tell them, until a week of ticks appeared to have vanished.
 *
 * Only on the first screen, before a program is chosen (App decides), so a
 * learner is told before they start rather than nagged afterwards. Detected
 * from the user agent LinkedIn sets on its own browser; where LinkedIn hands
 * links to the phone's browser instead, the agent is the browser's own and
 * nothing shows.
 */
export default function InAppBrowserHint() {
  const { t } = useLang()
  if (!isLinkedInInApp()) return null

  return (
    <p className="flex items-start gap-2 rounded-xl bg-lime-300 px-3 py-2 text-sm font-semibold text-navy-900">
      <ExternalLink size={16} className="mt-0.5 flex-none" aria-hidden="true" />
      <span>{t.openInBrowser}</span>
    </p>
  )
}
