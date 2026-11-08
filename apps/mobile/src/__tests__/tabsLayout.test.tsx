import { fireEvent, render } from '@testing-library/react-native';
import { SettingsHeaderAction } from '../../app/(tabs)/_layout';

const mockPush = jest.fn();

jest.mock('expo-router', () => {
  return {
    Tabs: { Screen: () => null },
    router: { push: (...args: unknown[]) => mockPush(...args) },
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'settings.title' ? 'Ajustes' : key),
  }),
}));

jest.mock('@/theme/useTheme', () => {
  const { lightColors } = jest.requireActual('@/theme/tokens');
  return { useTheme: () => ({ colors: lightColors }) };
});

describe('settings header action', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('uses a neutral and accessible 44pt icon button', async () => {
    const { getByTestId } = await render(<SettingsHeaderAction />);

    const button = getByTestId('settings-header-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Ajustes');
    expect(button.props.style).toEqual(
      expect.objectContaining({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'transparent',
      }),
    );
    fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
