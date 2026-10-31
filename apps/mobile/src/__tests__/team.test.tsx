import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamScreen from '../../app/(tabs)/team';
import i18n from '@/i18n';
import type { PlayerT } from '@/data/schemas';
import { useSettings } from '@/store/settings';

const mockUseSquad = jest.fn();
const mockPush = jest.fn();

jest.mock('@/data/queries', () => ({ useSquad: () => mockUseSquad() }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const birthYear = new Date().getUTCFullYear() - 25;

const basePlayer: PlayerT = {
  id: 1,
  name: 'Jugador Uno',
  position: 'Midfield',
  dateOfBirth: `${birthYear}-01-31`,
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

const threePlayers = [
  basePlayer,
  { ...basePlayer, id: 2, name: 'Portero Dos', position: 'Goalkeeper', shirtNumber: 1 },
  { ...basePlayer, id: 3, name: 'Delantero Tres', position: 'Offence', shirtNumber: 9 },
];

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockUseSquad.mockReset();
  mockPush.mockReset();
  useSettings.setState({ squadView: 'grid' });
});

describe('pantalla de plantilla', () => {
  it('muestra la cuadrícula por defecto con resumen y contadores reales', async () => {
    mockUseSquad.mockReturnValue(squad(threePlayers));
    await render(<TeamScreen />);

    expect(screen.getByText('Jugador Uno')).toBeTruthy();
    expect(screen.getByText('Portero Dos')).toBeTruthy();
    expect(screen.getByText('Delantero Tres')).toBeTruthy();
    expect(screen.getByText('3 jugadores')).toBeTruthy();
    expect(screen.queryByText(/edad media/)).toBeNull();
    expect(screen.getByText('Todos 3')).toBeTruthy();
    expect(screen.getByText('POR 1')).toBeTruthy();
    expect(screen.getByText('MED 1')).toBeTruthy();
    expect(screen.getByText('DEL 1')).toBeTruthy();
  });

  it('navega a la ficha al pulsar un jugador', async () => {
    mockUseSquad.mockReturnValue(squad(threePlayers));
    await render(<TeamScreen />);

    await fireEvent.press(screen.getByText('Delantero Tres'));
    expect(mockPush).toHaveBeenCalledWith('/player/3');
  });

  it('busca sin mayúsculas ni tildes y también por dorsal', async () => {
    mockUseSquad.mockReturnValue(
      squad([...threePlayers, { ...basePlayer, id: 4, name: 'Álvaro López' }]),
    );
    await render(<TeamScreen />);
    const search = screen.getByPlaceholderText('Buscar por nombre o dorsal');

    await fireEvent.changeText(search, 'ALVARO');
    expect(screen.getByText('Álvaro López')).toBeTruthy();
    expect(screen.queryByText('Portero Dos')).toBeNull();
    expect(screen.getByText('Todos 1')).toBeTruthy();

    await fireEvent.changeText(search, '9');
    expect(screen.getByText('Delantero Tres')).toBeTruthy();
    expect(screen.queryByText('Álvaro López')).toBeNull();
  });

  it('filtra por posición y permite limpiar los filtros', async () => {
    mockUseSquad.mockReturnValue(squad(threePlayers));
    await render(<TeamScreen />);

    await fireEvent.press(screen.getByText('POR 1'));
    expect(screen.getByText('Portero Dos')).toBeTruthy();
    expect(screen.queryByText('Jugador Uno')).toBeNull();
    expect(screen.getByText('1 jugador')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByPlaceholderText('Buscar por nombre o dorsal'),
      'no-existe',
    );
    expect(screen.getByText('Ningún jugador coincide con los filtros.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Limpiar filtros'));
    expect(screen.getByText('Jugador Uno')).toBeTruthy();
    expect(screen.getByText('Portero Dos')).toBeTruthy();
  });

  it('cambia a la vista de lista y muestra sus cabeceras sin truncar', async () => {
    mockUseSquad.mockReturnValue(squad(threePlayers));
    await render(<TeamScreen />);

    await fireEvent.press(screen.getByLabelText('Lista'));
    expect(screen.getByText('#')).toBeTruthy();
    expect(screen.getByText('Jugador')).toBeTruthy();
    expect(screen.getByText('Edad')).toBeTruthy();
    expect(screen.queryByText('Dorsal')).toBeNull();
    expect(screen.queryByText('Pos.')).toBeNull();
    expect(screen.getByText('Delantero Tres')).toBeTruthy();
  });

  it('abre la ficha del entrenador desde la tarjeta', async () => {
    mockUseSquad.mockReturnValue({
      ...squad(threePlayers),
      data: {
        ...squad(threePlayers).data,
        coach: {
          name: 'Antonio Hidalgo',
          nationality: 'España',
          birthDate: '1979-02-06',
          birthPlace: 'Granollers',
          photoUrl: 'https://cdn.example.org/entrenador.jpg',
          since: '2025',
          contractUntil: null,
          career: [],
          staff: [],
          provenance: {},
        },
      },
    });
    await render(<TeamScreen />);

    expect(screen.getByText('ENTRENADOR')).toBeTruthy();
    await fireEvent.press(screen.getByText('Antonio Hidalgo'));
    expect(mockPush).toHaveBeenCalledWith('/coach');
  });

  it('marca como cedido al jugador con loanTo', async () => {
    mockUseSquad.mockReturnValue(squad([{ ...basePlayer, loanTo: 'Al Ain' }]));
    await render(<TeamScreen />);

    expect(screen.getByText('Cedido')).toBeTruthy();
  });

  it('plantilla vacía muestra el estado vacío', async () => {
    mockUseSquad.mockReturnValue(squad([]));
    await render(<TeamScreen />);

    expect(screen.getByText('La plantilla no está disponible.')).toBeTruthy();
  });

  it('mientras carga enseña el esqueleto', async () => {
    mockUseSquad.mockReturnValue({
      isPending: true,
      isFetching: true,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    });
    await render(<TeamScreen />);

    expect(screen.getByLabelText('Cargando datos…')).toBeTruthy();
  });
});
