import { useState } from 'react'
import { Bell, BellRing, X } from 'lucide-react'
import { enableReminders, reminderSupported } from '../lib/reminders'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLang } from '../i18n/LanguageContext'
import { REMINDERS_LAPSED_KEY } from '../lib/handoff'

/**
 * Opt-in for weekly reminder notifications. Renders nothing on browsers with
 * no notification support (e.g. iOS Safari before Add to Home Screen).
 *
 * Also carries the one apology this app owes anyone who was using it before the
 * move. Notification permission is granted per origin, so a learner who had
 * reminders switched on at the previous address arrives here with them off and
 * no way to know why — their Monday nudge simply stops. The handoff refuses to
 * carry the flag itself (that would claim reminders are on while nothing is
 * registered to send them) and instead leaves a note, which is read here and
 * can only ever produce a prompt.
 */
export default function ReminderToggle() {
  const { t } = useLang()
  const [mode, setMode] = useLocalStorage('alx-reminders', '', { raw: true })
  const [lapsed, setLapsed] = useLocalStorage(REMINDERS_LAPSED_KEY, '', { raw: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!reminderSupported()) return null

  if (mode) {
    return (
      <p className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold text-alxgreen-700 dark:text-alxgreen">
        <BellRing size={13} aria-hidden="true" />
        {mode === 'granted' ? t.notificationsAllowed : t.remindersOn}
      </p>
    )
  }

  const onEnable = async () => {
    setBusy(true)
    setError('')
    const result = await enableReminders()
    setBusy(false)
    if (result.ok) {
      setMode(result.mode)
      // The prompt has done its job; never show it again on this device.
      setLapsed('')
    } else if (result.reason === 'denied') setError(t.remindersBlocked)
  }

  return (
    <div>
      {lapsed ? (
        <p
          role="status"
          className="mb-2 flex max-w-xs items-start gap-2 text-[11px] leading-snug text-ink-soft dark:text-paper/70"
        >
          <span>{t.remindersLapsed}</span>
          <button
            type="button"
            onClick={() => setLapsed('')}
            aria-label={t.dismiss}
            className="-m-2 shrink-0 p-2 text-ink-soft/70 hover:text-ink-soft dark:text-paper/50 dark:hover:text-paper/80"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </p>
      ) : null}

      <button
        type="button"
        onClick={onEnable}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/20 px-4 text-xs font-semibold text-ink-soft transition-colors hover:bg-navy-900/5 disabled:opacity-50 dark:border-white/20 dark:text-paper/80 dark:hover:bg-white/5"
      >
        <Bell size={13} aria-hidden="true" />
        {busy ? t.enabling : t.enableReminders}
      </button>
      {error && <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">{error}</p>}
    </div>
  )
}
