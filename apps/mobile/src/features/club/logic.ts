// Lógica pura del Club (H7): temporadas, décadas, aforo, mapas e himnos.
// Sin React ni módulos nativos para poder probarla en Jest sin mocks.
import type { AnthemT, CapacityT, CrestVersionT, SeasonKitsT, TitleT } from '@/data/schemas';

export type ClubSectionId =
  | 'himnos'
  | 'escudo'
  | 'equipaciones'
  | 'estadio'
  | 'museo'
  | 'training'
  | 'junta'
  | 'patrocinadores'
  | 'titulos'
  | 'rivalidades'
  | 'redes';

export type ClubSection = {
  id: ClubSectionId;
  /** Nombre de icono de Ionicons; el tipo real se valida en la pantalla. */
  icon: string;
};

export const CLUB_SECTIONS: ClubSection[] = [
  { id: 'himnos', icon: 'musical-notes-outline' },
  { id: 'escudo', icon: 'shield-outline' },
  { id: 'equipaciones', icon: 'shirt-outline' },
  { id: 'estadio', icon: 'football-outline' },
  { id: 'museo', icon: 'business-outline' },
  { id: 'training', icon: 'barbell-outline' },
  { id: 'junta', icon: 'people-outline' },
  { id: 'patrocinadores', icon: 'pricetags-outline' },
  { id: 'titulos', icon: 'trophy-outline' },
  { id: 'rivalidades', icon: 'flame-outline' },
  { id: 'redes', icon: 'share-social-outline' },
];

const SEASON = /^(\d{4})-(\d{2})$/;

/** Año de inicio de una temporada `AAAA-AA`; null si el formato no es válido. */
export function seasonStart(season: string): number | null {
  const match = SEASON.exec(season);
  return match ? Number(match[1]) : null;
}

/** Ordena temporadas por año de inicio. `desc` deja la más reciente primero. */
export function sortSeasons(seasons: SeasonKitsT[], order: 'asc' | 'desc' = 'asc'): SeasonKitsT[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...seasons].sort((a, b) => {
    const left = seasonStart(a.season) ?? 0;
    const right = seasonStart(b.season) ?? 0;
    if (left !== right) return (left - right) * direction;
    return a.season.localeCompare(b.season) * direction;
  });
}

/** Década a la que pertenece una temporada (1985-86 → 1980). */
export function decadeOf(season: string): number | null {
  const start = seasonStart(season);
  return start === null ? null : Math.floor(start / 10) * 10;
}

export function decadeLabel(decade: number): string {
  return `${decade}s`;
}

export type DecadeGroup = { decade: number; seasons: SeasonKitsT[] };

/**
 * Agrupa las temporadas por década. Por defecto la década más reciente va primero
 * y dentro de cada década las temporadas también van de más reciente a más antigua.
 */
export function groupSeasonsByDecade(
  seasons: SeasonKitsT[],
  order: 'asc' | 'desc' = 'desc',
): DecadeGroup[] {
  const groups = new Map<number, SeasonKitsT[]>();
  for (const season of seasons) {
    const decade = decadeOf(season.season);
    if (decade === null) continue;
    const bucket = groups.get(decade) ?? [];
    bucket.push(season);
    groups.set(decade, bucket);
  }
  const decades = [...groups.keys()].sort((a, b) => (order === 'asc' ? a - b : b - a));
  return decades.map((decade) => ({
    decade,
    seasons: sortSeasons(groups.get(decade) ?? [], order),
  }));
}

/** Rango legible de un escudo: `1906-1908` o `2026-actualidad`. */
export function crestYearRange(crest: CrestVersionT, presentLabel: string): string {
  return `${crest.yearFrom}-${crest.yearTo ?? presentLabel}`;
}

/** Escudo vigente: el que no tiene año de fin, o el de inicio más reciente. */
export function currentCrest(crests: CrestVersionT[]): CrestVersionT | null {
  if (crests.length === 0) return null;
  const open = crests.filter((crest) => crest.yearTo === null);
  const pool = open.length > 0 ? open : crests;
  return pool.reduce((latest, crest) => (crest.yearFrom > latest.yearFrom ? crest : latest));
}

