import { useColorScheme } from 'react-native';
import { useSettings } from '@/store/settings';
import { darkColors, lightColors } from './tokens';

export function useTheme() {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const scheme: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
}
