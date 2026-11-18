import { fireEvent, render, screen } from '@testing-library/react-native';
import NotFound from '../../app/+not-found';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import i18n from '@/i18n';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ scheme: 'light', colors: lightColors }) };
});

beforeAll(async () => {
  await i18n.changeLanguage('es');
});

beforeEach(() => {
  mockReplace.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('recuperación de rutas (F3-02)', () => {
  it('una ruta desconocida ofrece volver al inicio', async () => {
    await render(<NotFound />);

    expect(screen.getByText('Pantalla no encontrada')).toBeTruthy();
    fireEvent.press(screen.getByText('Ir al inicio'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('un error de render muestra el fallback y permite reintentar', async () => {
    const retry = jest.fn();
    await render(<RouteErrorBoundary error={new Error('boom')} retry={retry} />);

    expect(screen.getByText('Algo ha fallado')).toBeTruthy();
    fireEvent.press(screen.getByText('Reintentar'));
    expect(retry).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Ir al inicio'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
