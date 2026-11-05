import type { MatchSnapshotT } from '@/data/schemas';
import { snapshotToMatch } from '@/features/match/snapshot';

const snapshot: MatchSnapshotT = {
  matchId: 564635,
  season: '2026-27',
  capturedAt: '2026-11-04T09:44:45Z',
  source: 'football-data.org',
  status: 'FINISHED',
  utcDate: '2026-08-17T19:00:00Z',
  matchday: 1,
  stage: 'REGULAR_SEASON',
  home: { id: 560, name: 'RC Deportivo La Coruña', shortName: 'Deportivo', tla: 'DEP', crestUrl: null },
  away: { id: 285, name: 'Elche CF', shortName: 'Elche', tla: 'ELC', crestUrl: null },
  score: { home: 1, away: 1, halfTimeHome: 1, halfTimeAway: 0, winner: 'DRAW' },
  deporIsHome: true,
  venue: 'Estadio Abanca-Riazor',
  referee: 'Francisco Hernández Maeso',
};

describe('snapshotToMatch', () => {
  it('conserva marcador, sede y árbitro sin inventar campos', () => {
    expect(snapshotToMatch(snapshot)).toEqual({
      id: 564635,
      utcDate: '2026-08-17T19:00:00Z',
      status: 'FINISHED',
      matchday: 1,
      stage: 'REGULAR_SEASON',
      home: snapshot.home,
      away: snapshot.away,
      score: snapshot.score,
      deporIsHome: true,
      venue: 'Estadio Abanca-Riazor',
      referee: 'Francisco Hernández Maeso',
    });
  });
});
