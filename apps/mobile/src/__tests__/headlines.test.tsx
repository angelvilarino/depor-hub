import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
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
  sourceName: 'Medio de prueba',
  publishedAt: '2026-10-27T08:00:00Z',
  thumbnailUrl: null,
  tags: [],
};

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

describe('HeadlinesBlock', () => {
  it('no pinta nada sin noticias', async () => {
    await render(<HeadlinesBlock items={[]} />);
    expect(screen.queryByText('Titulares')).toBeNull();
  });

  it('muestra fuente y fecha y abre el enlace', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<HeadlinesBlock items={[item]} />);

    expect(screen.getByText('Titulares')).toBeTruthy();
    expect(screen.getByText('Titular de prueba')).toBeTruthy();
    expect(screen.getByText(/Medio de prueba · 27 oct/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Titular de prueba'));
    expect(open).toHaveBeenCalledWith('https://example.test/noticia');
  });
});
