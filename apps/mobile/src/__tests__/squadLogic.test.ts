import { Squad } from '@/data/schemas';
import type { FixturesT, PlayerT } from '@/data/schemas';
import {
  AVATAR_COLORS,
  ageFrom,
  averageAge,
  avatarColor,
  careerByRole,
  careerChronological,
  clubKey,
  coachRecord,
  countryFlag,
  filterSquad,
  fixtureForMatch,
  formatEuro,
  formatNumber,
  formatPartialDate,
  groupSquad,
  groupStaff,
  hasCareerTotals,
  initials,
  matchScore,
  matchesInSeason,
  mergeCareerPeriods,
  normalizeSearch,
  pendingFields,
  positionGroup,
  provenanceSummary,
  seasonRange,
  shortSeason,
  socialLinks,
  squadCounts,
  summarizeMatches,
} from '@/features/squad/logic';
import { contrastRatio } from '@/utils/contrast';

const player = (over: Partial<PlayerT> = {}): PlayerT => ({
  id: 1,
  name: 'Jugador Uno',
  position: 'Midfield',
  dateOfBirth: '2000-01-31',
  nationality: 'Spain',
  shirtNumber: null,
  contractUntil: null,
  heightCm: null,
  birthPlace: null,
  preferredFoot: null,
  loanFrom: null,
  loanTo: null,
  marketValueEur: null,
  weightKg: null,
  social: { x: null, instagram: null, tiktok: null },
  photos: [],
  career: [],
  careerTotals: {
    appearances: null,
    goals: null,
    assists: null,
    minutes: null,
    yellowCards: null,
    redCards: null,
  },
  deporMatches: [],
  provenance: {},
  ...over,
});

describe('positionGroup', () => {
  it.each([
    ['Goalkeeper', 'GK'],
    ['Defence', 'DF'],
    ['Centre-Back', 'DF'],
    ['Midfield', 'MF'],
    ['Defensive Midfield', 'MF'],
    ['Offence', 'FW'],
    ['Left Winger', 'FW'],
    [null, 'OTHER'],
    ['Coach', 'OTHER'],
  ])('%s -> %s', (pos, group) => {
    expect(positionGroup(pos)).toBe(group);
  });
});

describe('groupSquad', () => {
  it('agrupa en orden portero/defensa/centro/delantero y omite grupos vacíos', () => {
    const groups = groupSquad([
      player({ id: 1, name: 'Delta', position: 'Offence' }),
      player({ id: 2, name: 'Zeta', position: 'Goalkeeper' }),
      player({ id: 3, name: 'Beta', position: 'Midfield' }),
      player({ id: 4, name: 'Alfa', position: 'Midfield' }),
    ]);
    expect(groups.map((g) => g.group)).toEqual(['GK', 'MF', 'FW']);
    expect(groups[1]?.data.map((p) => p.name)).toEqual(['Alfa', 'Beta']);
  });

  it('con dorsal va primero y ascendente; sin dorsal, por nombre', () => {
    const [mf] = groupSquad([
      player({ id: 1, name: 'Ana' }),
      player({ id: 2, name: 'Zoe', shirtNumber: 10 }),
      player({ id: 3, name: 'Eva', shirtNumber: 4 }),
    ]);
    expect(mf?.data.map((p) => p.id)).toEqual([3, 2, 1]);
  });
});

