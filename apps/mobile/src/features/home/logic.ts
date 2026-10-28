import type { MatchT, StandingsT, StandingRowT, TeamRefT } from '@/data/schemas';
import { isFinished, outcome, splitMatches } from '@/features/calendar/logic';

export type FormResult = 'W' | 'D' | 'L';

export type SeasonSummary = {
  row: StandingRowT;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type OpponentBalance = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type OpponentInfo = {
  match: MatchT;
  opponent: TeamRefT;
  row: StandingRowT | null;
  balance: OpponentBalance | null;
  form: FormResult[];
};

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
  nowMs: number;
};

const LIVE = new Set(['IN_PLAY', 'PAUSED']);

/** Estados que no deben ocupar el hero: un aplazado no es «el próximo partido». */
const NOT_HERO = new Set(['POSTPONED', 'CANCELLED']);

/** El próximo partido jugable: el primero de splitMatches().upcoming sin aplazados. */
export function selectNextMatch(matches: MatchT[]): MatchT | null {
  return splitMatches(matches).upcoming.find((match) => !NOT_HERO.has(match.status)) ?? null;
}

/**
 * Aviso discreto cuando el partido cronológicamente más cercano está aplazado.
 * Devuelve null si el aplazado no es anterior al próximo partido jugable.
 */
export function selectPostponedNotice(matches: MatchT[]): MatchT | null {
  const postponed = splitMatches(matches).upcoming.find(
    (match) => match.status === 'POSTPONED',
  );
  if (!postponed) return null;
  const next = selectNextMatch(matches);
  if (!next) return postponed;
  return Date.parse(postponed.utcDate) <= Date.parse(next.utcDate) ? postponed : null;
}

/** El último resultado es el más reciente de splitMatches().results. */
export function selectLastResult(matches: MatchT[]): MatchT | null {
  return splitMatches(matches).results[0] ?? null;
}

/**
 * Ventana de 5 filas centrada en el equipo cuando se puede. En los extremos se
 * desplaza para que siempre haya 5 filas si la clasificación tiene al menos 5.
 */
export function miniTableWindow(
  table: StandingRowT[],
  teamId: number,
  radius = 2,
): StandingRowT[] {
  if (table.length === 0) return [];
  const sorted = [...table].sort((a, b) => a.position - b.position);
  const index = sorted.findIndex((row) => row.team.id === teamId);
  if (index === -1) return [];
  const size = radius * 2 + 1;
  const start = Math.max(0, Math.min(index - radius, sorted.length - size));
  return sorted.slice(start, start + size);
}

/** Últimos `n` resultados en orden cronológico (el más antiguo primero). */
export function recentForm(matches: MatchT[], n = 5): FormResult[] {
  if (n <= 0) return [];
  return matches
    .filter((match) => isFinished(match) && outcome(match) !== null)
    .sort((a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate))
    .slice(-n)
    .map((match) => outcome(match) as FormResult);
}

export function seasonSummary(
  standings: StandingsT | undefined,
  teamId: number,
): SeasonSummary | null {
  const row = standings?.table.find((candidate) => candidate.team.id === teamId);
  if (!row) return null;
  return {
    row,
    position: row.position,
    points: row.points,
    played: row.played,
    won: row.won,
    drawn: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
  };
}

/**
 * Próximo rival con su fila de clasificación y el balance de la temporada contra él.
 * El balance es null si aún no se han jugado partidos (no se inventa un 0-0-0).
 */
export function nextOpponentInfo(
  matches: MatchT[],
  table: StandingRowT[],
  teamId: number,
): OpponentInfo | null {
  const next = selectNextMatch(matches);
  if (!next) return null;
  const opponent = next.home.id === teamId ? next.away : next.home;
  const row = table.find((candidate) => candidate.team.id === opponent.id) ?? null;

  let played = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const recent: { date: number; result: FormResult }[] = [];
  for (const match of matches) {
    if (!isFinished(match)) continue;
    const isOpponent =
      match.home.id === opponent.id || match.away.id === opponent.id;
    if (!isOpponent) continue;
    const result = outcome(match);
    if (result === null) continue;
    const mine = match.deporIsHome ? match.score.home : match.score.away;
    const theirs = match.deporIsHome ? match.score.away : match.score.home;
    if (mine === null || theirs === null) continue;
    played += 1;
    goalsFor += mine;
    goalsAgainst += theirs;
    if (result === 'W') won += 1;
    else if (result === 'D') drawn += 1;
    else lost += 1;

    // Racha del rival desde su punto de vista, no desde el del Depor.
    const opponentIsHome = match.home.id === opponent.id;
    const rivalFor = opponentIsHome ? match.score.home : match.score.away;
    const rivalAgainst = opponentIsHome ? match.score.away : match.score.home;
    if (rivalFor === null || rivalAgainst === null) continue;
    recent.push({
      date: Date.parse(match.utcDate),
      result: rivalFor > rivalAgainst ? 'W' : rivalFor < rivalAgainst ? 'L' : 'D',
    });
  }

  return {
    match: next,
    opponent,
    row,
    balance:
      played > 0 ? { played, won, drawn, lost, goalsFor, goalsAgainst } : null,
    form: recent
      .sort((a, b) => a.date - b.date)
      .slice(-5)
      .map((entry) => entry.result),
  };
}

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: targetMs <= nowMs,
    nowMs,
  };
}

/** Diferencia de días de calendario en UTC (SCHEDULED no tiene hora fiable). */
export function utcDayDiff(targetIso: string, nowMs: number): number {
  const target = new Date(targetIso);
  if (Number.isNaN(target.getTime())) return 0;
  const now = new Date(nowMs);
  const targetDay = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((targetDay - nowDay) / 86_400_000);
}

export const isLive = (match: MatchT): boolean => LIVE.has(match.status);

/**
 * Estado de presentación del partido. No se inventa nada: un TIMED que ya pasó su
 * hora se queda en `awaiting_result` (la API todavía no ha actualizado el estado).
 */
export type MatchPhase =
  | 'tbc'
  | 'upcoming'
  | 'live'
  | 'awaiting_result'
  | 'finished'
  | 'postponed'
  | 'suspended'
  | 'cancelled'
  | 'unknown';

export function matchPhase(match: MatchT, nowMs: number): MatchPhase {
  switch (match.status) {
    case 'SCHEDULED':
      return 'tbc';
    case 'TIMED':
      return Date.parse(match.utcDate) > nowMs ? 'upcoming' : 'awaiting_result';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
    case 'AWARDED':
      return match.score.home !== null && match.score.away !== null
        ? 'finished'
        : 'awaiting_result';
    case 'POSTPONED':
      return 'postponed';
    case 'SUSPENDED':
      return 'suspended';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/** Un resultado se destaca en Home durante 24 h desde el inicio del partido. */
export function isRecentResult(match: MatchT, nowMs: number, windowMs = 86_400_000): boolean {
  if (!isFinished(match)) return false;
  const kickoff = Date.parse(match.utcDate);
  return !Number.isNaN(kickoff) && nowMs - kickoff <= windowMs;
}

/** Solo TIMED puede tener cuenta atrás; SCHEDULED no tiene hora y los aplazados no son fiables. */
export const hasCountdown = (match: MatchT): boolean => match.status === 'TIMED';

/** Los segundos solo se muestran en TIMED y a menos de una hora. */
export const showsSeconds = (targetMs: number, nowMs: number): boolean =>
  targetMs > nowMs && targetMs - nowMs < 3_600_000;
