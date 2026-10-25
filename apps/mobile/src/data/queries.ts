import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { DATA_BASE_URL } from '@/config';
import { DataError, fetchData } from './api';
import { Fixtures, Meta, Squad, Standings } from './schemas';

export const GC_TIME = 7 * 24 * 60 * 60 * 1000; // la caché persistida vive 7 días
const STALE_TIME = 5 * 60 * 1000;

function useData<T extends z.ZodType>(name: string, schema: T) {
  return useQuery({
    // La URL forma parte de la clave: la caché de GitHub Pages no se mezcla con la local.
    queryKey: ['data', DATA_BASE_URL, name],
    queryFn: () => fetchData(name, schema),
    // En desarrollo queremos ver los cambios de data/public al recargar, sin esperar 5 minutos.
    staleTime: __DEV__ ? 0 : STALE_TIME,
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
