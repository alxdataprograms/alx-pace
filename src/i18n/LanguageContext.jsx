import { createContext, useContext, useEffect, useMemo } from 'react'
import { translations, detectLanguage } from './translations'
import { useLocalStorage } from '../hooks/useLocalStorage'

const LanguageContext = createContext(null)

/**
 * Language provider: persists the choice (localStorage `alx-lang`), defaults
 * to the browser language on first visit, and keeps <html lang dir> in sync
 * so Arabic renders fully right-to-left.
 *
 * The page's title follows too. It stayed index.html's English, "ALX Pace —
 * Self-Pace Tracker", in French and Arabic: on the browser's tab, in its
 * history, and as the name a bookmark is saved under.
 */
export function LanguageProvider({ children }) {
  const [lang, setLang] = useLocalStorage('alx-lang', detectLanguage(), { raw: true })
  const safeLang = translations[lang] ? lang : 'en'
  const t = translations[safeLang]

  useEffect(() => {
    const root = document.documentElement
    root.lang = safeLang
    root.dir = t.dir
    document.title = t.pageTitle
  }, [safeLang, t.dir, t.pageTitle])

  const value = useMemo(() => ({ lang: safeLang, setLang, t }), [safeLang, setLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

/** Access the current language, its translations `t`, and `setLang`. */
export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
