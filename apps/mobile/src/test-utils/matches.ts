import type { MatchT } from '@/data/schemas';

const team = (id: number, name: string) => ({ id, name, shortName: name, tla: null, crestUrl: null });

export function makeMatch(over: Partial<MatchT> = {}): MatchT {
  return {
    id: 1,
    utcDate: '2026-10-24T19:00:00Z',
    status: 'TIMED',
    matchday: 10,
    stage: 'REGULAR_SEASON',
    home: team(560, 'Deportivo'),
    away: team(78, 'Atleti'),
    score: { home: null, away: null, halfTimeHome: null, halfTimeAway: null, winner: null },
    deporIsHome: true,
    venue: null,
    referee: null,
    ...over,
  };
}
