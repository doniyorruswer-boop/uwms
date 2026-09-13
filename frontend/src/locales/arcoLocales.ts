import enUS from '@arco-design/web-react/es/locale/en-US';
import ruRU from '@arco-design/web-react/es/locale/ru-RU';
import { uzUZLocale } from './uzUZ';
import type { SupportedLanguage } from '../store/languageStore';
import type { Locale } from '@arco-design/web-react/es/locale/interface';

const safeEnUS = { ...enUS, ColorPicker: (enUS as any).ColorPicker || {} } as Locale;
const safeRuRU = { ...ruRU, ColorPicker: (ruRU as any).ColorPicker || {} } as Locale;

export const getArcoLocale = (lang: SupportedLanguage): Locale => {
  switch (lang) {
    case 'ru':
      return safeRuRU;
    case 'en':
      return safeEnUS;
    case 'uz':
    default:
      return uzUZLocale;
  }
};
