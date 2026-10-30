import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Home from '../../app/(tabs)/index';
import i18n from '@/i18n';
import { Fixtures, Meta, Rivals, Season, Standings } from '@/data/schemas';

const dir = path.resolve(__dirname, '../../../../data/public/v1');
const load = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

const metaData = Meta.parse(load('meta.json'));
const standingsData = Standings.parse(load('standings.json'));
const fixturesData = Fixtures.parse(load('fixtures.json'));
const seasonData = Season.parse(load('season.json'));
const rivalsData = Rivals.parse(load('rivals.json'));

let mockMeta: unknown;
let mockStandings: unknown;
let mockFixtures: unknown;
let mockNews: unknown;
let mockSeason: unknown;
let mockRivals: unknown;
let mockWeather: unknown;
let mockNow: number;

jest.mock('@/data/queries', () => ({
  useMeta: () => mockMeta,
  useStandings: () => mockStandings,
  useFixtures: () => mockFixtures,
  useNews: () => mockNews,
  useSeason: () => mockSeason,
  useRivals: () => mockRivals,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors, paper: lightColors.paper, poster: lightColors.poster }) };
});

jest.mock('@/features/reminders/notifications', () => ({
  ensureReminderPermission: jest.fn(async () => true),
}));

jest.mock('@/features/calendar/system', () => ({
  addMatchToCalendar: jest.fn(async () => undefined),
}));

jest.mock('@/features/home/maps', () => ({
  openVenueInMaps: jest.fn(async () => undefined),
}));

jest.mock('@/features/home/useNow', () => ({
  useNow: () => mockNow,
}));

jest.mock('@/features/home/useWeather', () => ({
  useWeather: () => mockWeather,
}));

jest.mock('@/features/home/useCountdown', () => ({
  useCountdown: () => ({
    days: 6,
    hours: 1,
    minutes: 0,
    seconds: 0,
    totalMs: 6 * 86_400_000,
    expired: false,
    nowMs: Date.parse('2026-10-25T10:00:00Z'),
  }),
}));

const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  dataUpdatedAt: data ? Date.parse('2026-10-25T22:23:41Z') : 0,
  isPending: false,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockNow = Date.parse('2026-10-25T10:00:00Z');
  mockMeta = query(metaData);
  mockStandings = query(standingsData);
  mockFixtures = query(fixturesData);
  mockNews = query(null);
  mockSeason = query(seasonData);
  mockRivals = query(rivalsData);
  mockWeather = query(null);
});

