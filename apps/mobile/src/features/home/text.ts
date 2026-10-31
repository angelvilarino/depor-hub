import type { TFunction } from 'i18next';

/**
 * Etiqueta de competición por código estable (`PD`), no por el nombre crudo de la API.
 * Si el código no está traducido, se usa el nombre que publica la API.
 */
export function competitionLabel(
  code: string | null | undefined,
  fallback: string | null | undefined,
  t: TFunction,
): string | null {
  if (code) {
    const translated = t(`competition.${code}`, { defaultValue: '' });
    if (translated) return translated;
  }
  return fallback ?? null;
}
