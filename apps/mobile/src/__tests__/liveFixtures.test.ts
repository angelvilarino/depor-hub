import type { FixturesT, MatchT } from '@/data/schemas';
import { mergeFixtures } from '@/data/live';

function match(id: number, utcDate: string, status = 'TIMED', home: number | null = null): MatchT {
  return {
    id,
    utcDate,
    status,
    matchday: 12,
    stage: 'REGULAR_SEASON',
    home: { id: 560, name: 'Deportivo', shortName: 'Depor', tla: 'DEP', crestUrl: null },
    away: { id: 78, name: 'Atleti', shortName: 'Atleti', tla: 'ATL', crestUrl: null },
    score: {
      home,
      away: home === null ? null : 1,
      halfTimeHome: null,
      halfTimeAway: null,
      winner: null,
    },
    deporIsHome: true,
    venue: 'Riazor',
    referee: null,
  };
}

const base: FixturesT = {
  updatedAt: '2026-11-05T10:00:00Z',
  season: '2026-27',
  matches: [match(1, '2026-11-07T15:15:00Z'), match(2, '2026-11-14T15:15:00Z')],
};

describe('mergeFixtures', () => {
  it('sin datos en directo devuelve la publicación intacta', () => {
    expect(mergeFixtures(base, null)).toBe(base);
  });

  it('reemplaza por id, añade partidos nuevos y ordena por fecha', () => {
    const live: FixturesT = {
      updatedAt: '2026-11-05T10:01:00Z',
      season: '2026-27',
      matches: [
        match(3, '2026-11-01T15:15:00Z', 'FINISHED', 2),
        match(1, '2026-11-07T15:15:00Z', 'IN_PLAY', 1),
      ],
    };
    const merged = mergeFixtures(base, live)!;
    expect(merged.updatedAt).toBe(live.updatedAt);
    expect(merged.matches.map((item) => item.id)).toEqual([3, 1, 2]);
    expect(merged.matches[1]!.status).toBe('IN_PLAY');
    expect(merged.matches[1]!.score.home).toBe(1);
  });

  it('ignora un directo más antiguo que la publicación (caché u offline)', () => {
    const old: FixturesT = {
      updatedAt: '2026-11-04T10:00:00Z',
      season: '2026-27',
      matches: [match(1, '2026-11-07T15:15:00Z', 'IN_PLAY', 1)],
    };
    expect(mergeFixtures(base, old)).toBe(base);
  });

  it('si cambia la temporada, manda el directo', () => {
    const next: FixturesT = { ...base, season: '2027-28' };
    expect(mergeFixtures(base, next)).toBe(next);
  });
});
