import { Fixtures, Squad, Standings } from '@/data/schemas';

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

describe('compatibilidad con JSON anterior a ADR 0008', () => {
  const oldPlayer = {
    id: 1,
    name: 'Jugador Antiguo',
    position: 'Midfield',
    dateOfBirth: '2000-01-31',
    nationality: 'Spain',
    shirtNumber: null,
    contractUntil: null,
    heightCm: null,
  };

  it('squad sin campos de enriquecimiento -> defaults seguros', () => {
    const r = Squad.safeParse({
      updatedAt: '2026-10-20T10:00:00Z',
      coach: { name: 'Entrenador', nationality: 'Spain' },
      players: [oldPlayer],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const p = r.data.players[0]!;
    expect(p.birthPlace).toBeNull();
    expect(p.preferredFoot).toBeNull();
    expect(p.loanTo).toBeNull();
    expect(p.social).toEqual({ x: null, instagram: null, tiktok: null });
    expect(p.career).toEqual([]);
    expect(p.careerTotals.appearances).toBeNull();
    expect(p.deporMatches).toEqual([]);
    expect(p.provenance).toEqual({});
    expect(p.photos).toEqual([]);
    expect(r.data.coach?.birthDate).toBeNull();
    expect(r.data.coach?.provenance).toEqual({});
  });
});

describe('compatibilidad con JSON anterior a ADR 0009', () => {
  it('foto con solo url -> defaults seguros', () => {
    const r = Squad.safeParse({
      updatedAt: '2026-10-20T10:00:00Z',
      coach: null,
      players: [
        {
          id: 1,
          name: 'Jugador Antiguo',
          position: 'Midfield',
          dateOfBirth: '2000-01-31',
          nationality: 'Spain',
          shirtNumber: null,
          contractUntil: null,
          heightCm: null,
          photos: [{ url: 'https://example.org/foto.jpg' }],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.players[0]!.photos[0]).toEqual({
      url: 'https://example.org/foto.jpg',
      role: 'portrait',
      width: null,
      height: null,
      license: null,
      licenseUrl: null,
      author: null,
      credit: null,
      sourceUrl: null,
    });
  });
});
