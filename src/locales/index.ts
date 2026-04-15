import { I18n } from 'i18n-js';
import en from './en';
import ko from './ko';

const i18n = new I18n({ en, ko });
i18n.locale = 'en';
i18n.enableFallback = true;

export default i18n;
export type SupportedLocale = 'en' | 'ko';
