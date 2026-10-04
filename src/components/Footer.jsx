import { useState } from 'react'
import { Moon, RotateCcw, Sun } from 'lucide-react'
import ReminderToggle from './ReminderToggle'
import LanguageSwitcher from './LanguageSwitcher'
import { useLang } from '../i18n/LanguageContext'

/**
 * Footer: language switcher, reminders opt-in, theme toggle, and a
 * discreet-but-accessible, confirm-guarded "Reset Profile Data".
 *
 * Reminders and reset appear only once they apply. A first visit was offered
 * "Enable weekly reminders" before there was a program or a start date to
 * remind about, and "Reset Profile Data" before there was anything to reset.
 * App decides: `showReminders` once a start date is set, and `onReset` only
 * while there is learner data to clear.
 */
export default function Footer({
  theme,
  onToggleTheme,
  onReset,
  showReminders = true,
  programName = '',
}) {
  const { t } = useLang()
  const targetMode = theme === 'dark' ? t.lightMode : t.darkMode

  return (
    <footer className="mt-8 space-y-3 pb-2 text-center">
      <div className="flex justify-center">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {showReminders && <ReminderToggle />}
        <button
          type="button"
          onClick={onToggleTheme}
          className="tap-target inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-navy-900/5 dark:border-white/20 dark:text-paper/80 dark:hover:bg-white/5"
          aria-label={t.switchTheme(targetMode)}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          {targetMode}
        </button>
      </div>

      {onReset && <ResetControl onReset={onReset} />}

      <p className="text-[11px] text-ink-mute dark:text-paper/60">{t.footerNote(programName)}</p>
    </footer>
  )
}

/*
  Its own component so a half-finished confirmation goes away with it when
  there is nothing left to reset, rather than reappearing, still open, the
  next time there is.
*/
function ResetControl({ onReset }) {
  const { t } = useLang()
  const [confirming, setConfirming] = useState(false)

  return confirming ? (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 rounded-xl border border-violet/30 bg-violet/5 p-3">
      <p className="text-xs font-semibold text-ink dark:text-paper">{t.resetConfirm}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onReset()
            setConfirming(false)
          }}
          className="tap-target rounded-lg bg-violet px-3 text-xs font-bold text-white"
        >
          {t.resetYes}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="tap-target rounded-lg bg-navy-900/5 px-3 text-xs font-bold dark:bg-white/10"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-medium text-ink-mute transition-colors hover:text-violet dark:text-paper/65 dark:hover:text-lime"
    >
      <RotateCcw size={12} aria-hidden="true" />
      {t.resetButton}
    </button>
  )
}
