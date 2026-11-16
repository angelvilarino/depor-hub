import type { ComponentProps } from 'react';
import {
  Pressable as NativePressable,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type NativePressableProps = ComponentProps<typeof NativePressable>;

export type PressableProps = NativePressableProps;

const PRESSED_OPACITY = 0.68;

/**
 * D-08: un único estado `pressed` para toda superficie tocable. Sustituye al
 * `Pressable` de React Native en la app para que ninguna pantalla quede
 * estática al toque.
 */
export function Pressable({ style, hitSlop = 8, ...rest }: PressableProps) {
  return (
    <NativePressable
      {...rest}
      hitSlop={hitSlop}
      style={(state: PressableStateCallbackType): StyleProp<ViewStyle> => [
        typeof style === 'function' ? style(state) : style,
        state.pressed ? { opacity: PRESSED_OPACITY } : null,
      ]}
    />
  );
}
