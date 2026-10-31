// Lógica pura de plantilla (sin React ni módulos nativos): agrupar, ordenar, edad, datos pendientes.
import type {
  CareerEntryT,
  CareerTotalsT,
  ConfidenceT,
  FixturesT,
  MatchT,
  PlayerMatchT,
  PlayerT,
  SocialT,
  StaffMemberT,
} from '@/data/schemas';

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

/** Búsqueda de plantilla sin mayúsculas ni tildes, por nombre o dorsal. */
export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function filterSquad(players: PlayerT[], query: string, group: PositionGroup | 'ALL'): PlayerT[] {
  const needle = normalizeSearch(query);
  return players.filter((player) => {
    if (group !== 'ALL' && positionGroup(player.position) !== group) return false;
    if (!needle) return true;
    if (normalizeSearch(player.name).includes(needle)) return true;
    return player.shirtNumber !== null && String(player.shirtNumber).includes(needle);
  });
}

export function squadCounts(players: PlayerT[]): Record<PositionGroup | 'ALL', number> {
  const counts: Record<PositionGroup | 'ALL', number> = {
    ALL: players.length,
    GK: 0,
    DF: 0,
    MF: 0,
    FW: 0,
    OTHER: 0,
  };
  for (const player of players) counts[positionGroup(player.position)] += 1;
  return counts;
}

/** Edad media redondeada; null si ningún jugador tiene fecha válida. */
export function averageAge(players: PlayerT[], nowMs: number): number | null {
  const ages = players
    .map((player) => ageFrom(player.dateOfBirth, nowMs))
    .filter((age): age is number => age !== null);
  if (ages.length === 0) return null;
  return Math.round(ages.reduce((total, age) => total + age, 0) / ages.length);
}

const FLAGS: Record<string, string> = {
  Spain: '🇪🇸',
  España: '🇪🇸',
  Italy: '🇮🇹',
  Belgium: '🇧🇪',
  Uruguay: '🇺🇾',
  Poland: '🇵🇱',
  Netherlands: '🇳🇱',
  Denmark: '🇩🇰',
  Gabon: '🇬🇦',
  Cameroon: '🇨🇲',
  France: '🇫🇷',
  Portugal: '🇵🇹',
  Germany: '🇩🇪',
  England: '🇬🇧',
  Ireland: '🇮🇪',
  Argentina: '🇦🇷',
  Brazil: '🇧🇷',
  Colombia: '🇨🇴',
  Morocco: '🇲🇦',
  Senegal: '🇸🇳',
  Ghana: '🇬🇭',
  Nigeria: '🇳🇬',
  Mali: '🇲🇱',
  Venezuela: '🇻🇪',
  Mexico: '🇲🇽',
  Chile: '🇨🇱',
  Paraguay: '🇵🇾',
  Ecuador: '🇪🇨',
  Peru: '🇵🇪',
  Switzerland: '🇨🇭',
  Sweden: '🇸🇪',
  Norway: '🇳🇴',
  Serbia: '🇷🇸',
  Croatia: '🇭🇷',
  Algeria: '🇩🇿',
  Japan: '🇯🇵',
  'United States': '🇺🇸',
};

