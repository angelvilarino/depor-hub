import { madridDate } from '@/features/home/weather';

export type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    precipitation_probability?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    weather_code?: (number | null)[];
  };
};

const BASE = 'https://api.open-meteo.com/v1/forecast';

/** Previsión por horas para la fecha local del partido. Sin ubicación del usuario. */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  kickoffIso: string,
  signal?: AbortSignal,
): Promise<OpenMeteoResponse> {
  const date = madridDate(kickoffIso);
  const day = new Date(`${date}T12:00:00Z`);
  const shiftDay = (delta: number) => {
    const shifted = new Date(day);
    shifted.setUTCDate(shifted.getUTCDate() + delta);
    return shifted.toISOString().slice(0, 10);
  };
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
    timezone: 'Europe/Madrid',
    start_date: shiftDay(-1),
    end_date: shiftDay(1),
  });
  const response = await fetch(`${BASE}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  return (await response.json()) as OpenMeteoResponse;
}
