import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FormResult } from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TONE = {
  W: 'win',
  D: 'draw',
  L: 'loss',
} as const;

export function FormChips({ results, variant = 'paper' }: { results: FormResult[]; variant?: 'paper' | 'poster' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (results.length === 0) return null;

  return (
    <View
      accessible
      accessibilityLabel={results
        .map((result) => t(`calendar.outcomeLong.${result}`))
        .join(', ')}
      style={styles.row}
    >
      {results.map((result, index) => (
        <View
          key={`${result}-${index}`}
          accessible
          accessibilityLabel={t(`calendar.outcomeLong.${result}`)}
          style={[
            styles.chip,
            variant === 'poster'
              ? {
                  backgroundColor: colors.poster.outcome[result === 'W' ? 'winBackground' : result === 'L' ? 'lossBackground' : 'drawBackground'],
                  borderColor: colors.poster.outcome[result === 'W' ? 'winBackground' : result === 'L' ? 'lossBackground' : 'drawBackground'],
                }
              : { borderColor: colors[TONE[result]] },
          ]}
        >
          <Text
            style={{
              color: variant === 'poster'
                ? colors.poster.outcome[result === 'W' ? 'winText' : result === 'L' ? 'lossText' : 'drawText']
                : colors[TONE[result]],
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            {t(`calendar.outcome.${result}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: 28,
    minHeight: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
