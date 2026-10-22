import type { MatchT } from '@/data/schemas';
import { monthKey } from '@/utils/matchTime';

const DONE = new Set(['FINISHED', 'AWARDED']);
const HIDDEN = new Set(['CANCELLED']);

export const isFinished = (m: MatchT): boolean => DONE.has(m.status);

/** Próximos (asc, incluye en juego/aplazados) y resultados (desc). */
export function splitMatches(matches: MatchT[]): { upcoming: MatchT[]; results: MatchT[] } {
  const byDate = (a: MatchT, b: MatchT) => Date.parse(a.utcDate) - Date.parse(b.utcDate);
  const upcoming = matches.filter((m) => !isFinished(m) && !HIDDEN.has(m.status)).sort(byDate);
  const results = matches.filter(isFinished).sort((a, b) => byDate(b, a));
  return { upcoming, results };
}

export function groupByMonth(matches: MatchT[]): { key: string; data: MatchT[] }[] {
  const groups: { key: string; data: MatchT[] }[] = [];
  for (const m of matches) {
    const key = monthKey(m.utcDate, m.status);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.data.push(m);
    else groups.push({ key, data: [m] });
  }
  return groups;
}

export const teamName = (t: { name: string; shortName: string | null }): string =>
  t.shortName ?? t.name;

/** Resultado desde el punto de vista del Depor (G/E/P) o null si no hay marcador. */
export function outcome(m: MatchT): 'W' | 'D' | 'L' | null {
  if (!isFinished(m)) return null;
  const { home, away } = m.score;
  if (home === null || away === null) return null;
  const mine = m.deporIsHome ? home : away;
  const theirs = m.deporIsHome ? away : home;
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}
