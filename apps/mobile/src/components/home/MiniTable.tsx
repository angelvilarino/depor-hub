import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { StandingsTable } from '@/components/StandingsTable';
import type { StandingRowT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function MiniTable({
  rows,
  teamId,
}: {
  rows: StandingRowT[];
  teamId: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('home.miniTable')}
      </Text>
      {rows.length > 0 ? (
        <View style={styles.table}>
          <StandingsTable table={rows} highlightTeamId={teamId} compact />
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>{t('home.noStandings')}</Text>
      )}
      {rows.length > 0 ? (
        <Button
          variant="secondary"
          label={t('home.seeFullTable')}
          onPress={() => router.push({ pathname: '/calendar', params: { tab: 'standings' } })}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  table: { gap: spacing.xs },
});
