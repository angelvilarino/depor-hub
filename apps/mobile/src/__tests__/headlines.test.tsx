import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { HeadlinesBlock } from '@/components/home/HeadlinesBlock';
import i18n from '@/i18n';

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

const item = {
  id: 'n1',
  title: 'Titular de prueba',
  url: 'https://example.test/noticia',
  sourceId: 'medio',
  sourceName: 'Medio de prueba',
  sourceKind: 'nacional' as const,
  kind: 'article' as const,
  publishedAt: '2026-10-27T08:00:00Z',
  publishedEstimated: false,
  thumbnailUrl: null,
  summary: null,
  tags: [],
  players: [],
  alsoIn: [],
  durationSeconds: null,
  videoId: null,
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));

describe('HeadlinesBlock', () => {
  it('no pinta nada sin noticias', async () => {
    await render(<HeadlinesBlock items={[]} />);
    expect(screen.queryByText('Titulares')).toBeNull();
  });

  it('muestra fuente y fecha y abre el enlace', async () => {
    const open = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue(undefined as never);
    await render(<HeadlinesBlock items={[item]} />);

    expect(screen.getByText('Titulares')).toBeTruthy();
    expect(screen.getByText('Titular de prueba')).toBeTruthy();
    expect(screen.getByText(/Medio de prueba · 27 oct/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Titular de prueba'));
    expect(open).toHaveBeenCalledWith('https://example.test/noticia');
  });

  it('se queda en cinco titulares sin repetir y ofrece ver todas', async () => {
    const onSeeAll = jest.fn();
    const items = Array.from({ length: 7 }, (_, index) => ({
      ...item,
      id: `n${index}`,
      title: `Titular ${index}`,
      url: `https://example.test/${index}`,
    }));
    items.push({ ...item, id: 'dup', title: 'Titular 1', url: 'https://example.test/dup' });
    await render(<HeadlinesBlock items={items} onSeeAll={onSeeAll} />);

    expect(screen.getByText('Titular 0')).toBeTruthy();
    expect(screen.getByText('Titular 4')).toBeTruthy();
    expect(screen.queryByText('Titular 5')).toBeNull();
    expect(screen.queryByText('Titular 6')).toBeNull();
    expect(screen.getAllByText(/^Titular \d$/)).toHaveLength(5);

    await fireEvent.press(screen.getByText('Ver todas'));
    expect(onSeeAll).toHaveBeenCalled();
  });
});
