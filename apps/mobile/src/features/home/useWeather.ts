import { useQuery } from '@tanstack/react-query';
import type { MatchT } from '@/data/schemas';
import { fetchWeather } from '@/data/weather';
import { venueCoords } from './venues';
import { pickWeather, weatherEligible, type Weather } from './weather';

const THIRTY_MINUTES = 30 * 60 * 1000;

/**
 * Tiempo en el estadio. Se oculta si no hay hora confirmada, coordenadas fiables
 * o si el partido está a más de 16 días. Un fallo de Open-Meteo no rompe la Home.
 */
export function useWeather(match: MatchT, nowMs: number) {
  const coords = venueCoords(match.venue);
  const kickoff = Date.parse(match.utcDate);
  const enabled = weatherEligible(match.status, kickoff, nowMs, coords !== null);
  return useQuery<Weather | null>({
    queryKey: ['weather', coords?.latitude, coords?.longitude, match.utcDate.slice(0, 10)],
    queryFn: async ({ signal }) =>
      coords
        ? pickWeather(
            await fetchWeather(coords.latitude, coords.longitude, match.utcDate, signal),
            match.utcDate,
          )
        : null,
    enabled,
    staleTime: THIRTY_MINUTES,
    retry: 0,
  });
}
