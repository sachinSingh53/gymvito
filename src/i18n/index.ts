import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { AppLanguage } from '@/domain/onboarding/onboarding';

import en from './locales/en.json';
import hi from './locales/hi.json';

export type { AppLanguage } from '@/domain/onboarding/onboarding';
export type TranslationKey = keyof typeof en;

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  showSupportNotice: false,
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, hi: { translation: hi } },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await i18n.changeLanguage(language);
}

export default i18n;
