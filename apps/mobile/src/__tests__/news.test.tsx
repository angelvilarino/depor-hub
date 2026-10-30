import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import NewsScreen from '../../app/(tabs)/news';
import type { NewsSourceT, NewsStoryT } from '@/data/schemas';
import i18n from '@/i18n';
import { useNewsRead } from '@/store/news';

let mockNews: unknown;
let mockOnline = true;

jest.mock('@/data/queries', () => ({
  useNews: () => mockNews,
}));

jest.mock('@/data/useOnline', () => ({ useOnline: () => mockOnline }));

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  dataUpdatedAt: data ? Date.now() : 0,
  isPending: false,
  isFetching: false,
  isError: false,
  isRefetching: false,
  refetch: jest.fn(),
  ...overrides,
});

const sources: NewsSourceT[] = [
  { id: 'medio-a', name: 'Medio A', group: 'galicia', kind: 'article', homepage: 'https://a.test' },
  { id: 'medio-b', name: 'Medio B', group: 'nacional', kind: 'article', homepage: 'https://b.test' },
];

const TODAY = new Date().toISOString();

function story(overrides: Partial<NewsStoryT> = {}): NewsStoryT {
  const n = overrides.id ?? 'n01';
  return {
    id: n,
    title: `Titular ${n}`,
    url: `https://example.test/${n}`,
    sourceId: 'medio-a',
    publishedAt: TODAY,
    kind: 'article',
    summary: `Resumen ${n}`,
    thumbnailUrl: null,
    tags: ['fichajes'],
    alsoIn: [],
    ...overrides,
  };
}

function news(stories: NewsStoryT[]) {
  return { updatedAt: TODAY, sources, stories };
}

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockOnline = true;
  useNewsRead.setState({ readIds: [] });
  jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue(undefined as never);
});

describe('pantalla Noticias', () => {
  it('muestra el estado vacío cuando no hay historias', async () => {
    mockNews = query(news([]));
    await render(<NewsScreen />);
    expect(screen.getByText('Todavía no hay noticias publicadas.')).toBeTruthy();
  });

  it('pinta una historia con medio, etiqueta y cabecera de día', async () => {
    mockNews = query(news([story()]));
    await render(<NewsScreen />);
    expect(screen.getByText('Titular n01')).toBeTruthy();
    expect(screen.getByText('Medio A')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getAllByText('Fichajes').length).toBeGreaterThan(0);
    expect(screen.getByText('1 sin leer')).toBeTruthy();
  });

  it('abre la noticia y la marca como leída', async () => {
    mockNews = query(news([story()]));
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByText('Titular n01'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.test/n01');
    expect(useNewsRead.getState().readIds).toContain('n01');
  });

  it('busca con debounce sobre título, medio y etiquetas', async () => {
    mockNews = query(
      news([
        story({ id: 'n01' }),
        story({ id: 'n02', title: 'Riazor estrena césped', tags: ['partido'], summary: null }),
      ]),
    );
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByLabelText('Buscar'));
    await fireEvent.changeText(
      screen.getByPlaceholderText('Buscar titulares, medio o etiqueta'),
      'césped',
    );
    await waitFor(() => expect(screen.queryByText('Titular n01')).toBeNull());
    expect(screen.getByText('Riazor estrena césped')).toBeTruthy();
    expect(screen.getAllByText('1 noticia').length).toBeGreaterThan(0);
  });

  it('filtra por grupo y limpia con el contador', async () => {
    mockNews = query(
      news([
        story({ id: 'n01' }),
        story({ id: 'n02', sourceId: 'medio-b', tags: ['partido'] }),
      ]),
    );
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByLabelText('Nacional'));
    expect(screen.queryByText('Titular n01')).toBeNull();
    expect(screen.getByText('Titular n02')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Limpiar (1)'));
    expect(screen.getByText('Titular n01')).toBeTruthy();
    expect(screen.getByText('Titular n02')).toBeTruthy();
  });

  it('filtra por fuente desde la hoja inferior', async () => {
    mockNews = query(
      news([
        story({ id: 'n01' }),
        story({ id: 'n02', sourceId: 'medio-b', tags: ['partido'] }),
      ]),
    );
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByLabelText('Filtros'));
    await fireEvent.press(screen.getByLabelText('Medio B: 1 noticias'));
    await fireEvent.press(screen.getAllByLabelText('Cerrar').at(-1)!);
    expect(screen.queryByText('Titular n01')).toBeNull();
    expect(screen.getByText('Titular n02')).toBeTruthy();
  });

  it('despliega las otras versiones del clúster y las abre', async () => {
    mockNews = query(
      news([
        story({
          id: 'n01',
          alsoIn: [
            {
              sourceId: 'medio-b',
              title: 'La versión de Medio B',
              url: 'https://b.test/version',
              publishedAt: TODAY,
            },
          ],
        }),
      ]),
    );
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByLabelText('+1 medio'));
    expect(screen.getByText('La versión de Medio B')).toBeTruthy();
    await fireEvent.press(screen.getByText('La versión de Medio B'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://b.test/version');
  });

  it('marca todas como leídas con confirmación y permite deshacer', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockNews = query(news([story({ id: 'n01' }), story({ id: 'n02' })]));
    await render(<NewsScreen />);
    await fireEvent.press(screen.getByLabelText('Marcar todas como leídas'));
    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === 'Marcar leídas')!.onPress!();
    });
    expect(useNewsRead.getState().readIds).toEqual(['n01', 'n02']);
    expect(screen.getByText('2 noticias marcadas como leídas')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Deshacer'));
    expect(useNewsRead.getState().readIds).toEqual([]);
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
    mockNews = query(news([story()]));
    await render(<NewsScreen />);
    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect(screen.getByText('Titular n01')).toBeTruthy();
  });
});
