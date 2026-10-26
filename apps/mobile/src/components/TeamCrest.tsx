import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SHOW_TEAM_CREST } from '@/config';
import { useTheme } from '@/theme/useTheme';

type Props = {
  team: { name: string; tla: string | null; crestUrl?: string | null };
  size?: number;
};

/**
 * Escudo desde URL externa con hueco fijo (ADR 0012).
 *
 * El contenedor reserva siempre `size × size`: mientras la imagen carga o si falla se
 * pinta el monograma, de modo que la lista no «salta» al aparecer los escudos.
 */
export function TeamCrest({ team, size = 24 }: Props) {
  const { colors } = useTheme();
  // Se guarda la URL cargada/fallida: al cambiar de equipo el estado se reinicia solo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const uri = SHOW_TEAM_CREST && failedUrl !== team.crestUrl ? (team.crestUrl ?? null) : null;
  const loaded = uri !== null && loadedUrl === uri;
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  const initials = (team.tla ?? team.name.slice(0, 3)).toUpperCase();
  const showMonogram = !uri || !loaded;

  return (
    <View style={{ width: size, height: size }} testID="team-crest">
      {showMonogram ? (
        <View
          {...hidden}
          style={[
            styles.mono,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: colors.textMuted,
              fontSize: Math.max(8, size * 0.32),
              fontWeight: '700',
            }}
          >
            {initials}
          </Text>
        </View>
      ) : null}
      {uri ? (
        <Image
          {...hidden}
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => setFailedUrl(team.crestUrl ?? null)}
          onLoad={() => setLoadedUrl(uri)}
          recyclingKey={`${team.name}-${team.crestUrl ?? ''}-${size}`}
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { width: size, height: size }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mono: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
