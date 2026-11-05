import { render, screen } from '@testing-library/react-native';
import MatchDetail from '../../app/match/[id]';
import i18n from '@/i18n';
import { makeMatch } from '@/test-utils/matches';

let mockMatch = makeMatch();
let mockFixtures: { season: string; matches: (typeof mockMatch)[] } | null = null;
let mockSnapshot: Record<string, unknown> | null = null;
const mockNow = Date.parse('2026-11-04T10:00:00Z');

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: String(mockMatch.id) }),
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
}));

jest.mock('@/data/queries', () => ({
  useFixtures: () => ({
    data: mockFixtures ?? { season: '2026-27', matches: [mockMatch] },
    dataUpdatedAt: 0,
    isPending: false,
    isFetching: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
  useMeta: () => ({ data: { season: '2026-27' } }),
  useMatchSnapshot: () => ({
    data: mockSnapshot,
    isPending: false,
    isFetching: false,
    isError: false,
  }),
}));

jest.mock('@/features/home/useNow', () => ({
  useNow: () => mockNow,
}));

jest.mock('@/features/home/useMatchActions', () => ({
  useMatchActions: () => ({
    venue: 'RCDE Stadium',
    time: '16:15',
    title: 'Deportivo – Atleti',
    remindable: true,
    reminded: false,
    reminderOffsets: [],
    reminderSummary: '',
    remindersEnabled: true,
    setRemindersEnabled: jest.fn(),
    saveReminder: jest.fn(),
    removeReminder: jest.fn(),
    addToCalendar: jest.fn(),
    openSystemSettings: jest.fn(),
  }),
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors, paper: lightColors.paper }) };
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockFixtures = null;
  mockSnapshot = null;
});

describe('Ficha de partido', () => {
  it('en un partido terminado muestra el resultado y degrada sin inventar detalle', async () => {
    mockMatch = makeMatch({
      id: 1,
      status: 'FINISHED',
      utcDate: '2026-11-02T20:00:00Z',
      score: { home: 2, away: 1, halfTimeHome: 0, halfTimeAway: 1, winner: 'HOME_TEAM' },
    });

    await render(<MatchDetail />);

    expect(screen.getByText('Resultado final')).toBeTruthy();
    expect(screen.getByText('2 – 1')).toBeTruthy();
    expect(screen.getByText('Alineaciones, eventos y estadísticas no disponibles')).toBeTruthy();
    expect(screen.getByText(/No se deducen eventos ni estadísticas/)).toBeTruthy();
    expect(screen.getByText('Marcador y estado: football-data.org')).toBeTruthy();
    expect(screen.queryByText('Recordarme')).toBeNull();
  });

  it('en directo muestra el marcador y avisa de que no hay eventos', async () => {
    mockMatch = makeMatch({
      id: 2,
      status: 'IN_PLAY',
      utcDate: '2026-11-04T09:00:00Z',
      score: { home: 1, away: 0, halfTimeHome: null, halfTimeAway: null, winner: null },
    });

    await render(<MatchDetail />);

    expect(screen.getByText('EN JUEGO')).toBeTruthy();
    expect(screen.getByText('1 – 0')).toBeTruthy();
    expect(screen.getByText(/En directo solo se actualizan el marcador y el estado/)).toBeTruthy();
    expect(screen.queryByText('Recordarme')).toBeNull();
  });

  it('en un partido futuro ofrece recordatorio y calendario', async () => {
    mockMatch = makeMatch({
      id: 3,
      status: 'TIMED',
      utcDate: '2026-11-20T20:00:00Z',
    });

    await render(<MatchDetail />);

    expect(screen.getByText('Recordarme')).toBeTruthy();
    expect(screen.getByText('Añadir al calendario')).toBeTruthy();
    expect(screen.queryByText('Resultado final')).toBeNull();
  });

  it('si el partido ya no está en fixtures, usa el snapshot congelado', async () => {
    mockMatch = makeMatch({ id: 564635 });
    mockFixtures = { season: '2026-27', matches: [] };
    mockSnapshot = {
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

    await render(<MatchDetail />);

    expect(screen.getByText('Resultado final')).toBeTruthy();
    expect(screen.getByText('1 – 1')).toBeTruthy();
    expect(screen.getByText('Francisco Hernández Maeso')).toBeTruthy();
    expect(screen.getByText('Alineaciones, eventos y estadísticas no disponibles')).toBeTruthy();
  });

  it('un TIMED ya pasado no se presenta como futuro ni como resultado', async () => {
    mockMatch = makeMatch({
      id: 4,
      status: 'TIMED',
      utcDate: '2026-11-03T20:00:00Z',
    });

    await render(<MatchDetail />);

    expect(screen.getByText('Pendiente de actualizar')).toBeTruthy();
    expect(screen.queryByText('Recordarme')).toBeNull();
    expect(screen.queryByText('Resultado final')).toBeNull();
  });
});
