import { fireEvent, render, screen } from '@testing-library/react-native';
import CoachScreen from '../../app/coach';
import i18n from '@/i18n';
import type { CareerEntryT, CoachT, FixturesT } from '@/data/schemas';

const mockUseSquad = jest.fn();
const mockUseFixtures = jest.fn();

jest.mock('@/data/queries', () => ({
  useSquad: () => mockUseSquad(),
  useFixtures: () => mockUseFixtures(),
}));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const careerEntry = (over: Partial<CareerEntryT>): CareerEntryT => ({
  club: 'Club',
  crestUrl: null,
  role: 'player',
  from: '2000',
  to: '2001',
  appearances: null,
  goals: null,
  assists: null,
  minutes: null,
  yellowCards: null,
  redCards: null,
  seasons: [],
  ...over,
});

const coach: CoachT = {
  name: 'Antonio Hidalgo',
  nationality: 'España',
  birthDate: '1979-02-06',
  birthPlace: 'Granollers',
  photoUrl: null,
  since: '2025',
  contractUntil: null,
  career: [
    careerEntry({
      club: 'EC Granollers',
      role: 'coach',
      from: '2016',
      to: '2016',
    }),
    careerEntry({
      club: 'CD Tenerife',
      role: 'player',
      from: '2000',
      to: '2005',
      appearances: 122,
      goals: 15,
    }),
  ],
  staff: [
    { name: 'Antonio Hidalgo', role: 'head_coach', photoUrl: null },
    { name: 'Ignasi Salafranca', role: 'assistant_coach', photoUrl: null },
    { name: 'Alberto Casal', role: 'goalkeeping_coach', photoUrl: null },
  ],
  provenance: {},
};

const fixtures: FixturesT = {
  updatedAt: '2026-10-20T10:00:00Z',
  season: '2026-27',
  matches: [
    {
      id: 1,
      utcDate: '2026-08-20T18:00:00Z',
      status: 'FINISHED',
      matchday: 1,
      stage: null,
      home: { id: 1, name: 'Depor', shortName: 'Depor', tla: 'DEP', crestUrl: null },
      away: { id: 2, name: 'Rival', shortName: 'Rival', tla: 'RIV', crestUrl: null },
      score: { home: 2, away: 1, halfTimeHome: 1, halfTimeAway: 0, winner: 'HOME_TEAM' },
      deporIsHome: true,
      venue: null,
      referee: null,
    },
    {
      id: 2,
      utcDate: '2026-09-01T18:00:00Z',
      status: 'FINISHED',
      matchday: 2,
      stage: null,
      home: { id: 2, name: 'Rival', shortName: 'Rival', tla: 'RIV', crestUrl: null },
      away: { id: 1, name: 'Depor', shortName: 'Depor', tla: 'DEP', crestUrl: null },
      score: { home: 0, away: 0, halfTimeHome: 0, halfTimeAway: 0, winner: 'DRAW' },
      deporIsHome: false,
      venue: null,
      referee: null,
    },
    {
      id: 3,
      utcDate: '2026-12-01T18:00:00Z',
      status: 'SCHEDULED',
      matchday: 3,
      stage: null,
      home: { id: 1, name: 'Depor', shortName: 'Depor', tla: 'DEP', crestUrl: null },
      away: { id: 2, name: 'Rival', shortName: 'Rival', tla: 'RIV', crestUrl: null },
      score: { home: null, away: null, halfTimeHome: null, halfTimeAway: null, winner: null },
      deporIsHome: true,
      venue: null,
      referee: null,
    },
  ],
};

const squad = (value: CoachT | null, isPending = false) => ({
  data: value ? { updatedAt: '2026-10-25T10:00:00Z', coach: value, players: [] } : undefined,
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
  mockUseFixtures.mockReturnValue({ data: fixtures });
});

describe('ficha del entrenador', () => {
  it('muestra datos personales, balance y cuerpo técnico oficial', async () => {
    mockUseSquad.mockReturnValue(squad(coach));
    await render(<CoachScreen />);

    expect(screen.getByText('Antonio Hidalgo')).toBeTruthy();
    expect(screen.getAllByText('Entrenador').length).toBeGreaterThan(0);
    expect(screen.getByText('6 de febrero de 1979')).toBeTruthy();
    expect(screen.getByText('Granollers')).toBeTruthy();
    expect(screen.getByText('En el Depor desde 2025')).toBeTruthy();

    expect(screen.getByText('Balance con el Depor')).toBeTruthy();
    expect(screen.getByText('PJ')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy(); // 1 victoria + 1 empate

    expect(screen.getByText('SEGUNDO ENTRENADOR')).toBeTruthy();
    expect(screen.getByText('Ignasi Salafranca')).toBeTruthy();
    expect(screen.getByText('ENTRENADOR DE PORTEROS')).toBeTruthy();
    expect(screen.getAllByText('Antonio Hidalgo')).toHaveLength(1);
  });

  it('cambia entre la trayectoria como entrenador y como jugador', async () => {
    mockUseSquad.mockReturnValue(squad(coach));
    await render(<CoachScreen />);

    expect(screen.getByText('EC Granollers')).toBeTruthy();
    expect(screen.queryByText('CD Tenerife')).toBeNull();

    await fireEvent.press(screen.getByText('Jugador'));
    expect(screen.getByText('CD Tenerife')).toBeTruthy();
    expect(screen.queryByText('EC Granollers')).toBeNull();
  });

  it('sin entrenador muestra el estado vacío', async () => {
    mockUseSquad.mockReturnValue(squad(null));
    await render(<CoachScreen />);

    expect(screen.getByText('No se ha encontrado la ficha del entrenador.')).toBeTruthy();
  });
});
