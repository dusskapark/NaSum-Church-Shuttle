export const APP_LANG_COOKIE = 'line-shuttle-lang';
export const APP_THEME_COOKIE = 'line-shuttle-theme';
export const DEFAULT_APP_LANGUAGE = 'en';
export const DEFAULT_APP_THEME = 'light';

export type AppCookieLanguage = 'en' | 'ko';
export type AppCookieTheme = 'light' | 'dark';

export function normalizeLangCookie(value: string | undefined): AppCookieLanguage {
  return value === 'ko' ? 'ko' : DEFAULT_APP_LANGUAGE;
}

export function normalizeThemeCookie(value: string | undefined): AppCookieTheme {
  return value === 'dark' ? 'dark' : DEFAULT_APP_THEME;
}
