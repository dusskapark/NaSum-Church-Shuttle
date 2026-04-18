import { useMemo, useState } from 'react';
import i18n from '../locales';
import { APP_LANG_COOKIE, normalizeLangCookie, type AppCookieLanguage } from './app-settings-cookies';

function readLangCookie(): AppCookieLanguage | null {
  const target = `${APP_LANG_COOKIE}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));
  if (!cookie) return null;
  return normalizeLangCookie(decodeURIComponent(cookie.slice(target.length)));
}

export function useClientTranslation() {
  const [lang] = useState<AppCookieLanguage>(() => {
    if (typeof window === 'undefined') return 'en';
    const storedLang = window.localStorage.getItem('line-shuttle:language');
    if (storedLang === 'ko' || storedLang === 'en') {
      return storedLang;
    }

    const cookieLang = readLangCookie();
    if (cookieLang) {
      return cookieLang;
    }

    const browserLang = normalizeLangCookie(new Intl.Locale(navigator.language).language);
    return browserLang;
  });

  return useMemo(() => {
    return {
      lang,
      t: (key: string, opts?: Record<string, string | number>) =>
        i18n.t(key, { ...opts, locale: lang }),
    };
  }, [lang]);
}