/** Bandera emoji de la nacionalidad; null si no hay un país reconocido. */
export function countryFlag(nationality: string | null | undefined): string | null {
  return nationality ? (FLAGS[nationality] ?? null) : null;
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

/**
 * Rango de carrera: una sola temporada se escribe "2009-10"; varias, "2014–2017".
 * Si sigue en el club, "2026–". null si no hay inicio.
 */
export function seasonRange(from: string | null | undefined, to: string | null | undefined): string | null {
  const start = from?.slice(0, 4);
  if (!start) return null;
  const end = to?.slice(0, 4);
  if (!end) return `${start}–`;
  if (end === start) return start;
  if (Number(end) === Number(start) + 1) return `${start}-${end.slice(2)}`;
  return `${start}–${end}`;
}

/** Temporada publicada en formato corto: "2026-27" → "26-27". */
export function shortSeason(season: string | null | undefined): string | null {
  if (!season) return null;
  const match = /^(\d{4})-(\d{2,4})$/.exec(season);
  if (!match) return season;
  return `${match[1]?.slice(2)}-${match[2]?.slice(-2)}`;
}

/**
 * Une etapas contiguas del mismo club y rol en un solo periodo.
 *
 * Wikipedia y BDFutbol pueden publicar una fila por temporada; la ficha quiere un
 * periodo legible («2014–2017») y no el mismo club repetido. No muta las entradas.
 */
export function mergeCareerPeriods(career: CareerEntryT[]): CareerEntryT[] {
  const out: CareerEntryT[] = [];
  for (const entry of careerChronological(career)) {
    const previous = out[out.length - 1];
    const previousEnd = Number(previous?.to?.slice(0, 4));
    const currentStart = Number(entry.from?.slice(0, 4));
    const contiguous =
      previous !== undefined &&
      previous.club === entry.club &&
      (previous.role ?? 'player') === (entry.role ?? 'player') &&
      Number.isFinite(previousEnd) &&
      Number.isFinite(currentStart) &&
      currentStart <= previousEnd + 1;

    if (!contiguous || previous === undefined) {
      out.push({ ...entry, seasons: [...entry.seasons] });
      continue;
    }

    const end =
      entry.to !== null && entry.to !== undefined
        ? String(Math.max(Number(previous.to?.slice(0, 4) ?? 0), Number(entry.to.slice(0, 4))))
        : previous.to;
    const sum = (a: number | null, b: number | null) =>
      a === null && b === null ? null : (a ?? 0) + (b ?? 0);
    const seasons = [...previous.seasons];
    for (const season of entry.seasons) {
      if (!seasons.some((item) => item.season === season.season)) seasons.push(season);
    }
    out[out.length - 1] = {
      ...previous,
      to: end,
      appearances: sum(previous.appearances, entry.appearances),
      goals: sum(previous.goals, entry.goals),
      minutes: sum(previous.minutes, entry.minutes),
      yellowCards: sum(previous.yellowCards, entry.yellowCards),
      redCards: sum(previous.redCards, entry.redCards),
      seasons,
    };
  }
  return out;
}

/** Carrera de más antigua a más reciente. No muta la entrada; los datos sin año van al final. */
export function careerChronological(career: CareerEntryT[]): CareerEntryT[] {
  const year = (value: string | null | undefined) => {
    const n = Number(value?.slice(0, 4));
    return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
  };
  return [...career].sort((a, b) => {
    const byStart = year(a.from) - year(b.from);
    return byStart !== 0 ? byStart : year(a.to) - year(b.to);
  });
}

export type CoachRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/**
 * Balance del entrenador con el Depor calculado desde los partidos ya jugados.
 *
 * No se guarda en el contrato: se deriva de `fixtures.json` para que nunca quede
 * desactualizado. `since` es una fecha parcial (año o AAAA-MM-DD); si falta, cuenta
 * todos los partidos terminados de la temporada publicada.
 */
export function coachRecord(
  fixtures: FixturesT | null | undefined,
  since: string | null | undefined,
): CoachRecord | null {
  if (!fixtures) return null;
  const from = since?.slice(0, 4) ?? null;
  const finished = fixtures.matches.filter((match) => {
    if (match.status !== 'FINISHED') return false;
    if (!from) return true;
    return match.utcDate.slice(0, 4) >= from;
  });
  if (finished.length === 0) return null;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const match of finished) {
    const own = match.deporIsHome ? match.score.home : match.score.away;
    const rival = match.deporIsHome ? match.score.away : match.score.home;
    if (own === null || rival === null) continue;
    goalsFor += own;
    goalsAgainst += rival;
    if (own > rival) won += 1;
    else if (own === rival) drawn += 1;
    else lost += 1;
  }
  const played = won + drawn + lost;
  if (played === 0) return null;
  return { played, won, drawn, lost, goalsFor, goalsAgainst, points: won * 3 + drawn };
}

