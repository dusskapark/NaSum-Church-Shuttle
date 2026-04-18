import { useAppSettings } from './app-settings';
import i18n from '../locales';

/**
 * Returns a translation function `t(key, opts?)` bound to the current locale.
 * Subscribes to language changes via AppSettingsContext so components re-render
 * when the language is switched.
 */
export function useTranslation() {
  const { lang } = useAppSettings();
  return (key: string, opts?: Record<string, string | number>) =>
    i18n.t(key, { ...opts, locale: lang });
}
