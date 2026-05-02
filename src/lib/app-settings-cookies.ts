export const APP_LANG_COOKIE = 'line-shuttle-lang';
export const APP_THEME_COOKIE = 'line-shuttle-theme';
export const DEFAULT_APP_LANGUAGE = 'en';
export const DEFAULT_APP_THEME = 'system';

export type AppCookieLanguage = 'en' | 'ko';
export type AppCookieTheme = 'system' | 'light' | 'dark';

export function normalizeLangCookie(value: string | undefined): AppCookieLanguage {
  return value === 'ko' ? 'ko' : DEFAULT_APP_LANGUAGE;
}

export function normalizeThemeCookie(value: string | undefined): AppCookieTheme {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return DEFAULT_APP_THEME;
}
