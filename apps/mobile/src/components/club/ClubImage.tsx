import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { clubImageUrl } from '@/config';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Ruta relativa del contrato (`img/club/...`). */
  path: string | null | undefined;
  /** Texto alternativo para lectores de pantalla. */
  label: string;
  width: number;
  height: number;
  borderRadius?: number;
  contentFit?: 'contain' | 'cover';
  placeholderLabel?: string | null;
  testID?: string;
};

/**
 * Imagen local del club con hueco fijo. Si no hay ruta, la URL base no está
 * configurada o la descarga falla, se pinta un marcador con el mismo tamaño para
 * que la lista no salte. Las imágenes nunca se piden a un dominio externo desde la
 * app: `clubImageUrl` las resuelve contra la base de datos pública.
 */
export function ClubImage({
  path,
  label,
  width,
  height,
  borderRadius = radius.md,
  contentFit = 'contain',
  placeholderLabel,
  testID,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const uri = clubImageUrl(path);
  const failed = !uri || failedPath === path;
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  return (
    <View
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.box,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {failed ? (
        <View
          {...hidden}
          testID={testID ? `${testID}-placeholder` : undefined}
          style={styles.placeholder}
        >
          <Ionicons name="image-outline" size={Math.max(18, Math.min(width, height) * 0.32)} color={colors.textMuted} />
          {placeholderLabel === null ? null : (
            <Text
              numberOfLines={2}
              style={{
                color: colors.textMuted,
                fontSize: Math.max(9, Math.min(12, width * 0.14)),
                textAlign: 'center',
              }}
            >
              {placeholderLabel ?? t('club.noImage')}
            </Text>
          )}
        </View>
      ) : (
        <View testID={testID ? `${testID}-image` : undefined} style={StyleSheet.absoluteFill}>
          <Image
            {...hidden}
            cachePolicy="memory-disk"
            contentFit={contentFit}
            onError={() => setFailedPath(path ?? null)}
            recyclingKey={`${path}-${width}x${height}`}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});