/** Trayectoria filtrada por rol, en orden cronológico. */
export function careerByRole(career: CareerEntryT[], role: 'player' | 'coach'): CareerEntryT[] {
  return careerChronological(career.filter((entry) => (entry.role ?? 'player') === role));
}

/** Orden estable del cuerpo técnico (ADR 0014); los roles desconocidos van al final. */
export const STAFF_ROLE_ORDER = [
  'assistant_coach',
  'technical_assistant',
  'goalkeeping_coach',
  'fitness_coach',
  'rehab_coach',
  'physiotherapist',
  'doctor',
  'nutritionist',
  'psychologist',
  'podiatrist',
  'analyst',
  'delegate',
  'kit_manager',
] as const;

/** Agrupa el cuerpo técnico por rol conservando el orden de la web oficial dentro de cada grupo. */
export function groupStaff(staff: StaffMemberT[]): { role: string; members: StaffMemberT[] }[] {
  const groups = new Map<string, StaffMemberT[]>();
  for (const member of staff) {
    const members = groups.get(member.role) ?? [];
    members.push(member);
    groups.set(member.role, members);
  }
  const rank = (role: string) => {
    const index = (STAFF_ROLE_ORDER as readonly string[]).indexOf(role);
    return index === -1 ? STAFF_ROLE_ORDER.length : index;
  };
  return [...groups.entries()]
    .map(([role, members]) => ({ role, members }))
    .sort((a, b) => rank(a.role) - rank(b.role));
}

/** Número localizado (miles con separador del idioma). */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Año de inicio de una temporada publicada ("2026-27" → 2026). */
export function seasonStartYear(season: string | null | undefined): number | null {
  const match = /^(\d{4})-/.exec(season ?? '');
  return match ? Number(match[1]) : null;
}

/**
 * Partidos de una temporada de fútbol (julio–junio).
 *
 * `deporMatches` acumula todas las etapas del jugador en el Depor; la ficha separa la
 * temporada publicada del total de carrera. Sin temporada conocida se devuelven todos.
 */
export function matchesInSeason(
  matches: PlayerMatchT[],
  season: string | null | undefined,
): PlayerMatchT[] {
  const start = seasonStartYear(season);
  if (start === null) return matches;
  return matches.filter((match) => {
    const year = Number(match.date.slice(0, 4));
    const month = Number(match.date.slice(5, 7));
    return (year === start && month >= 7) || (year === start + 1 && month <= 6);
  });
}

/** ¿Hay algún dato numérico que merezca pintar el bloque de totales? */
export function hasCareerTotals(totals: CareerTotalsT): boolean {
  return [
    totals.appearances,
    totals.goals,
    totals.assists,
    totals.minutes,
    totals.yellowCards,
    totals.redCards,
  ].some((value) => value !== null);
}

export type MatchSummary = {
  appearances: number;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  yellowCards: number | null;
  redCards: number | null;
};