describe('búsqueda y filtros', () => {
  const players = [
    player({ id: 1, name: 'Álvaro López', position: 'Midfield', shirtNumber: 8 }),
    player({ id: 2, name: 'Portero Dos', position: 'Goalkeeper', shirtNumber: 1 }),
    player({ id: 3, name: 'Delantero Tres', position: 'Offence', shirtNumber: 9 }),
  ];

  it('normaliza mayúsculas y tildes', () => {
    expect(normalizeSearch('  ÁLVARO  ')).toBe('alvaro');
    expect(normalizeSearch(null)).toBe('');
  });

  it('busca por nombre o dorsal y respeta el grupo', () => {
    expect(filterSquad(players, 'alvaro', 'ALL').map((p) => p.id)).toEqual([1]);
    expect(filterSquad(players, '9', 'ALL').map((p) => p.id)).toEqual([3]);
    expect(filterSquad(players, '', 'GK').map((p) => p.id)).toEqual([2]);
    expect(filterSquad(players, 'portero', 'FW')).toEqual([]);
  });

  it('cuenta todos los grupos y la edad media', () => {
    expect(squadCounts(players)).toEqual({ ALL: 3, GK: 1, DF: 0, MF: 1, FW: 1, OTHER: 0 });
    const now = Date.UTC(2026, 9, 22);
    expect(averageAge(players, now)).toBe(26);
    expect(averageAge([], now)).toBeNull();
  });

  it('banderas de países conocidos y null para el resto', () => {
    expect(countryFlag('Spain')).toBe('🇪🇸');
    expect(countryFlag('United States')).toBe('🇺🇸');
    expect(countryFlag('Atlantis')).toBeNull();
    expect(countryFlag(null)).toBeNull();
  });
});

describe('ageFrom', () => {
  const now = Date.UTC(2026, 9, 22, 12, 0, 0);
  it('antes y después del cumpleaños', () => {
    expect(ageFrom('2000-10-23', now)).toBe(25);
    expect(ageFrom('2000-10-22', now)).toBe(26);
    expect(ageFrom('2000-01-31', now)).toBe(26);
  });
  it('29 de febrero', () => {
    expect(ageFrom('2000-02-29', Date.UTC(2026, 1, 28))).toBe(25);
    expect(ageFrom('2000-02-29', Date.UTC(2026, 2, 1))).toBe(26);
  });
  it('dato ausente, inválido o futuro -> null', () => {
    expect(ageFrom(null, now)).toBeNull();
    expect(ageFrom('1998', now)).toBeNull();
    expect(ageFrom('2030-01-01', now)).toBeNull();
  });
});

describe('formatPartialDate', () => {
  it('año, mes y día completo', () => {
    expect(formatPartialDate('2028', 'es')).toBe('2028');
    expect(formatPartialDate('2028-06', 'en')).toContain('2028');
    expect(formatPartialDate('2028-06-30', 'en')).toContain('30');
  });
  it('null y texto desconocido', () => {
    expect(formatPartialDate(null, 'es')).toBeNull();
    expect(formatPartialDate('junio 2028', 'es')).toBe('junio 2028');
  });
});

describe('pendingFields', () => {
  it('lista lo que falta, en orden estable', () => {
    expect(pendingFields(player())).toEqual([
      'shirtNumber',
      'birthPlace',
      'heightCm',
      'weightKg',
      'preferredFoot',
      'contractUntil',
    ]);
  });
  it('un jugador completo no tiene pendientes', () => {
    const full = player({
      shirtNumber: 8,
      birthPlace: 'A Coruña',
      heightCm: 180,
      weightKg: 75,
      preferredFoot: 'right',
      contractUntil: '2028-06-30',
    });
    expect(pendingFields(full)).toEqual([]);
  });
  it('caché antigua sin heightCm cuenta como pendiente', () => {
    const old = { ...player(), heightCm: undefined } as unknown as PlayerT;
    expect(pendingFields(old)).toContain('heightCm');
  });
});

