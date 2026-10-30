import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_READ_IDS = 1000;

type NewsState = {
  readIds: string[];
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  /** Restaura una foto anterior de leídos (deshacer «Marcar leídas»). */
  restoreRead: (ids: string[]) => void;
  /** Conserva solo los ids que siguen existiendo en la retención actual. */
  pruneRead: (validIds: string[]) => void;
  clearRead: () => void;
};

/** Leídos persistidos en el dispositivo; no se envía nada a ningún servidor. */
export const useNewsRead = create<NewsState>()(
  persist(
    (set) => ({
      readIds: [],
      markRead: (id) =>
        set((state) =>
          state.readIds.includes(id)
            ? state
            : { readIds: [...state.readIds, id].slice(-MAX_READ_IDS) },
        ),
      markAllRead: (ids) =>
        set((state) => ({
          readIds: Array.from(new Set([...state.readIds, ...ids])).slice(-MAX_READ_IDS),
        })),
      restoreRead: (ids) => set({ readIds: ids.slice(-MAX_READ_IDS) }),
      pruneRead: (validIds) =>
        set((state) => {
          const valid = new Set(validIds);
          const readIds = state.readIds.filter((id) => valid.has(id)).slice(-MAX_READ_IDS);
          return readIds.length === state.readIds.length ? state : { readIds };
        }),
      clearRead: () => set({ readIds: [] }),
    }),
    { name: 'deporhub-news-read', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
