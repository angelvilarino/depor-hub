import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Esqueleto de la Home: cinco bloques con la misma altura aproximada que las tarjetas. */
export function HomeSkeleton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.list} accessibilityLabel={t('data.loading')}>
      {[140, 110, 150, 190, 80].map((height, index) => (
        <View
          key={index}
          style={[
            styles.card,
            { height, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
});
