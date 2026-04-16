import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getLiff } from './liff';
import i18n from '../locales';

export type AppLanguage = 'en' | 'ko';

interface AppSettingsContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const LANGUAGE_KEY = 'line-shuttle:language';
const DARK_MODE_KEY = 'line-shuttle:dark-mode';

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getPreferredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'en' || stored === 'ko') return stored;

  return window.navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function getPreferredDarkMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const stored = window.localStorage.getItem(DARK_MODE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    const l = getPreferredLanguage();
    i18n.locale = l;
    return l;
  });
  const [isDark, setIsDarkState] = useState<boolean>(getPreferredDarkMode);

  // Sync i18n locale with LINE app language on first load (no stored preference)
  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored) {
      i18n.locale = stored;
      console.log('[AppSettings] Loaded language from localStorage:', stored);
      return;
    }

    getLiff()
      .then((liff) => {
        const appLanguage = (liff as { getAppLanguage?: () => string } | null)
          ?.getAppLanguage?.();
        const locale =
          appLanguage ??
          liff?.getLanguage?.() ??
          window.navigator.language ??
          window.navigator.languages?.[0] ??
          'en';
        const { language } = new Intl.Locale(locale);
        const detected: AppLanguage = language === 'ko' ? 'ko' : 'en';
        setLangState(detected);
        i18n.locale = detected;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute(
        'data-prefers-color-scheme',
        'dark',
      );
      return;
    }

    document.documentElement.removeAttribute('data-prefers-color-scheme');
  }, [isDark]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      lang,
      setLang: (nextLang) => {
        setLangState(nextLang);
        i18n.locale = nextLang;
        window.localStorage.setItem(LANGUAGE_KEY, nextLang);
      },
      isDark,
      toggleTheme: () => {
        const nextIsDark = !isDark;
        setIsDarkState(nextIsDark);
        window.localStorage.setItem(DARK_MODE_KEY, String(nextIsDark));
      },
    }),
    [isDark, lang],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used within AppSettingsProvider');
  }

  return context;
}
