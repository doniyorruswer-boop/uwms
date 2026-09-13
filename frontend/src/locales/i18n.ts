import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uzTranslation from './uz.json';
import ruTranslation from './ru.json';
import enTranslation from './en.json';

const savedLang = (typeof window !== 'undefined' && localStorage.getItem('uwms_language')) || 'uz';

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uzTranslation },
    ru: { translation: ruTranslation },
    en: { translation: enTranslation },
  },
  lng: savedLang,
  fallbackLng: 'uz',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
