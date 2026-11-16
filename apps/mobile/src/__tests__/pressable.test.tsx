import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Pressable } from '@/components/Pressable';

describe('Pressable', () => {
  // D-08: toda superficie tocable comparte el mismo estado pressed.
  it('atenúa la superficie al pulsar', async () => {
    const { getByTestId } = await render(
      <Pressable testID="surface" accessibilityRole="button" style={{ padding: 8 }}>
        <Text>Acción</Text>
      </Pressable>,
    );

    const surface = getByTestId('surface');
    expect(StyleSheet.flatten(surface.props.style)?.opacity).toBeUndefined();

    const event = { nativeEvent: {}, persist: () => {}, preventDefault: () => {}, stopPropagation: () => {} };
    await fireEvent(surface, 'responderGrant', event);
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ opacity: 0.68 });
  });
});