describe('carrera', () => {
  const entry = (over: Partial<PlayerT['career'][number]> = {}) => ({
    club: 'Depor',
    crestUrl: null,
    role: 'player' as const,
    from: '2014',
    to: '2017',
    appearances: null,
    goals: null,
    assists: null,
    minutes: null,
    yellowCards: null,
    redCards: null,
    seasons: [],
    ...over,
  });

  it('rango de temporadas, incluido el club actual y una sola temporada', () => {
    expect(seasonRange('2014', '2017')).toBe('2014–2017');
    expect(seasonRange('2009', '2010')).toBe('2009-10');
    expect(seasonRange('2026', null)).toBe('2026–');
    expect(seasonRange(null, '2017')).toBeNull();
  });

  it('ordena de más antigua a más reciente sin mutar', () => {
    const input = [entry({ club: 'B', from: '2019' }), entry({ club: 'A', from: '2014' })];
    expect(careerChronological(input).map((e) => e.club)).toEqual(['A', 'B']);
    expect(input.map((e) => e.club)).toEqual(['B', 'A']);
  });

  it('sin fechas conocidas van al final', () => {
    const input = [entry({ club: 'X', from: null }), entry({ club: 'Y', from: '2020' })];
    expect(careerChronological(input).map((e) => e.club)).toEqual(['Y', 'X']);
  });

  it('temporada corta para el selector de la ficha', () => {
    expect(shortSeason('2026-27')).toBe('26-27');
    expect(shortSeason('2025-2026')).toBe('25-26');
    expect(shortSeason(null)).toBeNull();
  });

  it('unifica etapas contiguas del mismo club y suma sus datos', () => {
    const input = [
      entry({ club: 'Depor', from: '2014', to: '2015', appearances: 10, goals: 2 }),
      entry({ club: 'Depor', from: '2016', to: '2017', appearances: 20, goals: 3 }),
      entry({ club: 'Rival', from: '2018', to: '2019', appearances: 5, goals: 0 }),
    ];
    const merged = mergeCareerPeriods(input);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ club: 'Depor', from: '2014', to: '2017', appearances: 30, goals: 5 });
    expect(merged[1]?.club).toBe('Rival');
    expect(input[0]?.to).toBe('2015');
  });

  it('separa etapas del mismo club si hay un hueco o cambia el rol', () => {
    const input = [
      entry({ club: 'Depor', from: '2014', to: '2015' }),
      entry({ club: 'Depor', from: '2018', to: '2019' }),
      entry({ club: 'Depor', from: '2020', to: '2021', role: 'coach' }),
    ];
    expect(mergeCareerPeriods(input)).toHaveLength(3);
    expect(careerByRole(input, 'coach').map((e) => e.club)).toEqual(['Depor']);
    expect(careerByRole(input, 'player')).toHaveLength(2);
  });
});

describe('entrenador y cuerpo técnico', () => {
  const finished = (over: Partial<FixturesT['matches'][number]> = {}) => ({
    id: 1,
    utcDate: '2026-08-20T18:00:00Z',
    status: 'FINISHED',
    matchday: 1,
    stage: null,
    home: {
      id: 1,
      name: 'Depor',
      shortName: 'Depor',
      tla: 'DEP',
      crestUrl: null,
    },
    away: {
      id: 2,
      name: 'Rival',
      shortName: 'Rival',
      tla: 'RIV',
      crestUrl: null,
    },
    score: { home: 2, away: 1, halfTimeHome: 1, halfTimeAway: 0, winner: 'HOME_TEAM' },
    deporIsHome: true,
    venue: null,
    referee: null,
    ...over,
  });

  it('calcula el balance solo con partidos terminados y desde el año de llegada', () => {
    const fixtures: FixturesT = {
      updatedAt: '2026-10-20T10:00:00Z',
      season: '2026-27',
      matches: [
        finished({ id: 1, score: { home: 2, away: 1, halfTimeHome: 1, halfTimeAway: 0, winner: 'HOME_TEAM' } }),
        finished({
          id: 2,
          utcDate: '2026-09-01T18:00:00Z',
          score: { home: 0, away: 0, halfTimeHome: 0, halfTimeAway: 0, winner: 'DRAW' },
        }),
        finished({
          id: 3,
          utcDate: '2026-09-10T18:00:00Z',
          score: { home: 0, away: 3, halfTimeHome: 0, halfTimeAway: 1, winner: 'AWAY_TEAM' },
        }),
        finished({ id: 4, utcDate: '2027-01-01T18:00:00Z', status: 'SCHEDULED' }),
        finished({ id: 5, utcDate: '2024-01-01T18:00:00Z' }),
      ],
    };
    expect(coachRecord(fixtures, '2025')).toEqual({
      played: 3,
      won: 1,
      drawn: 1,
      lost: 1,
      goalsFor: 2,
      goalsAgainst: 4,
      points: 4,
    });
    expect(coachRecord(fixtures, null)?.played).toBe(4);
    expect(coachRecord(null, '2025')).toBeNull();
  });

  it('agrupa el staff por rol y conserva el orden de la web oficial', () => {
    const groups = groupStaff([
      { name: 'Analista', role: 'analyst', photoUrl: null },
      { name: 'Segundo', role: 'assistant_coach', photoUrl: null },
      { name: 'Preparador', role: 'fitness_coach', photoUrl: null },
      { name: 'Otro segundo', role: 'assistant_coach', photoUrl: null },
      { name: 'Rol raro', role: 'otro', photoUrl: null },
    ]);
    expect(groups.map((g) => g.role)).toEqual([
      'assistant_coach',
      'fitness_coach',
      'analyst',
      'otro',
    ]);
    expect(groups[0]?.members.map((m) => m.name)).toEqual(['Segundo', 'Otro segundo']);
  });

  it('número localizado y bandera de España con nombre nativo', () => {
    expect(formatNumber(16992, 'es')).toBe('16.992');
    expect(formatNumber(16992, 'en')).toBe('16,992');
    expect(countryFlag('España')).toBe('🇪🇸');
  });
});

