import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Pressable } from '@/components/Pressable';

describe('Pressable', () => {
  // D-08: toda superficie tocable comparte el mismo estado pressed.
  it('atenúa la superficie al pulsar', async () => {
    const { getByTestId } = await render(
      <Pressable testID="surface" accessibilityRole="button" style={{ padding: spacing.sm }}>
        <Text>Acción</Text>
      </Pressable>,
    );

    const surface = getByTestId('surface');
    expect(StyleSheet.flatten(surface.props.style)?.opacity).toBeUndefined();

    const event = {
      nativeEvent: {},
      persist: () => {},
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    await fireEvent(surface, 'responderGrant', event);
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ opacity: 0.68 });
  });

  // D-22: los objetivos pequeños ganan 8 pt de área táctil sin cambiar el layout.
  it('aplica hitSlop 8 por defecto y respeta el explícito', async () => {
    const first = await render(
      <Pressable testID="default-hit" accessibilityRole="button">
        <Text>Acción</Text>
      </Pressable>,
    );
    expect(first.getByTestId('default-hit').props.hitSlop).toBe(8);

    const second = await render(
      <Pressable testID="custom-hit" accessibilityRole="button" hitSlop={16}>
        <Text>Acción</Text>
      </Pressable>,
    );
    expect(second.getByTestId('custom-hit').props.hitSlop).toBe(16);
  });
});
