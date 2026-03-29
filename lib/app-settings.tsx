import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useHydrated } from '../hooks/useHydrated'

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
  const hydrated = useHydrated()
  const [langOverride, setLangOverride] = useState<AppLanguage | null>(null)
  const [isDarkOverride, setIsDarkOverride] = useState<boolean | null>(null)

  const lang = langOverride ?? (hydrated ? getPreferredLanguage() : 'en')
  const isDark = isDarkOverride ?? (hydrated ? getPreferredDarkMode() : false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (isDark) {
      document.documentElement.setAttribute('data-prefers-color-scheme', 'dark')
      return
    }

    document.documentElement.removeAttribute('data-prefers-color-scheme')
  }, [isDark])

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      lang,
      setLang: (nextLang) => {
        setLangOverride(nextLang)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LANGUAGE_KEY, nextLang)
        }
      },
      isDark,
      toggleTheme: () => {
        const nextIsDark = !isDark
        setIsDarkOverride(nextIsDark)

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(DARK_MODE_KEY, String(nextIsDark))
        }
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
