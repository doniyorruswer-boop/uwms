import { create } from 'zustand';
import i18n from '../locales/i18n';

export type SupportedLanguage = 'uz' | 'ru' | 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'uz', label: 'O‘zbekcha', shortLabel: 'UZ' },
  { code: 'ru', label: 'Русский', shortLabel: 'RU' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
];

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const getInitialLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') return 'uz';
  const saved = localStorage.getItem('uwms_language');
  if (saved === 'uz' || saved === 'ru' || saved === 'en') {
    return saved;
  }
  return 'uz';
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (lang: SupportedLanguage) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uwms_language', lang);
    }
    i18n.changeLanguage(lang);
    set({ language: lang });
  },
}));
