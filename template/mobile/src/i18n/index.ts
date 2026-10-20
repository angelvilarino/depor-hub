import i18n from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import gl from './locales/gl.json';

export type Language = 'es' | 'gl' | 'en';
export type LanguagePreference = Language | 'system';
export const SUPPORTED: Language[] = ['es', 'gl', 'en'];

export function resolveLanguage(pref: LanguagePreference): Language {
  if (pref !== 'system') return pref;
  const code = getLocales()[0]?.languageCode ?? 'es';
  return (SUPPORTED as string[]).includes(code) ? (code as Language) : 'es';
}

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, gl: { translation: gl }, en: { translation: en } },
  lng: resolveLanguage('system'),
  // GL queda parcial: cualquier clave ausente cae a ES.
  fallbackLng: { gl: ['es'], default: ['es'] },
  interpolation: { escapeValue: false },
});

export default i18n;
