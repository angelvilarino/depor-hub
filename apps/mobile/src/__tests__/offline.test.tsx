import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorState } from '@/components/StateViews';
import { queryClient } from '@/data/queryClient';
import i18n from '@/i18n';

let mockOnline = true;

jest.mock('@/data/useOnline', () => ({ useOnline: () => mockOnline }));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockOnline = true;
});

describe('estado terminal sin red (F3-03)', () => {
  it('la app intenta la red antes de rendirse (offlineFirst)', () => {
    expect(queryClient.getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
  });

  it('sin conexión y sin caché lo dice y ofrece reintentar', async () => {
    mockOnline = false;
    const retry = jest.fn();
    await render(<ErrorState onRetry={retry} />);

    expect(
      screen.getByText(
        'Sin conexión y todavía no hay datos guardados. Se reintentará cuando vuelvas a estar en línea.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('con conexión mantiene el mensaje genérico de error', async () => {
    await render(<ErrorState onRetry={jest.fn()} />);

    expect(screen.getByText('No se han podido cargar los datos.')).toBeTruthy();
  });
});
