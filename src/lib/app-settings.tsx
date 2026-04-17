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
import {
  APP_LANG_COOKIE,
  APP_THEME_COOKIE,
  normalizeLangCookie,
  normalizeThemeCookie,
} from './app-settings-cookies';

export type AppLanguage = 'en' | 'ko';
export type AppTheme = 'light' | 'dark';

interface AppSettingsContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const LANGUAGE_KEY = 'line-shuttle:language';
const DARK_MODE_KEY = 'line-shuttle:dark-mode';

function setClientCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));
  if (!entry) return null;
  return decodeURIComponent(entry.slice(prefix.length));
}

function getInitialClientLanguage(initialLang: AppLanguage): AppLanguage {
  if (typeof window === 'undefined') return initialLang;

  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'en' || stored === 'ko') {
    return stored;
  }

  const cookieLang = getCookieValue(APP_LANG_COOKIE);
  return normalizeLangCookie(cookieLang ?? initialLang);
}

function getInitialClientTheme(initialTheme: AppTheme): AppTheme {
  if (typeof window === 'undefined') return initialTheme;

  const storedDark = window.localStorage.getItem(DARK_MODE_KEY);
  if (storedDark === 'true') return 'dark';
  if (storedDark === 'false') return 'light';

  const cookieTheme = getCookieValue(APP_THEME_COOKIE);
  return normalizeThemeCookie(cookieTheme ?? initialTheme);
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

interface AppSettingsProviderProps {
  children: ReactNode;
  initialLang: AppLanguage;
  initialTheme: AppTheme;
}

export function AppSettingsProvider({
  children,
  initialLang,
  initialTheme,
}: AppSettingsProviderProps) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    const nextLang = getInitialClientLanguage(initialLang);
    i18n.locale = nextLang;
    return nextLang;
  });
  const [isDark, setIsDarkState] = useState<boolean>(
    getInitialClientTheme(initialTheme) === 'dark',
  );

  useEffect(() => {
    i18n.locale = lang;
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    setClientCookie(APP_LANG_COOKIE, normalizeLangCookie(lang));
  }, [lang]);

  useEffect(() => {
    const nextTheme = normalizeThemeCookie(isDark ? 'dark' : 'light');
    setClientCookie(APP_THEME_COOKIE, nextTheme);
  }, [isDark]);

  // Read persisted preferences only on client to avoid hydration mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored === 'en' || stored === 'ko') return;

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
        const detected: AppLanguage = normalizeLangCookie(language);
        setLangState(detected);
      })
      .catch(() => {});
  }, [initialLang]);

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
