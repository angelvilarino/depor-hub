import { act, render } from '@testing-library/react-native';

import RootLayout from '../../app/_layout';

const mockHideAsync = jest.fn();
let mockFonts: [boolean, Error | null] = [false, null];
let mockHydrate: (() => void) | null = null;

jest.mock('expo-font', () => ({ useFonts: () => mockFonts }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: () => mockHideAsync(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Screen = () => null;
  Screen.displayName = 'StackScreen';
  Stack.displayName = 'Stack';
  Stack.Screen = Screen;
  return { Stack };
});
jest.mock('@/data/DataProvider', () => {
  const React = require('react');
  return {
    DataProvider: ({
      children,
      onHydrated,
    }: {
      children?: React.ReactNode;
      onHydrated?: () => void;
    }) => {
      React.useEffect(() => {
        mockHydrate = onHydrated ?? null;
      }, [onHydrated]);
      return React.createElement(React.Fragment, null, children);
    },
  };
});
jest.mock('@/features/reminders/ReminderSync', () => ({ ReminderSync: () => null }));
jest.mock('@/components/RouteErrorBoundary', () => ({ RouteErrorBoundary: () => null }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn() },
  resolveLanguage: () => 'es',
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: { surface: 'black', text: 'white', background: 'black' },
    scheme: 'dark',
  }),
}));

describe('puerta del splash (F3-03, F5-07)', () => {
  beforeEach(() => {
    mockHideAsync.mockClear();
    mockFonts = [false, null];
    mockHydrate = null;
  });

  it('no oculta el splash hasta tener fuentes y caché', async () => {
    const view = await render(<RootLayout />);
    expect(mockHideAsync).not.toHaveBeenCalled();

    await act(async () => mockHydrate?.());
    expect(mockHideAsync).not.toHaveBeenCalled();

    mockFonts = [true, null];
    await act(async () => view.rerender(<RootLayout />));
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('un error de fuente también deja arrancar', async () => {
    mockFonts = [false, new Error('sin fuentes')];
    const view = await render(<RootLayout />);

    await act(async () => mockHydrate?.());
    await act(async () => view.rerender(<RootLayout />));

    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });
});
