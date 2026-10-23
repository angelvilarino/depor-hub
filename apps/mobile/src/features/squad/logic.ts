// Lógica pura de plantilla (sin React ni módulos nativos): agrupar, ordenar, edad, datos pendientes.
import type { PlayerT } from '@/data/schemas';

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW' | 'OTHER';
export const GROUP_ORDER: PositionGroup[] = ['GK', 'DF', 'MF', 'FW', 'OTHER'];

/** football-data.org da Goalkeeper/Defence/Midfield/Offence; en detalle puede dar posiciones finas. */
export function positionGroup(position: string | null | undefined): PositionGroup {
  const p = (position ?? '').toLowerCase();
  if (p.includes('keeper')) return 'GK';
  if (p.includes('midfield')) return 'MF'; // antes que "defen": "Defensive Midfield" es centrocampista
  if (p.includes('defen') || p.includes('back')) return 'DF';
  if (/(offence|offense|forward|winger|striker|attack)/.test(p)) return 'FW';
  return 'OTHER';
}

/** Con dorsal primero (ascendente); después por nombre. */
export function compareSquad(a: PlayerT, b: PlayerT): number {
  const an = a.shirtNumber;
  const bn = b.shirtNumber;
  if (an !== null && bn !== null && an !== bn) return an - bn;
  if (an !== null && bn === null) return -1;
  if (an === null && bn !== null) return 1;
  return a.name.localeCompare(b.name, 'es');
}

export function groupSquad(players: PlayerT[]): { group: PositionGroup; data: PlayerT[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    data: players.filter((p) => positionGroup(p.position) === group).sort(compareSquad),
  })).filter((g) => g.data.length > 0);
}

/** Edad en años cumplidos a `nowMs` desde "YYYY-MM-DD"; null si el dato falta o no es válido. */
export function ageFrom(dateOfBirth: string | null | undefined, nowMs: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth ?? '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const now = new Date(nowMs);
  const nm = now.getUTCMonth() + 1;
  let age = now.getUTCFullYear() - y;
  if (nm < mo || (nm === mo && now.getUTCDate() < d)) age -= 1;
  return age >= 0 && age < 100 ? age : null;
}

/** Fecha parcial ("2028", "2028-06", "2028-06-30") legible; devuelve el texto tal cual si no la reconoce. */
export function formatPartialDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
  if (!m) return value;
  const year = Number(m[1]);
  if (!m[2]) return String(year);
  const month = Number(m[2]);
  const day = m[3] ? Number(m[3]) : null;
  const opts: Intl.DateTimeFormatOptions = day
    ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'long', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(Date.UTC(year, month - 1, day ?? 1)));
}

export type PendingField =
  | 'shirtNumber'
  | 'position'
  | 'nationality'
  | 'dateOfBirth'
  | 'heightCm'
  | 'contractUntil';
const PENDING_ORDER: PendingField[] = [
  'shirtNumber',
  'position',
  'nationality',
  'dateOfBirth',
  'heightCm',
  'contractUntil',
];

/** Campos sin dato. `?? null`: la caché persistida anterior al ADR 0007 puede no traer heightCm. */
export function pendingFields(p: PlayerT): PendingField[] {
  return PENDING_ORDER.filter((k) => (p[k] ?? null) === null);
}

/** Iniciales para el avatar: nombre+apellido, o las dos primeras letras si es un solo nombre ("Peke" -> "PE"). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return Array.from(words[0] ?? '?').slice(0, 2).join('').toUpperCase();
  const first = Array.from(words[0] ?? '')[0] ?? '';
  const last = Array.from(words[words.length - 1] ?? '')[0] ?? '';
  return (first + last).toUpperCase();
}

// Todos con contraste >= 4.5 frente a texto blanco (comprobado en tests).
export const AVATAR_COLORS = ['#00478F', '#0B6B4F', '#7B3F98', '#9A3412', '#1F5F8B', '#8A2B4A'] as const;
export const avatarColor = (id: number): string =>
  AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
