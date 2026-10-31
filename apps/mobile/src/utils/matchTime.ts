// Reglas de hora (docs/ESTADO.md): SCHEDULED = hora NO fijada (la API manda 00:00:00Z) -> solo fecha.
// Cualquier otro estado trae hora real y se muestra en Europe/Madrid. No se inventan horas.
import { capitalizeFirst } from './text';

export const MADRID = 'Europe/Madrid';

export const hasConfirmedTime = (status: string): boolean => status !== 'SCHEDULED';

// Fecha sin hora: se lee en UTC para que 00:00Z no cambie de día.
const zoneFor = (status: string) => (hasConfirmedTime(status) ? MADRID : 'UTC');

export function formatMatchDate(
  utc: string,
  status: string,
  locale: string,
  style: 'short' | 'long' = 'short',
): string {
  const timeZone = zoneFor(status);
  const opts: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }
      : { weekday: 'short', day: 'numeric', month: 'short', timeZone };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(utc));
}

/** "21:00" en hora de Madrid, o null si la hora no está confirmada. */
export function formatMatchTime(utc: string, status: string, locale: string): string | null {
  if (!hasConfirmedTime(status)) return null;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MADRID,
  }).format(new Date(utc));
}

/**
 * Forma corta y capitalizada para la tarjeta: «Lunes 2 nov» (o «Monday 2 Nov»).
 * En SCHEDULED se lee en UTC para no cambiar de día; en el resto, en Madrid.
 */
export function formatMatchDateShort(utc: string, status: string, locale: string): string {
  const timeZone = zoneFor(status);
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).formatToParts(new Date(utc));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return capitalizeFirst(`${value('weekday')} ${value('day')} ${value('month')}`, locale);
}

/** Fecha y hora completas en Madrid para la vista previa de recordatorios. */
export function formatReminderDateTime(utc: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: MADRID,
  }).format(new Date(utc));
}

/** Clave "YYYY-MM" para agrupar por mes con la misma zona que se muestra. */
export function monthKey(utc: string, status: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    timeZone: zoneFor(status),
  }).formatToParts(new Date(utc));
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  return `${y}-${m}`;
}

export function formatMonth(key: string, locale: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)),
  );
}
