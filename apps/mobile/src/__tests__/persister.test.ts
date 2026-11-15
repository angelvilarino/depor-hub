import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient } from '@tanstack/query-persist-client-core';
import { DATA_CACHE_KEY, persister } from '@/data/persister';

const QUERY_PREFIX = 'deporhub-query:';
const META_KEY = 'deporhub-query-meta';

function query(hash: string, data: unknown = { n: hash }) {
  return {
    queryHash: hash,
    queryKey: ['data', 'https://example.test/v1', hash],
    state: {
      data,
      dataUpdatedAt: 1,
      dataUpdateCount: 1,
      error: null,
      errorUpdatedAt: 0,
      errorUpdateCount: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: 'success' as const,
      fetchStatus: 'idle' as const,
    },
    dehydratedAt: 1,
  };
}

function client(hashes: string[], buster = 'data-v9'): PersistedClient {
  return {
    timestamp: 123,
    buster,
    clientState: { mutations: [], queries: hashes.map((hash) => query(hash)) },
  };
}

beforeEach(async () => {
  await persister.removeClient();
  await AsyncStorage.clear();
});

describe('caché por consulta (F3-04)', () => {
  it('guarda cada consulta en su propia clave y la restaura', async () => {
    await persister.persistClient(client(['["data","a"]', '["data","b"]']));

    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toContain(`${QUERY_PREFIX}["data","a"]`);
    expect(keys).toContain(`${QUERY_PREFIX}["data","b"]`);
    expect(keys).toContain(META_KEY);
    expect(keys).not.toContain(DATA_CACHE_KEY);

    const restored = await persister.restoreClient();
    expect(restored?.timestamp).toBe(123);
    expect(restored?.buster).toBe('data-v9');
    expect(restored?.clientState.queries.map((item) => item.queryHash)).toEqual([
      '["data","a"]',
      '["data","b"]',
    ]);
  });

  it('elimina las consultas que ya no forman parte de la caché', async () => {
    await persister.persistClient(client(['["data","a"]', '["data","b"]']));
    await persister.persistClient(client(['["data","a"]']));

    // La consulta viva permanece y la desaparecida se borra: no crece sin control.
    expect(await AsyncStorage.getItem(`${QUERY_PREFIX}["data","a"]`)).not.toBeNull();
    expect(await AsyncStorage.getItem(`${QUERY_PREFIX}["data","b"]`)).toBeNull();
  });

  it('descarta la caché monolítica anterior', async () => {
    await AsyncStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ legacy: true }));

    expect(await persister.restoreClient()).toBeUndefined();
    expect(await AsyncStorage.getItem(DATA_CACHE_KEY)).toBeNull();
  });

  it('removeClient borra consultas, metadatos y la clave anterior', async () => {
    await persister.persistClient(client(['["data","a"]']));
    await AsyncStorage.setItem(DATA_CACHE_KEY, '{}');

    await persister.removeClient();

    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await persister.restoreClient()).toBeUndefined();
  });
});
