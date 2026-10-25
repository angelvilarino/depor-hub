import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import type { PlayerT } from '@/data/schemas';
import PlayerDetail from '../../app/player/[id]';

const mockUseSquad = jest.fn();
const mockOpenURL = jest.fn();
const mockParams: { id: string } = { id: '1' };

jest.mock('@/data/queries', () => ({ useSquad: () => mockUseSquad() }));
jest.mock('expo-linking', () => ({ openURL: (...args: unknown[]) => mockOpenURL(...args) }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

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

const squad = (players: PlayerT[], isPending = false) => ({
  data: { updatedAt: '2026-10-25T10:00:00Z', coach: null, players },
  isPending,
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockUseSquad.mockReset();
  mockOpenURL.mockReset();
  mockParams.id = '1';
});

describe('ficha de jugador', () => {
  it('muestra los datos completos, la carrera en orden y los partidos', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    expect(screen.getByText('Jugador Completo')).toBeTruthy();
    expect(screen.getByText('Arnedo (La Rioja), España')).toBeTruthy();
    expect(screen.getByText('Izquierdo')).toBeTruthy();
    expect(screen.getByText(/5\.000\.000/)).toBeTruthy();
    expect(screen.getByText(/Estimación/)).toBeTruthy();
    expect(screen.getByText('2014–')).toBeTruthy();
    expect(screen.getByText('2020–2022')).toBeTruthy();
    expect(screen.getByText(/Valladolid/)).toBeTruthy();
    expect(screen.getByText(/2–0/)).toBeTruthy();
    expect(screen.getAllByText(/Fuente: BDFutbol/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Datos pendientes')).toBeNull();
  });

  it('abre las redes oficiales con Linking', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    await fireEvent.press(screen.getByText('X'));
    expect(mockOpenURL).toHaveBeenCalledWith('https://x.com/deporhub');
  });

  it('muestra la cesión de salida cuando existe', async () => {
    mockUseSquad.mockReturnValue(
      squad([{ ...basePlayer, loanTo: 'Al Ain (Emiratos Árabes Unidos)' }]),
    );
    await render(<PlayerDetail />);

    expect(screen.getByText('Cedido a')).toBeTruthy();
    expect(screen.getByText('Al Ain (Emiratos Árabes Unidos)')).toBeTruthy();
  });

  it('muestra las fotos con atribución y enlaza a su ficha original', async () => {
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    expect(screen.getByText('Fotos')).toBeTruthy();
    expect(screen.getByText('© Autora de Ejemplo')).toBeTruthy();
    expect(screen.getByText('Autoría: Autora de Ejemplo')).toBeTruthy();
    expect(screen.getByText('Licencia: CC BY-SA 4.0')).toBeTruthy();
    expect(screen.getByText(/no se redistribuyen/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Ver ficha de la foto'));
    expect(mockOpenURL).toHaveBeenCalledWith('https://commons.wikimedia.org/wiki/File:Jugador.jpg');
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
    expect(screen.getByText('Datos pendientes')).toBeTruthy();
    expect(screen.queryByText('Trayectoria')).toBeNull();
    expect(screen.queryByText('Partidos con el Depor')).toBeNull();
    expect(screen.queryByText('Redes oficiales')).toBeNull();
    expect(screen.queryByText('Fotos')).toBeNull();
  });

  it('jugador inexistente', async () => {
    mockParams.id = '999';
    mockUseSquad.mockReturnValue(squad([basePlayer]));
    await render(<PlayerDetail />);

    expect(screen.getByText('No se ha encontrado al jugador.')).toBeTruthy();
  });
});
