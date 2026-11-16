import { StyleSheet, Text, View } from 'react-native';
import { text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { avatarColor, initials } from '@/features/squad/logic';

/** Avatar generado (sin fotos con derechos): iniciales sobre un color estable por jugador. */
export function PlayerAvatar({ id, name, size = 44 }: { id: number; name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id) }]}
    >
      <Text style={{ color: colors.onImage, fontSize: Math.max(text.caption.fontSize, Math.round(size * 0.38)), fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ circle: { alignItems: 'center', justifyContent: 'center' } });
