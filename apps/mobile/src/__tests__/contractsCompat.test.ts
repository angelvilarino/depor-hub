import { Fixtures, News, Squad, Standings } from '@/data/schemas';

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

describe('compatibilidad con JSON anterior a ADR 0012', () => {
  it('carrera y partidos sin escudos -> null', () => {
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
          career: [
            {
              club: 'Club Antiguo',
              from: '2014',
              to: '2017',
              appearances: 10,
              goals: 1,
              assists: null,
              minutes: 900,
              yellowCards: 1,
              redCards: 0,
              seasons: [],
            },
          ],
          deporMatches: [
            {
              date: '2026-05-24',
              opponent: 'Valladolid',
              competition: 'LaLiga',
              home: true,
              teamGoals: 2,
              opponentGoals: 0,
              result: 'W',
              started: true,
              minutes: 90,
              goals: 0,
              assists: null,
              yellowCards: 0,
              redCards: 0,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.players[0]!.career[0]!.crestUrl).toBeNull();
    expect(r.data.players[0]!.deporMatches[0]!.opponentCrestUrl).toBeNull();
  });
});

describe('compatibilidad con JSON anterior a ADR 0014', () => {
  it('entrenador y carrera sin campos nuevos -> defaults seguros', () => {
    const r = Squad.safeParse({
      updatedAt: '2026-10-20T10:00:00Z',
      coach: { name: 'Entrenador', nationality: 'Spain' },
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
          career: [{ club: 'Club Antiguo', from: '2014', to: '2017' }],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.coach?.birthPlace).toBeNull();
    expect(r.data.coach?.photoUrl).toBeNull();
    expect(r.data.coach?.career).toEqual([]);
    expect(r.data.coach?.staff).toEqual([]);
    expect(r.data.players[0]!.career[0]!.role).toBe('player');
  });
});

describe('contrato mínimo de noticias (H5)', () => {
  it('acepta un titular con solo los campos obligatorios y rellena defaults', () => {
    const r = News.safeParse({
      updatedAt: '2026-10-27T10:00:00Z',
      items: [
        {
          id: 'n1',
          title: 'Titular',
          url: 'https://example.test/n1',
          sourceName: 'Medio',
          publishedAt: '2026-10-27T09:00:00Z',
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.items[0]!.thumbnailUrl).toBeNull();
    expect(r.data.items[0]!.tags).toEqual([]);
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
