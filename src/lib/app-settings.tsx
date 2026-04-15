import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LocaleModule, isSuccess, isError } from '@grabjs/superapp-sdk';
import i18n from '../locales';

export type AppLanguage = 'en' | 'ko';

interface AppSettingsContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const LANGUAGE_KEY = 'grab-shuttle:language';
const DARK_MODE_KEY = 'grab-shuttle:dark-mode';

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function getPreferredLanguage(): AppLanguage {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'en' || stored === 'ko') return stored;

  return window.navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function getPreferredDarkMode(): boolean {
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

  // Sync i18n locale with Grab app language on first load (no stored preference)
  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored) {
      i18n.locale = stored;
      console.log('[AppSettings] Loaded language from localStorage:', stored);
      return;
    }
    const locale = new LocaleModule();
    locale
      .getLanguageLocaleIdentifier()
      .then(async (response) => {
        console.log(
          '[LocaleModule] getLanguageLocaleIdentifier response:',
          response,
        );
        if (isSuccess(response)) {
          // response.result may be ICU format e.g. "en_US@rg=sgzzzz" — use Intl.Locale to extract language
          const { language } = new Intl.Locale(response.result);
          const detected: AppLanguage = language === 'ko' ? 'ko' : 'en';
          console.log(
            '[LocaleModule] parsed locale:',
            response.result,
            '→ language:',
            language,
            '→ lang:',
            detected,
          );
          setLangState(detected);
          i18n.locale = detected;
        } else if (isError(response)) {
          console.error(
            `[LocaleModule] Error ${response.status_code}: ${response.error}`,
          );
        }
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
