import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Home from '../../app/(tabs)/index';
import i18n from '@/i18n';
import { Fixtures, Meta, Standings } from '@/data/schemas';

const dir = path.resolve(__dirname, '../../../../data/public/v1');
const load = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

const metaData = Meta.parse(load('meta.json'));
const standingsData = Standings.parse(load('standings.json'));
const fixturesData = Fixtures.parse(load('fixtures.json'));

let mockMeta: unknown;
let mockStandings: unknown;
let mockFixtures: unknown;
let mockNews: unknown;

jest.mock('@/data/queries', () => ({
  useMeta: () => mockMeta,
  useStandings: () => mockStandings,
  useFixtures: () => mockFixtures,
  useNews: () => mockNews,
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
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

jest.mock('@/features/home/useCountdown', () => ({
  useCountdown: () => ({
    days: 6,
    hours: 1,
    minutes: 0,
    seconds: 0,
    totalMs: 6 * 86_400_000,
    expired: false,
    nowMs: Date.parse('2026-10-27T10:00:00Z'),
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
  mockMeta = query(metaData);
  mockStandings = query(standingsData);
  mockFixtures = query(fixturesData);
  mockNews = query(null);
});

describe('Home', () => {
  it('pinta las secciones en orden con los datos reales', async () => {
    await render(<Home />);

    expect(screen.getByText('Próximo partido')).toBeTruthy();
    expect(screen.getByText('Jornada 11')).toBeTruthy();
    expect(screen.getAllByText('Osasuna').length).toBeGreaterThan(0);
    expect(screen.getByText('Estadio Abanca-Riazor')).toBeTruthy();

    expect(screen.getByText('Último resultado')).toBeTruthy();
    expect(screen.getByText('1–0')).toBeTruthy();

    expect(screen.getByText('La temporada')).toBeTruthy();
    expect(screen.getByText('11º')).toBeTruthy();
    expect(screen.getByText('2-5-3')).toBeTruthy();
    expect(screen.getByText('13-13')).toBeTruthy();

    expect(screen.getByText('Clasificación')).toBeTruthy();
    expect(screen.getByText('Ver tabla completa')).toBeTruthy();
    expect(screen.getByText('El rival')).toBeTruthy();
    expect(screen.getByText('Temporada 2026-27 · jornada 10')).toBeTruthy();
    expect(screen.queryByText('Titulares')).toBeNull();
  });

  it('muestra estados vacíos sin inventar datos', async () => {
    mockMeta = query(undefined);
    mockStandings = query(undefined);
    mockFixtures = query(undefined);

    await render(<Home />);

    expect(screen.getByText('No hay próximos partidos.')).toBeTruthy();
    expect(screen.getByText('Todavía no hay resultados.')).toBeTruthy();
    expect(screen.getByText('Clasificación no disponible.')).toBeTruthy();
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
      items: [
        {
          id: 'n1',
          title: 'Parte médico antes del partido',
          url: 'https://example.test/n1',
          sourceName: 'Medio',
          publishedAt: '2026-10-27T08:00:00Z',
          thumbnailUrl: null,
          tags: [],
        },
      ],
    });

    await render(<Home />);

    expect(screen.getByText('Titulares')).toBeTruthy();
    expect(screen.getByText('Parte médico antes del partido')).toBeTruthy();
  });
});
