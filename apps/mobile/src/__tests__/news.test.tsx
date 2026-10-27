import { fireEvent, render, screen } from '@testing-library/react-native';
import NewsScreen from '../../app/(tabs)/news';
import i18n from '@/i18n';
import type { NewsItemT, SocialFeedT } from '@/data/schemas';
import { useNewsRead } from '@/store/news';

let mockNews: unknown;
let mockSocial: unknown;
let mockSources: unknown;
let mockOnline = true;

jest.mock('@/data/queries', () => ({
  useNews: () => mockNews,
  useSocial: () => mockSocial,
  useSources: () => mockSources,
}));

jest.mock('@/data/useOnline', () => ({ useOnline: () => mockOnline }));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  dataUpdatedAt: data ? Date.parse('2026-10-27T10:00:00Z') : 0,
  isPending: false,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

function item(index: number, overrides: Partial<NewsItemT> = {}): NewsItemT {
  const n = String(index).padStart(2, '0');
  return {
    id: `n${n}`,
    title: `Titular ${n}`,
    url: `https://example.test/${n}`,
    sourceId: 'medio-a',
    sourceName: 'Medio A',
    sourceKind: 'local',
    kind: 'article',
    publishedAt: '2026-10-27T09:00:00Z',
    publishedEstimated: false,
    thumbnailUrl: null,
    summary: `Resumen ${n}`,
    tags: ['fichajes'],
    players: [],
    alsoIn: [],
    durationSeconds: null,
    videoId: null,
    ...overrides,
  };
}

function news(items: NewsItemT[]) {
  return {
    updatedAt: '2026-10-27T10:00:00Z',
    dataHash: 'hash',
    items,
    meta: null,
  };
}

const sources = {
  updatedAt: '2026-10-27T10:00:00Z',
  dataHash: 'hash',
  sources: [{ id: 'medio-a', name: 'Medio A', url: null, kind: 'local' as const, items: 45 }],
};

const social: SocialFeedT = {
  updatedAt: '2026-10-27T10:00:00Z',
  dataHash: 'hash',
  profiles: [
    {
      id: 'club-youtube',
      platform: 'youtube',
      name: 'RC Deportivo',
      url: 'https://www.youtube.com/@rcdeportivo',
      handle: '@rcdeportivo',
    },
  ],
  pins: [],
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockOnline = true;
  useNewsRead.setState({ readIds: [] });
  mockSocial = query(social);
  mockSources = query(sources);
});

describe('pantalla Noticias', () => {
  it('muestra el estado vacío cuando no hay noticias', async () => {
    mockNews = query(news([]));
    await render(<NewsScreen />);
    expect(screen.getByText('Todavía no hay noticias publicadas.')).toBeTruthy();
  });

  it('pinta una noticia con fuente, etiqueta y redes oficiales', async () => {
    mockNews = query(news([item(1)]));
    await render(<NewsScreen />);
    expect(screen.getByText('Titular 01')).toBeTruthy();
    expect(screen.getByText(/Medio A ·/)).toBeTruthy();
    expect(screen.getAllByText('Fichajes').length).toBeGreaterThan(0);
    expect(screen.getByText('Redes oficiales')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  it('pagina de 30 en 30 y permite cargar el resto', async () => {
    mockNews = query(
      news(Array.from({ length: 45 }, (_, index) => item(index + 1))),
    );
    await render(<NewsScreen />);
    expect(screen.getByText('Cargar 15 más')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cargar 15 más'));
    expect(screen.getByText('45 noticias')).toBeTruthy();
    expect(screen.queryByText('Cargar 15 más')).toBeNull();
  });

  it('busca por texto y muestra el recuento filtrado', async () => {
    mockNews = query(
      news([
        item(1),
        item(2, { title: 'Riazor estrena césped', summary: null }),
      ]),
    );
    await render(<NewsScreen />);
    await fireEvent.changeText(
      screen.getByLabelText('Buscar titulares, medio o etiqueta'),
      'césped',
    );
    expect(screen.queryByText('Titular 01')).toBeNull();
    expect(screen.getByText('Riazor estrena césped')).toBeTruthy();
    expect(screen.getByText('1 noticia')).toBeTruthy();
  });

  it('muestra el error y reintenta', async () => {
    const refetch = jest.fn();
    mockNews = query(null, { isError: true, refetch });
    await render(<NewsScreen />);
    expect(screen.getByText('No se han podido cargar los datos.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reintentar'));
    expect(refetch).toHaveBeenCalled();
  });

  it('avisa cuando no hay conexión y mantiene la caché visible', async () => {
    mockOnline = false;
    mockNews = query(news([item(1)]));
    await render(<NewsScreen />);
    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByText('Titular 01')).toBeTruthy();
  });

  it('marca como leída al abrir y persiste el id', async () => {
    mockNews = query(news([item(1)]));
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByText('Titular 01'));
    expect(useNewsRead.getState().readIds).toContain('n01');
  });
});
