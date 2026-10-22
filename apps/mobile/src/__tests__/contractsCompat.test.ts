import { Fixtures, Standings } from '@/data/schemas';

// JSON publicado ANTES de ADR 0006 (sin crestUrl/venue/referee): debe seguir validando.
const oldTeam = { id: 1, name: 'A', shortName: null, tla: null };
const oldMatch = {
  id: 1,
  utcDate: '2026-10-24T19:00:00Z',
  status: 'TIMED',
  matchday: 10,
  stage: null,
  home: oldTeam,
  away: { ...oldTeam, id: 2, name: 'B' },
  score: { home: null, away: null, halfTimeHome: null, halfTimeAway: null, winner: null },
  deporIsHome: true,
};

describe('compatibilidad con JSON anterior a ADR 0006', () => {
  it('fixtures sin campos nuevos -> null', () => {
    const r = Fixtures.safeParse({ updatedAt: '2026-10-20T10:00:00Z', season: '2026-27', matches: [oldMatch] });
    expect(r.success).toBe(true);
    if (r.success) {
      const m = r.data.matches[0]!;
      expect([m.venue, m.referee, m.home.crestUrl]).toEqual([null, null, null]);
    }
  });

  it('standings sin crestUrl -> null', () => {
    const row = {
      position: 1, team: oldTeam, played: 1, won: 1, draw: 0, lost: 0, points: 3,
      goalsFor: 1, goalsAgainst: 0, goalDifference: 1, form: null,
    };
    const r = Standings.safeParse({ updatedAt: '2026-10-20T10:00:00Z', season: '2026-27', matchday: 1, table: [row] });
    expect(r.success).toBe(true);
  });
});
