export const APP_LANG_COOKIE = 'line-shuttle-lang';
export const APP_THEME_COOKIE = 'line-shuttle-theme';

export type AppCookieLanguage = 'en' | 'ko';
export type AppCookieTheme = 'light' | 'dark';

export function normalizeLangCookie(value: string | undefined): AppCookieLanguage {
  return value === 'ko' ? 'ko' : 'en';
}

export function normalizeThemeCookie(value: string | undefined): AppCookieTheme {
  return value === 'dark' ? 'dark' : 'light';
}