const sumOrNull = (values: (number | null)[]): number | null =>
  values.some((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;

/** Resumen de los partidos con el Depor; null si no hay ninguno. */
export function summarizeMatches(matches: PlayerMatchT[]): MatchSummary | null {
  if (matches.length === 0) return null;
  return {
    appearances: matches.length,
    goals: sumOrNull(matches.map((m) => m.goals)),
    assists: sumOrNull(matches.map((m) => m.assists)),
    minutes: sumOrNull(matches.map((m) => m.minutes)),
    yellowCards: sumOrNull(matches.map((m) => m.yellowCards)),
    redCards: sumOrNull(matches.map((m) => m.redCards)),
  };
}

/** Marcador desde el punto de vista del Depor ("2–1"). */
export function matchScore(match: PlayerMatchT): string | null {
  if (match.teamGoals === null || match.opponentGoals === null) return null;
  return `${match.teamGoals}–${match.opponentGoals}`;
}

const CLUB_STOPWORDS = new Set([
  'a',
  'ad',
  'balompie',
  'cd',
  'cf',
  'club',
  'de',
  'del',
  'el',
  'fc',
  'futbol',
  'la',
  'las',
  'los',
  'rc',
  'rcd',
  'sad',
  'sd',
  'the',
  'ud',
]);

export function clubKey(name: string | null | undefined): string {
  return normalizeSearch(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token && !CLUB_STOPWORDS.has(token))
    .join(' ');
}

function opponentMatches(match: PlayerMatchT, fixture: MatchT): boolean {
  const opponent = match.home ? fixture.away : fixture.home;
  const wanted = clubKey(match.opponent);
  if (!wanted) return false;
  const candidate = clubKey(opponent.name);
  if (candidate === wanted) return true;
  const wantedTokens = new Set(wanted.split(' '));
  return [...wantedTokens].every((token) => candidate.split(' ').includes(token));
}

/**
 * Fixture que corresponde a un partido de la ficha (fecha, localía y rival).
 * Si hay más de uno o el nombre no casa, devuelve null: nunca se enlaza a ciegas.
 */
export function fixtureForMatch(
  match: PlayerMatchT,
  fixtures: FixturesT | null | undefined,
): MatchT | null {
  if (!fixtures) return null;
  const candidates = fixtures.matches.filter(
    (fixture) =>
      fixture.utcDate.slice(0, 10) === match.date && fixture.deporIsHome === match.home,
  );
  const matches = candidates.filter((fixture) => opponentMatches(match, fixture));
  const unique = [...new Map(matches.map((fixture) => [fixture.id, fixture])).values()];
  return unique.length === 1 ? (unique[0] ?? null) : null;
}

export type SocialLink = { network: 'x' | 'instagram' | 'tiktok'; handle: string; url: string };

const SOCIAL_BASE: Record<SocialLink['network'], (handle: string) => string> = {
  x: (handle) => `https://x.com/${handle}`,
  instagram: (handle) => `https://instagram.com/${handle}`,
  tiktok: (handle) => `https://tiktok.com/@${handle}`,
};

/** Enlaces oficiales a partir de los handles; ignora redes vacías. */
export function socialLinks(social: SocialT): SocialLink[] {
  const networks: SocialLink['network'][] = ['x', 'instagram', 'tiktok'];
  return networks.flatMap((network) => {
    const handle = social[network];
    return handle ? [{ network, handle, url: SOCIAL_BASE[network](handle) }] : [];
  });
}

const CONFIDENCE_RANK: Record<ConfidenceT, number> = {
  estimated: 0,
  single_source: 1,
  cross_checked: 2,
  verified: 3,
};

/** Une fuentes y queda con la confianza más baja de los campos consultados. */
export function provenanceSummary(
  provenance: Record<string, { source: string; confidence: ConfidenceT }>,
  fields: string[],
): { sources: string[]; confidence: ConfidenceT } | null {
  const entries = fields.map((field) => provenance[field]).filter((p) => p !== undefined);
  if (entries.length === 0) return null;
  const sources = [...new Set(entries.flatMap((p) => p.source.split(' + ').map((s) => s.trim())).filter(Boolean))];
  const confidence = entries.reduce<ConfidenceT>(
    (lowest, p) => (CONFIDENCE_RANK[p.confidence] < CONFIDENCE_RANK[lowest] ? p.confidence : lowest),
    entries[0]?.confidence ?? 'single_source',
  );
  return { sources, confidence };
}

/** Valor de mercado en euros; siempre se muestra como estimación en la UI. */
export function formatEuro(value: number | null | undefined, locale: string): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export type PendingField =
  | 'shirtNumber'
  | 'position'
  | 'nationality'
  | 'dateOfBirth'
  | 'birthPlace'
  | 'heightCm'
  | 'weightKg'
  | 'preferredFoot'
  | 'contractUntil';
const PENDING_ORDER: PendingField[] = [
  'shirtNumber',
  'position',
  'nationality',
  'dateOfBirth',
  'birthPlace',
  'heightCm',
  'weightKg',
  'preferredFoot',
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
