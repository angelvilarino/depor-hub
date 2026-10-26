import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LanguagePreference } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SquadView = 'grid' | 'list';

type SettingsState = {
  theme: ThemePreference;
  language: LanguagePreference;
  squadView: SquadView;
  remindersEnabled: boolean; // interruptor global
  remindMatchIds: number[]; // partidos con "Recordarme" activo
  setTheme: (t: ThemePreference) => void;
  setLanguage: (l: LanguagePreference) => void;
  setSquadView: (view: SquadView) => void;
  setRemindersEnabled: (on: boolean) => void;
  toggleRemind: (matchId: number, on: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      squadView: 'grid',
      remindersEnabled: true,
      remindMatchIds: [],
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSquadView: (squadView) => set({ squadView }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      toggleRemind: (matchId, on) =>
        set((s) => ({
          remindMatchIds: on
            ? Array.from(new Set([...s.remindMatchIds, matchId]))
            : s.remindMatchIds.filter((id) => id !== matchId),
        })),
    }),
    { name: 'deporhub-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
