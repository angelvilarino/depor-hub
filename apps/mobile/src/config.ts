// URL base de los JSON públicos (ADR 0002). Ej.: https://<usuario>.github.io/depor-hub/v1
// Se define en apps/mobile/.env como EXPO_PUBLIC_DATA_BASE_URL (no es un secreto).
export const DATA_BASE_URL = process.env.EXPO_PUBLIC_DATA_BASE_URL ?? '';
