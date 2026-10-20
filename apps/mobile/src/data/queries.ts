import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { DataError, fetchData } from './api';
import { Fixtures, Meta, Squad, Standings } from './schemas';

export const GC_TIME = 7 * 24 * 60 * 60 * 1000; // la caché persistida vive 7 días
const STALE_TIME = 5 * 60 * 1000;

function useData<T extends z.ZodType>(name: string, schema: T) {
  return useQuery({
    queryKey: ['data', name],
    queryFn: () => fetchData(name, schema),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    // No reintentar lo que no se arregla reintentando.
    retry: (count, err) =>
      !(err instanceof DataError && (err.kind === 'not_configured' || err.kind === 'invalid')) &&
      count < 2,
  });
}

export const useMeta = () => useData('meta.json', Meta);
export const useStandings = () => useData('standings.json', Standings);
export const useFixtures = () => useData('fixtures.json', Fixtures);
export const useSquad = () => useData('squad.json', Squad);