describe('totales y partidos', () => {
  it('detecta totales con algún dato', () => {
    expect(hasCareerTotals({ ...player().careerTotals })).toBe(false);
    expect(hasCareerTotals({ ...player().careerTotals, goals: 0 })).toBe(true);
  });

  it('resume partidos y respeta los datos desconocidos', () => {
    const base: Omit<PlayerT['deporMatches'][number], 'date'> = {
      opponent: 'Rival',
      opponentCrestUrl: null,
      competition: null,
      home: true,
      teamGoals: null,
      opponentGoals: null,
      result: null,
      started: null,
      minutes: null,
      goals: null,
      assists: null,
      yellowCards: null,
      redCards: null,
    };
    expect(summarizeMatches([])).toBeNull();
    expect(
      summarizeMatches([
        { ...base, date: '2026-01-01', minutes: 90, goals: 1 },
        { ...base, date: '2026-02-01', minutes: 30, goals: 0, yellowCards: 1 },
      ]),
    ).toEqual({ appearances: 2, goals: 1, assists: null, minutes: 120, yellowCards: 1, redCards: null });
  });

  it('filtra los partidos de la temporada publicada y conserva los de julio y junio', () => {
    const base: Omit<PlayerT['deporMatches'][number], 'date'> = {
      opponent: 'Rival',
      opponentCrestUrl: null,
      competition: null,
      home: true,
      teamGoals: null,
      opponentGoals: null,
      result: null,
      started: null,
      minutes: null,
      goals: null,
      assists: null,
      yellowCards: null,
      redCards: null,
    };
    const matches = [
      { ...base, date: '2025-06-30' },
      { ...base, date: '2025-07-01' },
      { ...base, date: '2026-06-30' },
      { ...base, date: '2026-07-01' },
    ];
    expect(matchesInSeason(matches, '2025-26').map((m) => m.date)).toEqual([
      '2025-07-01',
      '2026-06-30',
    ]);
    expect(matchesInSeason(matches, null)).toHaveLength(4);
    expect(matchesInSeason(matches, 'sin temporada')).toHaveLength(4);
  });

  it('marcador y enlaces sociales', () => {
    const match: PlayerT['deporMatches'][number] = {
      date: '2026-01-01',
      opponent: 'Rival',
      opponentCrestUrl: null,
      competition: null,
      home: true,
      teamGoals: 2,
      opponentGoals: 1,
      result: 'W',
      started: true,
      minutes: 90,
      goals: 0,
      assists: null,
      yellowCards: 0,
      redCards: 0,
    };
    expect(matchScore(match)).toBe('2–1');
    expect(socialLinks({ x: 'depor', instagram: null, tiktok: 'deporhub' })).toEqual([
      { network: 'x', handle: 'depor', url: 'https://x.com/depor' },
      { network: 'tiktok', handle: 'deporhub', url: 'https://tiktok.com/@deporhub' },
    ]);
    expect(socialLinks({ x: null, instagram: null, tiktok: null })).toEqual([]);
  });

  it('valor de mercado en euros', () => {
    expect(formatEuro(null, 'es')).toBeNull();
    expect(formatEuro(5_000_000, 'es')).toContain('5');
    expect(formatEuro(5_000_000, 'es')).toContain('€');
  });

  it('resumen de procedencia con la confianza más baja', () => {
    const prov = {
      career: { source: 'BDFutbol + Wikidata', confidence: 'cross_checked' as const },
      careerTotals: { source: 'BDFutbol', confidence: 'single_source' as const },
    };
    expect(provenanceSummary(prov, ['career', 'careerTotals'])).toEqual({
      sources: ['BDFutbol', 'Wikidata'],
      confidence: 'single_source',
    });
    expect(provenanceSummary(prov, ['unknown'])).toBeNull();
  });
});

