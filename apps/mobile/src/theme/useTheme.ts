import { useColorScheme } from 'react-native';
import { useSettings } from '@/store/settings';
import { darkColors, lightColors } from './tokens';

export function useTheme() {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const scheme: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const colors = scheme === 'dark' ? darkColors : lightColors;
  return { scheme, colors, poster: colors.poster, paper: colors.paper };
}
