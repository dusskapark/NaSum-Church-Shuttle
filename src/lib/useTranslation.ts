import { useAppSettings } from './app-settings';
import i18n from '../locales';

/**
 * Returns a translation function `t(key, opts?)` bound to the current locale.
 * Subscribes to language changes via AppSettingsContext so components re-render
 * when the language is switched.
 */
export function useTranslation() {
  const { lang } = useAppSettings();
  // Sync i18n.locale here to guarantee it matches React state on every render,
  // and to ensure components re-render when the language changes.
  i18n.locale = lang;
  return (key: string, opts?: Record<string, string | number>) =>
    i18n.t(key, opts);
}