describe('partido de la ficha y fixture', () => {
  const depor = {
    id: 1,
    name: 'Real Club Deportivo de La Coruña',
    shortName: 'Depor',
    tla: 'DEP',
    crestUrl: null,
  };
  const rival = {
    id: 2,
    name: 'Real Valladolid CF',
    shortName: 'Valladolid',
    tla: 'VLL',
    crestUrl: null,
  };
  const match = (over: Partial<PlayerT['deporMatches'][number]> = {}) => ({
    date: '2026-05-24',
    opponent: 'Valladolid',
    opponentCrestUrl: null,
    competition: null,
    home: false,
    teamGoals: 2,
    opponentGoals: 0,
    result: 'W' as const,
    started: true,
    minutes: 90,
    goals: 1,
    assists: null,
    yellowCards: 0,
    redCards: 0,
    ...over,
  });
  const fixture = (over: Partial<FixturesT['matches'][number]> = {}) => ({
    id: 42,
    utcDate: '2026-05-24T18:00:00Z',
    status: 'FINISHED',
    matchday: 40,
    stage: null,
    home: rival,
    away: depor,
    score: { home: 0, away: 2, halfTimeHome: 0, halfTimeAway: 1, winner: 'AWAY_TEAM' },
    deporIsHome: false,
    venue: null,
    referee: null,
    ...over,
  });
  const fixtures = (matches: FixturesT['matches']): FixturesT => ({
    updatedAt: '2026-05-25T10:00:00Z',
    season: '2025-26',
    matches,
  });

  it('normaliza el nombre del club quitando siglas y artículos', () => {
    expect(clubKey('Real Club Deportivo de La Coruña')).toBe('real deportivo coruna');
    expect(clubKey('Real Valladolid CF')).toBe('real valladolid');
  });

  it('encuentra el fixture por fecha, localía y rival', () => {
    expect(fixtureForMatch(match(), fixtures([fixture()]))?.id).toBe(42);
    expect(fixtureForMatch(match({ opponent: 'Real Valladolid' }), fixtures([fixture()]))?.id).toBe(42);
  });

  it('no enlaza si cambia la fecha, la localía o el rival', () => {
    expect(fixtureForMatch(match({ date: '2026-05-25' }), fixtures([fixture()]))).toBeNull();
    expect(fixtureForMatch(match({ home: true }), fixtures([fixture()]))).toBeNull();
    expect(fixtureForMatch(match({ opponent: 'Otro Club' }), fixtures([fixture()]))).toBeNull();
    expect(fixtureForMatch(match(), null)).toBeNull();
  });

  it('no enlaza si hay más de un candidato', () => {
    expect(fixtureForMatch(match(), fixtures([fixture(), fixture({ id: 43 })]))).toBeNull();
  });
});

describe('avatar', () => {
  it('iniciales', () => {
    expect(initials('Pierre-Emerick Aubameyang')).toBe('PA');
    expect(initials('Peke')).toBe('PE');
    expect(initials('  ')).toBe('?');
  });
  it('color estable y con contraste AA frente a blanco', () => {
    expect(avatarColor(42)).toBe(avatarColor(42));
    expect(avatarColor(-7)).toBeDefined();
    AVATAR_COLORS.forEach((c) => expect(contrastRatio('#FFFFFF', c)).toBeGreaterThanOrEqual(4.5));
  });
});

describe('contrato Squad', () => {
  it('JSON publicado antes del ADR 0007 (sin heightCm) valida y da null', () => {
    const old: Record<string, unknown> = { ...player() };
    delete old.heightCm;
    const r = Squad.safeParse({ updatedAt: '2026-10-20T10:00:00Z', coach: null, players: [old] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.players[0]?.heightCm).toBeNull();
  });
});
