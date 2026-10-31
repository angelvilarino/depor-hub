export type Weather = {
  temperatureC: number;
  precipitationProbability: number | null;
  windKmh: number | null;
  code: number;
  hour: string;
  nearby?: WeatherHour[];
};

export type WeatherHour = {
  temperatureC: number;
  precipitationProbability: number | null;
  windKmh: number | null;
  code: number;
  hour: string;
};

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    precipitation_probability?: (number | null)[];
    wind_speed_10m?: (number | null)[];
    weather_code?: (number | null)[];
  };
};

const MADRID = 'Europe/Madrid';

/** Fecha local de Madrid en formato AAAA-MM-DD. */
export function madridDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: MADRID,
  }).format(new Date(iso));
}

/** Hora local de Madrid en formato AAAA-MM-DDTHH. */
function madridHour(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    timeZone: MADRID,
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = value('hour') === '24' ? '00' : value('hour');
  return `${value('year')}-${value('month')}-${value('day')}T${hour}`;
}

/**
 * Elige la hora de Open-Meteo más cercana al inicio. La API devuelve horas locales
 * sin desplazamiento (`2026-11-02T21:00`), así que se comparan como texto.
 */
export function pickWeather(payload: OpenMeteoResponse, kickoffIso: string): Weather | null {
  const hourly = payload.hourly;
  if (!hourly?.time?.length) return null;
  const target = madridHour(kickoffIso);
  const wallClockMs = (value: string) => Date.parse(`${value.length === 13 ? `${value}:00` : value}Z`);
  const targetMs = wallClockMs(target);
  const index = hourly.time.reduce((best, value, candidate) => {
    if (best < 0) return candidate;
    return Math.abs(wallClockMs(value) - targetMs) < Math.abs(wallClockMs(hourly.time![best]!) - targetMs)
      ? candidate
      : best;
  }, -1);
  if (index === -1) return null;
  if (Math.abs(wallClockMs(hourly.time[index]!) - targetMs) > 3 * 60 * 60 * 1000) return null;
  const temperature = hourly.temperature_2m?.[index];
  const code = hourly.weather_code?.[index];
  if (temperature === null || temperature === undefined || code === null || code === undefined) {
    return null;
  }
  const hours = hourly.time
    .map((hour, i) => {
      const temperature = hourly.temperature_2m?.[i];
      const code = hourly.weather_code?.[i];
      if (temperature === null || temperature === undefined || code === null || code === undefined) {
        return null;
      }
      return {
        hour,
        temperatureC: Math.round(temperature),
        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
        windKmh:
          hourly.wind_speed_10m?.[i] === null || hourly.wind_speed_10m?.[i] === undefined
            ? null
            : Math.round(hourly.wind_speed_10m[i] as number),
        code,
      } satisfies WeatherHour;
    })
    .filter((value): value is WeatherHour => value !== null)
    .filter((value) => Math.abs(wallClockMs(value.hour) - wallClockMs(hourly.time![index]!)) <= 3 * 60 * 60 * 1000);

  return {
    temperatureC: Math.round(temperature),
    precipitationProbability: hourly.precipitation_probability?.[index] ?? null,
    windKmh:
      hourly.wind_speed_10m?.[index] === null || hourly.wind_speed_10m?.[index] === undefined
        ? null
        : Math.round(hourly.wind_speed_10m[index] as number),
    code,
    hour: hourly.time[index] ?? target,
    nearby: hours,
  };
}

export function weatherKey(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return 'unknown';
}

/** Solo se pide tiempo con hora confirmada, sede fiable y como mucho 16 días vista. */
export function weatherEligible(
  status: string,
  kickoffMs: number,
  nowMs: number,
  hasCoords: boolean,
): boolean {
  if (!hasCoords) return false;
  if (status === 'SCHEDULED') return false;
  const diff = kickoffMs - nowMs;
  return diff > 0 && diff <= 16 * 86_400_000;
}