describe('Home', () => {
  it('pinta las secciones en el orden acordado con los datos reales', async () => {
    await render(<Home />);

    expect(screen.getByText('Resultado final')).toBeTruthy();
    expect(screen.getAllByText('1–0').length).toBeGreaterThan(0);

    expect(screen.getByText('Próximo partido')).toBeTruthy();
    expect(screen.getByText(/Jornada 11 · Primera División/)).toBeTruthy();
    expect(screen.getAllByText('Osasuna').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Local').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visitante').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Lunes 2 nov\. 21:00/)).toBeTruthy();
    expect(screen.getByText('Estadio Abanca-Riazor')).toBeTruthy();

    expect(screen.getByText('El rival')).toBeTruthy();
    expect(screen.getByText('Luis Ramis')).toBeTruthy();
    expect(screen.getByText('Histórico')).toBeTruthy();
    expect(screen.getByLabelText(/80 partidos, 38 victorias, 14 empates, 28 derrotas/)).toBeTruthy();
    expect(screen.queryByText('Qué se juega')).toBeNull();

    expect(screen.getByText('La temporada')).toBeTruthy();
    expect(screen.getByText('2-5-3')).toBeTruthy();
    expect(screen.getByText('13-13')).toBeTruthy();
    expect(screen.getByText('G victoria · E empate · P derrota')).toBeTruthy();
    expect(screen.getByText('Evolución de la posición')).toBeTruthy();

    expect(screen.getByText('Clasificación')).toBeTruthy();
    expect(screen.getByText('Ver tabla completa')).toBeTruthy();
    expect(screen.getByText('2026-27 · Jornada 10')).toBeTruthy();
    expect(screen.queryByText('Titulares')).toBeNull();
  });

  it('seleccionar un cromo sincroniza el partido con el gráfico y el marcador', async () => {
    await render(<Home />);
    await fireEvent.press(screen.getByLabelText(/empate contra Levante/i));
    expect(screen.getByText('1–1')).toBeTruthy();
    expect(screen.getByText(/Jornada 9.*Levante.*Empate.*puesto 9/)).toBeTruthy();
  });

  it('oculta el resultado final pasadas 24 horas', async () => {
    mockNow = Date.parse('2026-10-27T10:00:00Z');

    await render(<Home />);

    expect(screen.queryByText('Resultado final')).toBeNull();
    expect(screen.getByText('Próximo partido')).toBeTruthy();
  });

  it('sigue funcionando sin season.json ni rivals.json (404 o caché anterior)', async () => {
    mockSeason = query(null);
    mockRivals = query(null);

    await render(<Home />);

    expect(screen.getByText('Próximo partido')).toBeTruthy();
    expect(screen.getByText('La temporada')).toBeTruthy();
    expect(screen.queryByText('Qué se juega')).toBeNull();
    expect(screen.queryByText('Histórico')).toBeNull();
    expect(screen.getByText('El rival')).toBeTruthy();
    expect(screen.getByText('Clasificación')).toBeTruthy();
  });

  it('ignora season.json y rivals.json de otra temporada', async () => {
    mockSeason = query({ ...seasonData, season: '2025-26' });
    mockRivals = query({ ...rivalsData, season: '2025-26' });

    await render(<Home />);

    expect(screen.queryByText('Qué se juega')).toBeNull();
    expect(screen.queryByText('Histórico')).toBeNull();
    expect(screen.getByText('La temporada')).toBeTruthy();
    expect(screen.getByText('2026-27 · Jornada 10')).toBeTruthy();
  });

  it('muestra el tiempo del estadio cuando la consulta devuelve datos', async () => {
    mockWeather = query({
      temperatureC: 16,
      precipitationProbability: 20,
      windKmh: 12,
      code: 3,
      hour: '2026-11-02T21:00',
    });

    await render(<Home />);

    expect(screen.getByLabelText(/Nubes\. 16 grados\. 20 % lluvia\. 12 km\/h/)).toBeTruthy();
    expect(screen.getByText('Datos: Open-Meteo')).toBeTruthy();
  });

  it('muestra estados vacíos sin inventar datos', async () => {
    mockMeta = query(undefined);
    mockStandings = query(undefined);
    mockFixtures = query(undefined);
    mockSeason = query(undefined);
    mockRivals = query(undefined);

    await render(<Home />);

    expect(screen.getByText('No hay próximos partidos.')).toBeTruthy();
    expect(screen.queryByText('Resultado final')).toBeNull();
    expect(screen.queryByText('La temporada')).toBeNull();
    expect(screen.queryByText('Ver tabla completa')).toBeNull();
    expect(screen.queryByText(/Temporada/)).toBeNull();
  });

  it('muestra el error global y reintenta las tres consultas', async () => {
    mockMeta = query(undefined, { isError: true });
    mockStandings = query(undefined, { isError: true });
    mockFixtures = query(undefined, { isError: true });

    await render(<Home />);

    expect(screen.getByText('No se han podido cargar los datos.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));

    expect((mockMeta as { refetch: jest.Mock }).refetch).toHaveBeenCalled();
    expect((mockStandings as { refetch: jest.Mock }).refetch).toHaveBeenCalled();
    expect((mockFixtures as { refetch: jest.Mock }).refetch).toHaveBeenCalled();
  });

  it('pinta los titulares solo cuando hay noticias', async () => {
    mockNews = query({
      updatedAt: '2026-10-27T08:00:00Z',
      sources: [
        {
          id: 'medio',
          name: 'Medio',
          group: 'galicia',
          kind: 'article',
          homepage: 'https://example.test',
        },
      ],
      stories: [
        {
          id: 'n1',
          title: 'Parte médico antes del partido',
          url: 'https://example.test/n1',
          sourceId: 'medio',
          publishedAt: '2026-10-27T08:00:00Z',
          kind: 'article',
          thumbnailUrl: null,
          summary: null,
          tags: [],
          alsoIn: [],
        },
      ],
    });

    await render(<Home />);

    expect(screen.getByText('Titulares')).toBeTruthy();
    expect(screen.getByText('Parte médico antes del partido')).toBeTruthy();
  });
});
