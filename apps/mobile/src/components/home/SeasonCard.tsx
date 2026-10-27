import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { FormChips } from '@/components/home/FormChips';
import type { FormResult, SeasonSummary } from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export function SeasonCard({
  summary,
  form,
}: {
  summary: SeasonSummary;
  form: FormResult[];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t('home.seasonSummary', {
    position: summary.position,
    points: summary.points,
    played: summary.played,
    won: summary.won,
    drawn: summary.drawn,
    lost: summary.lost,
    goalsFor: summary.goalsFor,
    goalsAgainst: summary.goalsAgainst,
    goalDifference: summary.goalDifference,
  });

  return (
    <Card>
      <View accessible accessibilityLabel={label} style={styles.group}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.season')}
        </Text>
        <View style={styles.grid}>
          <Stat label={t('home.stats.position')} value={`${summary.position}º`} />
          <Stat label={t('home.stats.points')} value={String(summary.points)} />
          <Stat label={t('calendar.col.played')} value={String(summary.played)} />
          <Stat
            label={t('home.stats.record')}
            value={`${summary.won}-${summary.drawn}-${summary.lost}`}
          />
          <Stat
            label={t('home.stats.goals')}
            value={`${summary.goalsFor}-${summary.goalsAgainst}`}
          />
          <Stat
            label={t('calendar.col.goalDiff')}
            value={summary.goalDifference > 0 ? `+${summary.goalDifference}` : String(summary.goalDifference)}
          />
        </View>
        {form.length > 0 ? (
          <View style={styles.form}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
              {t('home.formTitle')}
            </Text>
            <FormChips results={form} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  stat: { width: '33.33%', gap: 2 },
  form: { gap: spacing.xs },
});
