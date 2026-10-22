import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHOW_TEAM_CREST } from '@/config';
import { useTheme } from '@/theme/useTheme';

type Props = {
  team: { name: string; tla: string | null; crestUrl?: string | null };
  size?: number;
};

/** Escudo desde URL externa; si no hay URL o falla la carga, monograma (TLA o iniciales). */
export function TeamCrest({ team, size = 24 }: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = SHOW_TEAM_CREST && !failed ? (team.crestUrl ?? null) : null;
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

  if (uri) {
    return (
      <View {...hidden} style={{ width: size, height: size }}>
        <Image
          source={{ uri }}
          contentFit="contain"
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
        />
      </View>
    );
  }
  const initials = (team.tla ?? team.name.slice(0, 3)).toUpperCase();
  return (
    <View
      {...hidden}
      style={[
        styles.mono,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={{ color: colors.textMuted, fontSize: Math.max(8, size * 0.32), fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mono: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
