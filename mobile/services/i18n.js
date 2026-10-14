import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import mr from '../locales/mr.json';
import { storage } from './storage';

export const defaultNS = 'translation';
export const resources = {
  en: { translation: en },
  mr: { translation: mr },
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources,
    lng: 'mr', // Default to Marathi
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Asynchronously load stored language preference on boot
(async () => {
  try {
    const savedLang = await storage.getLanguage();
    if (savedLang && (savedLang === 'en' || savedLang === 'mr')) {
      if (i18n.language !== savedLang) {
        await i18n.changeLanguage(savedLang);
      }
    }
  } catch (e) {
    console.warn('Failed to restore language preference:', e);
  }
})();

export const switchLanguage = async (newLang) => {
  try {
    const target = newLang === 'mr' ? 'mr' : 'en';
    await i18n.changeLanguage(target);
    await storage.setLanguage(target);
  } catch (e) {
    console.warn('Failed to switch language:', e);
  }
};

/**
 * Format price in Indian Rupee format.
 * Product prices keep numbers clear while ensuring ₹ currency prefix.
 */
export const formatCurrency = (amount) => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
};

export default i18n;
