import { useEffect, useMemo, useState } from 'react';
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
  const [lang, setLang] = useState<AppCookieLanguage>('en');

  useEffect(() => {
    const storedLang = window.localStorage.getItem('line-shuttle:language');
    if (storedLang === 'ko' || storedLang === 'en') {
      setLang(storedLang);
      return;
    }

    const cookieLang = readLangCookie();
    if (cookieLang) {
      setLang(cookieLang);
      return;
    }

    const browserLang = normalizeLangCookie(new Intl.Locale(navigator.language).language);
    setLang(browserLang);
  }, []);

  return useMemo(() => {
    i18n.locale = lang;
    return {
      lang,
      t: (key: string, opts?: Record<string, string | number>) =>
        i18n.t(key, opts),
    };
  }, [lang]);
}
