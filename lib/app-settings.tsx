import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'en' | 'ko'

interface AppSettingsContextValue {
  lang: AppLanguage
  setLang: (lang: AppLanguage) => void
  isDark: boolean
  toggleTheme: () => void
}

const LANGUAGE_KEY = 'nasum:language'
const DARK_MODE_KEY = 'nasum:dark-mode'

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en'

  const stored = window.localStorage.getItem(LANGUAGE_KEY)
  if (stored === 'en' || stored === 'ko') return stored

  return window.navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

function getPreferredDarkMode(): boolean {
  if (typeof window === 'undefined') return false

  const stored = window.localStorage.getItem(DARK_MODE_KEY)
  if (stored === 'true') return true
  if (stored === 'false') return false

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>(() => getPreferredLanguage())
  const [isDark, setIsDark] = useState(() => getPreferredDarkMode())

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LANGUAGE_KEY, lang)
  }, [lang])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(DARK_MODE_KEY, String(isDark))

    if (isDark) {
      document.documentElement.setAttribute('data-prefers-color-scheme', 'dark')
      return
    }

    document.documentElement.removeAttribute('data-prefers-color-scheme')
  }, [isDark])

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      lang,
      setLang,
      isDark,
      toggleTheme: () => {
        setIsDark(previous => !previous)
      },
    }),
    [isDark, lang]
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext)

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider')
  }

  return context
}
