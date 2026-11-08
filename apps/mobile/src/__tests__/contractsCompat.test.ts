import { Club, Fixtures, Rivalries, Squad, Standings, Titles } from '@/data/schemas';

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

describe('compatibilidad con JSON anterior a ADR 0025 (Club)', () => {
  it('un club.json mínimo rellena arrays y objetos opcionales', () => {
    const r = Club.safeParse({
      updatedAt: '2026-11-01T10:00:00Z',
      identity: { officialName: 'RC Deportivo' },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.identity.contact).toEqual({ email: null, phone: null, address: null });
    expect(r.data.identity.colors).toEqual([]);
    expect(r.data.anthems).toEqual([]);
    expect(r.data.crests).toEqual([]);
    expect(r.data.kits).toEqual([]);
    expect(r.data.stadium).toBeNull();
    expect(r.data.tickets).toBeNull();
    expect(r.data.museum).toBeNull();
    expect(r.data.trainingCenter).toBeNull();
    expect(r.data.board).toBeNull();
    expect(r.data.sponsors).toBeNull();
    expect(r.data.titles).toEqual([]);
    expect(r.data.rivalries).toEqual([]);
    expect(r.data.facts).toEqual([]);
    expect(r.data.links.website).toBeNull();
    expect(r.data.links.others).toEqual([]);
  });

  it('rellena los defaults aditivos del aforo y la galería del museo', () => {
    const r = Club.safeParse({
      updatedAt: '2026-11-01T10:00:00Z',
      identity: { officialName: 'RC Deportivo' },
      stadium: { name: 'Riazor', capacity: { total: 0 } },
      museum: {},
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.stadium?.capacity).toEqual({
      total: 0,
      breakdown: [],
      sourceUrl: null,
      confidence: 'single_source',
      status: 'pending_verification',
    });
    expect(r.data.museum?.media).toEqual([]);
  });

  it('rechaza una capacidad que no coincide con el desglose', () => {
    const r = Club.safeParse({
      updatedAt: '2026-11-01T10:00:00Z',
      identity: { officialName: 'RC Deportivo' },
      stadium: {
        name: 'Riazor',
        capacity: {
          total: 10,
          breakdown: [{ zone: 'Gradas', seats: 9 }],
        },
      },
    });
    expect(r.success).toBe(false);
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

describe('compatibilidad con JSON anterior a ADR 0032 (Titles / Rivalries)', () => {
  it('un TitleEdition sin finalMatch ni squad rellena con null/[]', () => {
    const r = Titles.safeParse({
      updatedAt: '2026-11-06T00:00:00Z',
      editions: [
        {
          competition: 'Copa del Rey',
          year: 1995,
          provenance: { source: 'manual' },
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const e = r.data.editions[0]!;
    expect(e.coachProvenance).toBeNull();
    expect(e.finalMatch).toBeNull();
    expect(e.squad).toEqual([]);
    expect(e.squadProvenance).toBeNull();
    expect(e.topScorers).toEqual([]);
    expect(e.media).toEqual([]);
    expect(e.status).toBe('pending_verification');
  });

  it('un Titles sin ediciones rellena editions con []', () => {
    const r = Titles.safeParse({ updatedAt: '2026-11-06T00:00:00Z' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.editions).toEqual([]);
  });

  it('un RivalryDetail sin headToHead ni iconicMatches rellena con null/[]', () => {
    const r = Rivalries.safeParse({
      updatedAt: '2026-11-06T00:00:00Z',
      rivalries: [
        {
          rival: 'RC Celta de Vigo',
          provenance: { source: 'BDFutbol', confidence: 'single_source', capturedAt: '2026-11-06' },
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const rv = r.data.rivalries[0]!;
    expect(rv.headToHead).toBeNull();
    expect(rv.iconicMatches).toEqual([]);
    expect(rv.facts).toEqual([]);
    expect(rv.media).toEqual([]);
    expect(rv.rivalBdfutbolId).toBeNull();
    expect(rv.tier).toBeNull();
  });

  it('un Rivalries sin rivalidades rellena con []', () => {
    const r = Rivalries.safeParse({ updatedAt: '2026-11-06T00:00:00Z' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rivalries).toEqual([]);
  });
});
