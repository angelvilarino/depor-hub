import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

export const DATA_CACHE_KEY = 'deporhub-query-cache';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: DATA_CACHE_KEY,
  throttleTime: 1000,
});

/**
 * Borra solo la caché de datos persistida (no los ajustes ni los recordatorios).
 * La app volverá a descargar los JSON en la siguiente consulta o al reiniciar.
 */
export async function clearPersistedDataCache(): Promise<void> {
  await persister.removeClient();
  await AsyncStorage.removeItem(DATA_CACHE_KEY);
}
