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
export type AppTheme = 'system' | 'light' | 'dark';
export type ResolvedAppTheme = 'light' | 'dark';

interface AppSettingsContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  theme: AppTheme;
  resolvedTheme: ResolvedAppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const LANGUAGE_KEY = 'line-shuttle:language';
const THEME_KEY = 'line-shuttle:theme';
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

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (
    storedTheme === 'system' ||
    storedTheme === 'light' ||
    storedTheme === 'dark'
  ) {
    return storedTheme;
  }

  const storedDark = window.localStorage.getItem(DARK_MODE_KEY);
  if (storedDark === 'true') return 'dark';
  if (storedDark === 'false') return 'light';
  const cookieTheme = getCookieValue(APP_THEME_COOKIE);
  return normalizeThemeCookie(cookieTheme ?? initialTheme);
}

function getSystemTheme(): ResolvedAppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
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
  const [theme, setThemeState] = useState<AppTheme>(() =>
    getInitialClientTheme(initialTheme),
  );
  const [systemTheme, setSystemTheme] =
    useState<ResolvedAppTheme>(getSystemTheme);
  const resolvedTheme: ResolvedAppTheme =
    theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    i18n.locale = lang;
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    setClientCookie(APP_LANG_COOKIE, normalizeLangCookie(lang));
  }, [lang]);

  useEffect(() => {
    const nextTheme = normalizeThemeCookie(theme);
    setClientCookie(APP_THEME_COOKIE, nextTheme);
  }, [theme]);

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
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const handleChange = () => {
      setSystemTheme(media.matches ? 'dark' : 'light');
    };

    handleChange();
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.setAttribute(
        'data-prefers-color-scheme',
        'dark',
      );
      return;
    }

    document.documentElement.removeAttribute('data-prefers-color-scheme');
  }, [resolvedTheme]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      lang,
      setLang: (nextLang) => {
        setLangState(nextLang);
        i18n.locale = nextLang;
        window.localStorage.setItem(LANGUAGE_KEY, nextLang);
      },
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        window.localStorage.setItem(THEME_KEY, nextTheme);
        window.localStorage.removeItem(DARK_MODE_KEY);
      },
      isDark,
      toggleTheme: () => {
        const nextTheme = isDark ? 'light' : 'dark';
        setThemeState(nextTheme);
        window.localStorage.setItem(THEME_KEY, nextTheme);
        window.localStorage.removeItem(DARK_MODE_KEY);
      },
    }),
    [isDark, lang, resolvedTheme, theme],
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
