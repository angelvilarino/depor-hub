import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import type { FixturesT, PlayerT } from '@/data/schemas';
import PlayerDetail from '../../app/player/[id]';

const mockUseSquad = jest.fn();
const mockUseFixtures = jest.fn();
const mockUseMeta = jest.fn();
const mockOpenURL = jest.fn();
const mockPush = jest.fn();
const mockParams: { id: string } = { id: '1' };
let mockReducedMotion = false;

jest.mock('@/theme/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('@/data/queries', () => ({
  useSquad: () => mockUseSquad(),
  useFixtures: () => mockUseFixtures(),
  useMeta: () => mockUseMeta(),
}));
jest.mock('expo-linking', () => ({ openURL: (...args: unknown[]) => mockOpenURL(...args) }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const today = new Date();
let expectedAge = today.getUTCFullYear() - 1998;
if (
  today.getUTCMonth() + 1 < 4 ||
  (today.getUTCMonth() + 1 === 4 && today.getUTCDate() < 13)
) {
  expectedAge -= 1;
}

const basePlayer: PlayerT = {
  id: 1,
  name: 'Jugador Completo',
  position: 'Goalkeeper',
  dateOfBirth: '1998-04-13',
  nationality: 'Spain',
  shirtNumber: 25,
  contractUntil: '2027',
  heightCm: 186,
  birthPlace: 'Arnedo (La Rioja), España',
  preferredFoot: 'left',
  loanFrom: null,
  loanTo: null,
  marketValueEur: 5_000_000,
  weightKg: 80,
  social: { x: 'deporhub', instagram: null, tiktok: null },
  photos: [
    {
      url: 'https://cdn.example.org/jugador-large.jpg',
      role: 'portrait',
      width: null,
      height: null,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      author: 'Autora de Ejemplo',
      credit: '© Autora de Ejemplo',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jugador.jpg',
    },
  ],
  career: [
    {
      club: 'Club Nuevo',
      crestUrl: 'https://crest.example.org/nuevo.png',
      role: 'player',
      from: '2020',
      to: '2022',
      appearances: 10,
      goals: 2,
      assists: null,
      minutes: 900,
      yellowCards: 1,
      redCards: 0,
      seasons: [
        {
          season: '2020-21',
          appearances: 10,
          goals: 2,
          assists: null,
          minutes: 900,
          yellowCards: 1,
          redCards: 0,
        },
      ],
    },
    {
      club: 'Club Antiguo',
      crestUrl: null,
      role: 'player',
      from: '2014',
      to: null,
      appearances: 19,
      goals: 0,
      assists: null,
      minutes: 1710,
      yellowCards: 2,
      redCards: 0,
      seasons: [],
    },
  ],
  careerTotals: {
    appearances: 191,
    goals: 4,
    assists: null,
    minutes: 16992,
    yellowCards: 13,
    redCards: 0,
  },
  deporMatches: [
    {
      date: '2026-05-24',
      opponent: 'Valladolid',
      opponentCrestUrl: 'https://crest.example.org/valladolid.png',
      competition: 'LaLiga Hypermotion',
      home: false,
      teamGoals: 2,
      opponentGoals: 0,
      result: 'W',
      started: true,
      minutes: 90,
      goals: 1,
      assists: null,
      yellowCards: 0,
      redCards: 0,
    },
    {
      date: '2024-01-15',
      opponent: 'Rival Antiguo',
      opponentCrestUrl: null,
      competition: 'LaLiga Hypermotion',
      home: true,
      teamGoals: 1,
      opponentGoals: 1,
      result: 'D',
      started: true,
      minutes: 45,
      goals: 0,
      assists: null,
      yellowCards: 0,
      redCards: 0,
    },
  ],
  provenance: {
    shirtNumber: { source: 'Wikipedia', confidence: 'single_source', capturedAt: null },
    heightCm: { source: 'BDFutbol + Wikidata', confidence: 'cross_checked', capturedAt: null },
    career: { source: 'BDFutbol + Wikidata', confidence: 'cross_checked', capturedAt: null },
    careerTotals: { source: 'BDFutbol', confidence: 'single_source', capturedAt: null },
    deporMatches: { source: 'BDFutbol', confidence: 'single_source', capturedAt: null },
    social: { source: 'Wikidata', confidence: 'single_source', capturedAt: null },
  },
};

const fixtures: FixturesT = {
  updatedAt: '2026-05-25T10:00:00Z',
  season: '2025-26',
  matches: [
    {
      id: 42,
      utcDate: '2026-05-24T18:00:00Z',
      status: 'FINISHED',
      matchday: 40,
      stage: null,
      home: {
        id: 2,
        name: 'Real Valladolid CF',
        shortName: 'Valladolid',
        tla: 'VLL',
        crestUrl: null,
      },
      away: {
        id: 1,
        name: 'Real Club Deportivo de La Coruña',
        shortName: 'Depor',
        tla: 'DEP',
        crestUrl: null,
      },
      score: { home: 0, away: 2, halfTimeHome: 0, halfTimeAway: 1, winner: 'AWAY_TEAM' },
      deporIsHome: false,
      venue: null,
      referee: null,
    },
  ],
};

const squad = (players: PlayerT[], isPending = false) => ({
  data: { updatedAt: '2026-10-25T10:00:00Z', coach: null, players },
  dataUpdatedAt: Date.parse('2026-10-25T10:00:00Z'),
  isPending,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockUseSquad.mockReset();
  mockUseFixtures.mockReset();
  mockUseMeta.mockReset();
  mockOpenURL.mockReset();
  mockPush.mockReset();
  mockReducedMotion = false;
  mockParams.id = '1';
  mockUseFixtures.mockReturnValue({ data: null });
  mockUseMeta.mockReturnValue({
    data: {
      team: {
        id: 560,
        name: 'RC Deportivo La Coruña',
        shortName: 'Deportivo',
        tla: 'DEP',
        crestUrl: 'https://crest.example.org/depor.png',
      },
    },
  });
});

describe('ficha de jugador', () => {
  it('muestra hero, identidad, resumen y estadísticas de la temporada', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    mockUseFixtures.mockReturnValue({ data: fixtures });
    await render(<PlayerDetail />);

    expect(screen.getByText('Jugador Completo')).toBeTruthy();
    expect(screen.getByText(`🇪🇸 España · Portero · ${expectedAge} años`)).toBeTruthy();
    expect(screen.getByText('Arnedo (La Rioja), España')).toBeTruthy();
    expect(screen.getByText('Izquierdo')).toBeTruthy();
    expect(screen.getByText(/5\.000\.000/)).toBeTruthy();
    expect(screen.getByText(/Estimación/)).toBeTruthy();

    // La franja arranca en el ámbito «Depor»: solo el partido de esta temporada.
    expect(screen.getByText('90')).toBeTruthy();
    expect(screen.getAllByText('PJ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('min').length).toBeGreaterThan(0);
    expect(screen.getByText('Resumen')).toBeTruthy();
    expect(screen.getByText('Partidos')).toBeTruthy();
    expect(screen.getAllByText('Carrera').length).toBe(2);
    expect(screen.queryByText(/Fuente:/)).toBeNull();
  });

  it('cambia al ámbito Carrera y muestra los totales y la trayectoria', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getAllByText('Carrera')[0]!);
    expect(screen.getByText('191')).toBeTruthy();
    expect(screen.getByText('16.992')).toBeTruthy();

    await fireEvent.press(screen.getAllByText('Carrera')[1]!);
    expect(screen.getByText('Club Antiguo')).toBeTruthy();
    expect(screen.getByText('2014–')).toBeTruthy();
    expect(screen.getByText('2020–2022')).toBeTruthy();
    expect(screen.queryByText('Asistencias')).toBeNull();
  });

  it('enlaza el partido con su fixture cuando coincide de forma inequívoca', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    mockUseFixtures.mockReturnValue({ data: fixtures });
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getByText('Partidos'));
    expect(screen.getByText('Valladolid')).toBeTruthy();
    expect(screen.getByText(/Visitante/)).toBeTruthy();
    expect(screen.getByText('2–0')).toBeTruthy();
    expect(screen.getAllByText('G').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByLabelText('Valladolid. Visitante. 2–0. Victoria'));
    expect(mockPush).toHaveBeenCalledWith('/match/42');
  });

  it('separa los partidos de la temporada publicada de los históricos', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    mockUseFixtures.mockReturnValue({ data: fixtures });
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getByText('Partidos'));
    expect(screen.getByText('Valladolid')).toBeTruthy();
    expect(screen.queryByText('Rival Antiguo')).toBeNull();

    await fireEvent.press(screen.getAllByText('Carrera')[0]!);
    expect(screen.getByText('Rival Antiguo')).toBeTruthy();
  });

  it('abre las redes oficiales con Ionicons y Linking', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getByLabelText('X @deporhub'));
    expect(mockOpenURL).toHaveBeenCalledWith('https://x.com/deporhub');
  });

  it('abre la foto en un modal con atribución y la cierra', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    expect(screen.queryByText('© Autora de Ejemplo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ampliar foto'));

    expect(screen.getByText('© Autora de Ejemplo')).toBeTruthy();
    expect(screen.getByText('Autoría: Autora de Ejemplo')).toBeTruthy();
    expect(screen.getByText('Licencia: CC BY-SA 4.0')).toBeTruthy();
    expect(screen.getByText(/no se redistribuyen/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver ficha de la foto'));
    expect(mockOpenURL).toHaveBeenCalledWith('https://commons.wikimedia.org/wiki/File:Jugador.jpg');

    await fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(screen.queryByText('© Autora de Ejemplo')).toBeNull();
  });

  it('respeta reducir movimiento al abrir la foto', async () => {
    mockReducedMotion = true;
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getByLabelText('Ampliar foto'));
    expect(screen.getByTestId('photo-modal').props.animationType).toBe('none');
  });

  it('muestra la cesión de salida cuando existe', async () => {
    mockUseSquad.mockReturnValue(
      squad([{ ...basePlayer, loanTo: 'Al Ain (Emiratos Árabes Unidos)' }]),
    );
    await render(<PlayerDetail />);

    expect(screen.getByText('Cedido a Al Ain (Emiratos Árabes Unidos)')).toBeTruthy();
  });

  it('con todos los datos a null solo enseña lo que existe y los pendientes', async () => {
    const empty: PlayerT = {
      ...basePlayer,
      id: 2,
      name: 'Sin Datos',
      position: null,
      dateOfBirth: null,
      nationality: null,
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
    };
    mockParams.id = '2';
    mockUseSquad.mockReturnValue(squad([empty]));
    await render(<PlayerDetail />);

    expect(screen.getByText('Sin Datos')).toBeTruthy();
    expect(screen.getByText(/Datos pendientes/)).toBeTruthy();
    expect(screen.getByText(/no se inventan/)).toBeTruthy();
    expect(screen.getByText('Fecha de nacimiento')).toBeTruthy();
    expect(screen.getByText('Sin partidos con el Depor en esta temporada.')).toBeTruthy();
    expect(screen.queryByText('Trayectoria')).toBeNull();
    expect(screen.queryByText('Partidos con el Depor')).toBeNull();
    expect(screen.queryByText('Redes oficiales')).toBeNull();
    expect(screen.queryByLabelText('Ampliar foto')).toBeNull();
  });

  it('jugador inexistente', async () => {
    mockParams.id = '999';
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    expect(screen.getByText('No se ha encontrado al jugador.')).toBeTruthy();
  });
});
