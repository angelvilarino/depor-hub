import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import { DATA_BASE_URL, LIVE_BASE_URL } from '@/config';
import { DataError, fetchData } from './api';
import { mergeFixtures } from './live';
import {
  Club,
  Fixtures,
  MatchDetail,
  MatchSnapshot,
  Meta,
  News,
  Rivals,
  Season,
  SocialFeed,
  Squad,
  Standings,
} from './schemas';

export const GC_TIME = 7 * 24 * 60 * 60 * 1000; // la caché persistida vive 7 días
const STALE_TIME = 5 * 60 * 1000;
const NEWS_STALE_TIME = 10 * 60 * 1000; // las noticias cambian cada 30 min

export async function optionalDocument<T>(name: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (err) {
    if (err instanceof DataError && err.kind === 'http' && err.status === 404) return null;
    if (err instanceof DataError && err.kind === 'invalid') {
      console.error(`Documento opcional ${name} inválido; se muestra vacío`, err);
      return null;
    }
    throw err;
  }
}

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

function useOptionalData<T extends z.ZodType>(
  name: string,
  schema: T,
  staleTime: number = STALE_TIME,
  enabled = true,
) {
  return useQuery({
    queryKey: ['data', DATA_BASE_URL, name],
    queryFn: () => optionalDocument(name, () => fetchData(name, schema)),
    enabled,
    staleTime: __DEV__ ? 0 : staleTime,
    gcTime: GC_TIME,
    retry: (count, err) =>
      !(
        err instanceof DataError &&
        (err.kind === 'not_configured' || err.kind === 'invalid' || err.status === 404)
      ) && count < 2,
  });
}

export const useMeta = () => useData('meta.json', Meta);
export const useStandings = () => useData('standings.json', Standings);

// El proxy en directo comparte contrato con fixtures.json. La caché de 60 s y el
// refetch de 60 s bastan para el plan gratuito; sin URL no se hace ninguna petición.
const useLiveFixtures = () =>
  useQuery({
    queryKey: ['live', LIVE_BASE_URL, 'fixtures.json'],
    queryFn: () => fetchData('fixtures.json', Fixtures, LIVE_BASE_URL),
    enabled: Boolean(LIVE_BASE_URL),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

export function useFixtures() {
  const published = useData('fixtures.json', Fixtures);
  const live = useLiveFixtures();
  const data = useMemo(() => mergeFixtures(published.data, live.data), [published.data, live.data]);
  const refetch = async () => {
    await Promise.allSettled([published.refetch(), live.refetch()]);
  };
  return { ...published, data, refetch };
}
export const useSquad = () => useData('squad.json', Squad);
export const useNews = () => useOptionalData('news.json', News, NEWS_STALE_TIME);
export const useSocial = () => useOptionalData('social.json', SocialFeed, NEWS_STALE_TIME);
export const useSeason = () => useOptionalData('season.json', Season, NEWS_STALE_TIME);
export const useRivals = () => useOptionalData('rivals.json', Rivals, NEWS_STALE_TIME);
// La ficha de un partido terminado sigue funcionando con un snapshot congelado cuando
// el partido ya no aparece en fixtures.json. Un 404 se pinta como "no encontrado".
export const useMatchSnapshot = (season: string | null, matchId: string) =>
  useOptionalData(
    season ? `snapshots/${season}/${matchId}.json` : '',
    MatchSnapshot,
    NEWS_STALE_TIME,
    Boolean(season && matchId),
  );
// Alineaciones y eventos del partido terminado (ADR 0031). Es opcional: si aún no
// se ha publicado la ficha, la app sigue mostrando el marcador sin inventar nada.
export const useMatchDetail = (season: string | null, matchId: string) =>
  useOptionalData(
    season ? `match-details/${season}/${matchId}.json` : '',
    MatchDetail,
    NEWS_STALE_TIME,
    Boolean(season && matchId),
  );
// club.json es opcional para tolerar una caché anterior a H7; un 404 se pinta
// como estado vacío, no como error global.
export const useClub = () => useOptionalData('club.json', Club, NEWS_STALE_TIME);
