import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { HeadlinesBlock } from '@/components/home/HeadlinesBlock';
import type { NewsSourceT, NewsStoryT } from '@/data/schemas';
import i18n from '@/i18n';

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors, paper: lightColors.paper }) };
});

const sources: NewsSourceT[] = [
  {
    id: 'medio',
    name: 'Medio de prueba',
    group: 'nacional',
    kind: 'article',
    homepage: 'https://example.test',
  },
];

const story: NewsStoryT = {
  id: 'n1',
  title: 'Titular de prueba',
  url: 'https://example.test/noticia',
  sourceId: 'medio',
  publishedAt: '2026-10-27T08:00:00Z',
  kind: 'article',
  summary: null,
  thumbnailUrl: null,
  tags: [],
  alsoIn: [],
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => undefined) }));

describe('HeadlinesBlock', () => {
  it('no pinta nada sin noticias', async () => {
    await render(<HeadlinesBlock stories={[]} sources={sources} />);
    expect(screen.queryByText('Titulares')).toBeNull();
  });

  it('muestra fuente y tiempo relativo y abre el enlace', async () => {
    const open = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue(undefined as never);
    await render(<HeadlinesBlock stories={[story]} sources={sources} />);

    expect(screen.getByText('Titulares')).toBeTruthy();
    expect(screen.getByText('Titular de prueba')).toBeTruthy();
    expect(screen.getByText('Medio de prueba')).toBeTruthy();
    expect(screen.getByText(/hace/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Titular de prueba'));
    expect(open).toHaveBeenCalledWith('https://example.test/noticia');
  });

  it('se queda en cinco titulares sin repetir y ofrece ver todas', async () => {
    const onSeeAll = jest.fn();
    const stories = Array.from({ length: 7 }, (_, index) => ({
      ...story,
      id: `n${index}`,
      title: `Titular ${index}`,
      url: `https://example.test/${index}`,
    }));
    stories.push({ ...story, id: 'dup', title: 'Titular 1', url: 'https://example.test/dup' });
    await render(<HeadlinesBlock stories={stories} sources={sources} onSeeAll={onSeeAll} />);

    expect(screen.getByText('Titular 0')).toBeTruthy();
    expect(screen.getByText('Titular 4')).toBeTruthy();
    expect(screen.queryByText('Titular 5')).toBeNull();
    expect(screen.queryByText('Titular 6')).toBeNull();
    expect(screen.getAllByText(/^Titular \d$/)).toHaveLength(5);

    await fireEvent.press(screen.getByText('Ver todas'));
    expect(onSeeAll).toHaveBeenCalled();
  });
});
