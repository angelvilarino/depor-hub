import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/query-persist-client-core';

/**
 * Caché de datos persistida **por consulta** (F3-04 / D1-15).
 *
 * La versión anterior guardaba todo el cliente en una sola entrada
 * (`deporhub-query-cache`): cada cambio reescribía el documento completo y, con
 * `squad.json` dentro, se acercaba al límite de AsyncStorage en Android. Ahora
 * cada consulta vive en su propia clave y solo se reescribe cuando su contenido
 * cambia. `maxAge` y `buster` siguen viviendo en una entrada pequeña de metadatos.
 */
export const DATA_CACHE_KEY = 'deporhub-query-cache'; // clave monolítica anterior: se borra al migrar
const QUERY_PREFIX = 'deporhub-query:';
const META_KEY = 'deporhub-query-meta';

type StoredMeta = { timestamp: number; buster: string };
type StoredQuery = PersistedClient['clientState']['queries'][number];

/** Último JSON escrito por clave: evita reescribir consultas que no cambiaron. */
const lastWritten = new Map<string, string>();

function storageKey(queryHash: string): string {
  return `${QUERY_PREFIX}${queryHash}`;
}

async function queryKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(QUERY_PREFIX));
}

async function readMeta(): Promise<StoredMeta | null> {
  const raw = await AsyncStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMeta>;
    return { timestamp: Number(parsed.timestamp) || 0, buster: parsed.buster ?? '' };
  } catch {
    return null;
  }
}

export const persister: Persister = {
  async persistClient(client: PersistedClient) {
    const queries = client.clientState.queries ?? [];
    const alive = new Set<string>();
    for (const query of queries) {
      const key = storageKey(query.queryHash);
      alive.add(key);
      const body = JSON.stringify(query);
      if (lastWritten.get(key) === body) continue;
      await AsyncStorage.setItem(key, body);
      lastWritten.set(key, body);
    }

    // Consultas que ya no forman parte del cliente (o cambiaron de hash): fuera.
    const stale = (await queryKeys()).filter((key) => !alive.has(key));
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
    for (const key of stale) lastWritten.delete(key);

    const meta: StoredMeta = { timestamp: client.timestamp, buster: client.buster };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  },

  async restoreClient(): Promise<PersistedClient | undefined> {
    // Migración desde el formato monolítico: no se lee, se descarta.
    await AsyncStorage.removeItem(DATA_CACHE_KEY);
    const meta = await readMeta();
    const keys = await queryKeys();
    if (!meta || keys.length === 0) return undefined;

    const pairs = await AsyncStorage.multiGet(keys);
    const queries: StoredQuery[] = [];
    for (const [key, value] of pairs) {
      if (!value) continue;
      try {
        const query = JSON.parse(value) as StoredQuery;
        if (!query?.queryHash) continue;
        queries.push(query);
        lastWritten.set(key, value);
      } catch {
        // Una entrada corrupta no invalida el resto de la caché.
      }
    }
    if (queries.length === 0) return undefined;

    return {
      timestamp: meta.timestamp,
      buster: meta.buster,
      clientState: { mutations: [], queries },
    };
  },

  async removeClient() {
    const keys = await queryKeys();
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
    lastWritten.clear();
    await AsyncStorage.removeItem(META_KEY);
    await AsyncStorage.removeItem(DATA_CACHE_KEY);
  },
};

/**
 * Borra solo la caché de datos persistida (no los ajustes ni los recordatorios).
 * La app volverá a descargar los JSON en la siguiente consulta o al reiniciar.
 */
export async function clearPersistedDataCache(): Promise<void> {
  await persister.removeClient();
}