/** Porcentaje de asientos sobre el aforo total, acotado entre 0 y 100. */
export function capacityShare(seats: number, total: number): number {
  if (!Number.isFinite(seats) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (seats / total) * 100));
}

/** La suma del desglose, útil para validar el contrato en tests y pantallas. */
export function capacitySum(capacity: CapacityT): number {
  return capacity.breakdown.reduce((sum, zone) => sum + zone.seats, 0);
}

export function formatSeats(seats: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(seats);
}

export function formatPrice(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
}

/** Fecha ISO completa (`1944-10-29`) sin desplazamientos de zona horaria. */
export function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * URL de mapa nativo. iOS usa Apple Maps; Android usa el esquema `geo:`. En web o
 * como último recurso se devuelve una URL HTTPS de Google Maps.
 */
export function mapUrl(
  latitude: number,
  longitude: number,
  label: string,
  platform: string,
): string {
  const coords = `${latitude},${longitude}`;
  if (platform === 'ios') {
    return `http://maps.apple.com/?ll=${coords}&q=${encodeURIComponent(label)}`;
  }
  if (platform === 'android') {
    return `geo:${coords}?q=${coords}(${encodeURIComponent(label)})`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${coords}`;
}

/** Alternativa HTTPS si el esquema nativo no está disponible. */
export function webMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function anthemKindKey(kind: AnthemT['kind']): string {
  return `club.anthemKinds.${kind ?? 'unknown'}`;
}

export function kitTypeKey(type: string): string {
  return `club.kitTypes.${type}`;
}

const KNOWN_CREDIT_ROLES = new Set([
  'musicians',
  'production',
  'recording',
  'technicians',
  'performance',
]);

export function creditRoleKey(role: string): string {
  return `club.himnos.creditRoles.${KNOWN_CREDIT_ROLES.has(role) ? role : 'other'}`;
}

/** Texto para el Share nativo: título, autoría y letra, sin datos internos. */
export function anthemShareText(anthem: AnthemT): string {
  const meta = [anthem.authors.join(', '), anthem.year?.toString()].filter(Boolean).join(' · ');
  const header = meta ? `${anthem.title}\n${meta}` : anthem.title;
  return anthem.lyrics ? `${header}\n\n${anthem.lyrics}` : header;
}

export function titleTotal(titles: TitleT[]): number {
  return titles.reduce((sum, title) => sum + title.years.length, 0);
}

/** Número de piezas citado en la descripción del museo, si está publicado. */
export function museumPieces(text: string | null | undefined): number | null {
  const match = /(\d[\d.]*)\s*(?:piezas|obras|fondos)\b/i.exec(text ?? '');
  if (!match) return null;
  const value = Number(match[1]!.replace(/\./g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Etiqueta compacta y legible de un enlace: `x.com/RCDeportivo`. */
export function linkHandle(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return url;
  }
}

export type FacilityFact = { value: number; suffix: string | null; label: string };

const FACILITY = /^(\d[\d.,]*)\s*(m²|m2|ha)?\s*(.*)$/;

/**
 * D-19: separa las instalaciones con cifra (superficie, campos) de las notas
 * cualitativas para poder darles jerarquía de dato, no de lista.
 */
export function trainingFacts(facilities: string[]): {
  facts: FacilityFact[];
  notes: string[];
} {
  const facts: FacilityFact[] = [];
  const notes: string[] = [];
  for (const facility of facilities) {
    const match = FACILITY.exec(facility.trim());
    const value = match ? Number(match[1]!.replace(/\./g, '').replace(',', '.')) : Number.NaN;
    if (!match || !Number.isFinite(value)) {
      notes.push(facility);
      continue;
    }
    const unit = match[2] ?? null;
    const label = match[3]!.trim().replace(/^de\s+/i, '');
    facts.push({
      value,
      suffix: unit === 'm²' ? ' m²' : unit ? ` ${unit}` : null,
      label: label || facility,
    });
  }
  return { facts, notes };
}
