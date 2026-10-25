import { fireEvent, render, screen } from '@testing-library/react-native';
import TeamScreen from '../../app/(tabs)/team';
import i18n from '@/i18n';
import type { PlayerT } from '@/data/schemas';

const mockUseSquad = jest.fn();
const mockPush = jest.fn();

jest.mock('@/data/queries', () => ({ useSquad: () => mockUseSquad() }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const basePlayer: PlayerT = {
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
};

const squad = (players: PlayerT[], isPending = false) => ({
  data: { updatedAt: '2026-10-25T10:00:00Z', coach: null, players },
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
  mockPush.mockReset();
});

describe('pantalla de plantilla', () => {
  it('agrupa por posición, ordena por dorsal y navega a la ficha', async () => {
    mockUseSquad.mockReturnValue(
      squad([
        basePlayer,
        { ...basePlayer, id: 2, name: 'Portero Dos', position: 'Goalkeeper', shirtNumber: 1 },
        { ...basePlayer, id: 3, name: 'Delantero Tres', position: 'Offence', shirtNumber: 9 },
      ]),
    );
    await render(<TeamScreen />);

    expect(screen.getByText('Porteros · 1')).toBeTruthy();
    expect(screen.getByText('Centrocampistas · 1')).toBeTruthy();
    expect(screen.getByText('Delanteros · 1')).toBeTruthy();

    await fireEvent.press(screen.getByText('Delantero Tres'));
    expect(mockPush).toHaveBeenCalledWith('/player/3');
  });

  it('plantilla vacía muestra el estado vacío', async () => {
    mockUseSquad.mockReturnValue(squad([]));
    await render(<TeamScreen />);

    expect(screen.getByText('La plantilla no está disponible.')).toBeTruthy();
  });

  it('mientras carga enseña el esqueleto', async () => {
    mockUseSquad.mockReturnValue({ isPending: true, isFetching: true, isError: false, isRefetching: false, refetch: jest.fn() });
    await render(<TeamScreen />);

    expect(screen.getByLabelText('Cargando datos…')).toBeTruthy();
  });
});
