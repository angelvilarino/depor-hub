import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LanguagePreference } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  theme: ThemePreference;
  language: LanguagePreference;
  setTheme: (t: ThemePreference) => void;
  setLanguage: (l: LanguagePreference) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'deporhub-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
