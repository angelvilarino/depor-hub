import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDataCache } from '@/data/cache';
import { persister } from '@/data/persister';
import { queryClient } from '@/data/queryClient';

const query = {
  queryHash: '["data","meta.json"]',
  queryKey: ['data', 'meta.json'],
  state: {
    data: { updatedAt: '2026-11-01T10:00:00Z' },
    dataUpdateCount: 1,
    dataUpdatedAt: 1,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
  },
  dehydratedAt: 1,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  queryClient.clear();
});

describe('borrado de la caché de datos (F3-08)', () => {
  it('vacía la caché en memoria y la persistida', async () => {
    queryClient.setQueryData(['data', 'meta.json'], { stale: 'memoria' });
    await persister.persistClient({
      timestamp: 1,
      buster: 'data-v9',
      clientState: { mutations: [], queries: [query] },
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);
    expect((await AsyncStorage.getAllKeys()).length).toBeGreaterThan(0);

    await clearDataCache();

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
