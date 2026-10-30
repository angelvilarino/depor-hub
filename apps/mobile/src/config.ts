import Constants from 'expo-constants';

// URL base de los JSON públicos (ADR 0002). Ej.: https://<usuario>.github.io/depor-hub/v1
// Se define en apps/mobile/.env como EXPO_PUBLIC_DATA_BASE_URL (no es un secreto).
const CONFIGURED_DATA_BASE_URL = process.env.EXPO_PUBLIC_DATA_BASE_URL?.trim() ?? '';

const DATA_PORT = process.env.EXPO_PUBLIC_DATA_PORT?.trim() || '8000';

/**
 * En desarrollo `npm run mobile` levanta un servidor estático con `data/public`.
 * Usamos el host del propio Metro para que funcione igual en simulador y en un
 * móvil conectado a la misma red, sin depender de una IP fija.
 */
function localDevDataBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DATA_PORT}/v1`;
  return `http://localhost:${DATA_PORT}/v1`;
}

export const DATA_BASE_URL = CONFIGURED_DATA_BASE_URL || (__DEV__ ? localDevDataBaseUrl() : '');

/** Solo para diagnóstico: indica de dónde salen los datos. */
export const USING_LOCAL_DATA = !CONFIGURED_DATA_BASE_URL && __DEV__;

// Escudos de los equipos (ADR 0006): se cargan desde la URL de la API, nunca se almacenan en el repo.
// Ponlo a false para volver a monogramas sin tocar nada más.
export const SHOW_TEAM_CREST = true;

// Brand use was explicitly requested; keep it separate from the app icon and splash.
export const SHOW_CLUB_CREST_AS_BRAND = true;

// Rival player photos/stats are intentionally omitted until a reliable free source is chosen.
export const SHOW_RIVAL_PHOTOS = false;
