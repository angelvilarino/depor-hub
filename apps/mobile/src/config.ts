// URL base de los JSON públicos (ADR 0002). Ej.: https://<usuario>.github.io/depor-hub/v1
// Se define en apps/mobile/.env como EXPO_PUBLIC_DATA_BASE_URL (no es un secreto).
export const DATA_BASE_URL = process.env.EXPO_PUBLIC_DATA_BASE_URL ?? '';

// Escudos de los equipos (ADR 0006): se cargan desde la URL de la API, nunca se almacenan en el repo.
// Ponlo a false para volver a monogramas sin tocar nada más.
export const SHOW_TEAM_CREST = true;
