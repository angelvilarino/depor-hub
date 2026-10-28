import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { WhatIsAtStakeT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const LABEL = { W: 'win', D: 'draw', L: 'loss' } as const;

export function WhatsAtStakeCard({ stake }: { stake: WhatIsAtStakeT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('home.stake.title')}
      </Text>
      <View style={styles.scenarios}>
        {stake.scenarios.map((scenario) => (
          <View
            key={scenario.result}
            accessible
            accessibilityLabel={`${t(`home.stake.${LABEL[scenario.result]}`)}: ${t(
              'home.stake.points',
              { points: scenario.points },
            )}, ${scenario.range.from}–${scenario.range.to}`}
            style={[styles.scenario, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
              {t(`home.stake.${LABEL[scenario.result]}`)}
            </Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {scenario.range.from === scenario.range.to
                ? t('home.stake.rangeSame', { position: scenario.range.from })
                : t('home.stake.range', {
                    from: scenario.range.from,
                    to: scenario.range.to,
                  })}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t('home.stake.points', { points: scenario.points })}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('home.stake.assumption')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scenarios: { flexDirection: 'row', gap: spacing.sm },
  scenario: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
});
