import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LanguagePreference } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';
export type SquadView = 'grid' | 'list';

/** Minutos antes del kickoff. 0 = al empezar. */
export const REMINDER_OFFSETS = [1440, 60, 15, 0] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];
export type ReminderMap = Record<number, number[]>;

export const DEFAULT_REMINDER_OFFSETS: ReminderOffset[] = [1440, 60];

export const isReminderOffset = (value: number): value is ReminderOffset =>
  (REMINDER_OFFSETS as readonly number[]).includes(value);

const cleanOffsets = (offsets: number[]): ReminderOffset[] =>
  Array.from(new Set(offsets.filter(isReminderOffset))).sort((a, b) => b - a);

type SettingsState = {
  theme: ThemePreference;
  language: LanguagePreference;
  squadView: SquadView;
  remindersEnabled: boolean; // interruptor global
  remindMatches: ReminderMap; // partido -> offsets elegidos
  defaultReminderOffsets: ReminderOffset[]; // preselección de la hoja
  setTheme: (t: ThemePreference) => void;
  setLanguage: (l: LanguagePreference) => void;
  setSquadView: (view: SquadView) => void;
  setRemindersEnabled: (on: boolean) => void;
  setReminderOffsets: (matchId: number, offsets: number[]) => void;
  removeReminder: (matchId: number) => void;
  setDefaultReminderOffsets: (offsets: number[]) => void;
};

/**
 * Migración del modelo antiguo (`remindMatchIds: number[]`) al nuevo
 * (`remindMatches: Record<matchId, offsets>`). Conserva los partidos ya marcados
 * con el comportamiento anterior: 24 h y 1 h antes.
 */
export function migrateSettings(persisted: Record<string, unknown>, version: number): Record<string, unknown> {
  if (!persisted || version >= 1) return persisted;
  const next: Record<string, unknown> = { ...persisted };
  const legacy = next.remindMatchIds;
  if (!next.remindMatches && Array.isArray(legacy)) {
    next.remindMatches = Object.fromEntries(
      legacy
        .filter((id): id is number => typeof id === 'number')
        .map((id) => [id, [...DEFAULT_REMINDER_OFFSETS]]),
    );
  }
  delete next.remindMatchIds;
  if (!Array.isArray(next.defaultReminderOffsets)) {
    next.defaultReminderOffsets = [...DEFAULT_REMINDER_OFFSETS];
  }
  return next;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'system',
      squadView: 'grid',
      remindersEnabled: true,
      remindMatches: {},
      defaultReminderOffsets: DEFAULT_REMINDER_OFFSETS,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setSquadView: (squadView) => set({ squadView }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setReminderOffsets: (matchId, offsets) =>
        set((s) => {
          const clean = cleanOffsets(offsets);
          const next = { ...s.remindMatches };
          if (clean.length === 0) delete next[matchId];
          else next[matchId] = clean;
          return { remindMatches: next };
        }),
      removeReminder: (matchId) =>
        set((s) => {
          const next = { ...s.remindMatches };
          delete next[matchId];
          return { remindMatches: next };
        }),
      setDefaultReminderOffsets: (offsets) => set({ defaultReminderOffsets: cleanOffsets(offsets) }),
    }),
    {
      name: 'deporhub-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted, version) =>
        migrateSettings(persisted as Record<string, unknown>, version) as SettingsState,
    },
  ),
);
