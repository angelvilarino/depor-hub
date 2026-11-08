import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Path, Rect } from 'react-native-svg';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { clubImageUrl } from '@/config';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Ruta relativa del contrato (`img/club/...`). */
  path: string | null | undefined;
  /** URL externa solo para medios publicados y verificados. */
  remoteUrl?: string | null;
  /** Texto alternativo para lectores de pantalla. */
  label: string;
  width: number;
  height: number;
  borderRadius?: number;
  contentFit?: 'contain' | 'cover';
  placeholderLabel?: string | null;
  testID?: string;
  illustrationColors?: string[];
};

/**
 * Imagen del club con hueco fijo. El caller puede usar una URL externa solo para
 * un medio verificado; la ruta del contrato conserva la ilustración de respaldo.
 * Si no hay imagen, la URL falla o no hay base configurada, se muestra un marcador.
 */
export function ClubImage({
  path,
  remoteUrl,
  label,
  width,
  height,
  borderRadius = radius.md,
  contentFit = 'contain',
  placeholderLabel,
  testID,
  illustrationColors,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [failedUris, setFailedUris] = useState<string[]>([]);
  const localUri = clubImageUrl(path);
  const preferredUri = remoteUrl?.trim() || localUri;
  const uri = [preferredUri, localUri].find(
    (candidate): candidate is string =>
      candidate !== null && candidate.length > 0 && !failedUris.includes(candidate),
  ) ?? null;
  const failed = uri === null;
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
          {illustrationColors?.length ? <KitIllustration colors={illustrationColors} /> : <Ionicons name="image-outline" size={Math.max(18, Math.min(width, height) * 0.32)} color={colors.textMuted} />}
          {illustrationColors?.length ? <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>{t('club.equipaciones.illustration')}</Text> : placeholderLabel === null ? null : (
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
            onError={() => {
              if (uri) setFailedUris((previous) => (
                previous.includes(uri) ? previous : [...previous, uri]
              ));
            }}
            recyclingKey={`${uri ?? path}-${width}x${height}`}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            testID={testID ? `${testID}-resolved-image` : undefined}
          />
        </View>
      )}
    </View>
  );
}

const COLOR_NAMES: Record<string, string> = {
  blanco: '#F8FAFC', blanca: '#F8FAFC', white: '#F8FAFC', azul: '#0876BD', azulmarino: '#102A43', navy: '#102A43', negro: '#111827', black: '#111827', rojo: '#C62828', red: '#C62828', amarillo: '#F4C542', yellow: '#F4C542', naranja: '#F97316', orange: '#F97316', gris: '#9CA3AF', gray: '#9CA3AF', verde: '#16804A', green: '#16804A', morado: '#7047A3', purple: '#7047A3', granate: '#7F1D35', rosa: '#DB2777', oro: '#C5A13B', dorado: '#C5A13B', celeste: '#66B8E8', turquesa: '#0F9E9A',
};
function colorValue(name: string, fallback: string): string {
  const normalized = name.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s-]/g, '');
  return COLOR_NAMES[normalized] ?? (/^#[\da-f]{6}$/i.test(name) ? name : fallback);
}

function KitIllustration({ colors }: { colors: string[] }) {
  const main = colorValue(colors[0] ?? 'white', '#F8FAFC');
  const accent = colorValue(colors[1] ?? 'azul', '#0876BD');
  const stripeCount = main.toLowerCase() === accent.toLowerCase() ? 0 : 4;
  return <Svg accessibilityLabel="Ilustración de equipación" viewBox="0 0 100 110" width="100%" height="100%">
    <Path d="M32 8 41 3h18l9 5 20 12-9 18-11-7v69H32V31l-11 7-9-18L32 8Z" fill={main} stroke="#475569" strokeWidth="2" />
    {Array.from({ length: stripeCount }, (_, index) => <Rect key={index} x={38 + index * 8} y="31" width="4" height="67" fill={accent} opacity="0.92" />)}
    <Path d="M41 4h18c-1 8-4 12-9 12s-8-4-9-12Z" fill={accent} />
  </Svg>;
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
