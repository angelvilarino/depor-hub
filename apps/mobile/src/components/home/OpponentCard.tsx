import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { TeamCrest } from '@/components/TeamCrest';
import { teamName } from '@/features/calendar/logic';
import type { OpponentInfo } from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function OpponentCard({ info }: { info: OpponentInfo }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tableLine = info.row
    ? t('home.opponentTable', { position: info.row.position, points: info.row.points })
    : null;
  const balanceLine = info.balance
    ? t('home.balance', {
        played: info.balance.played,
        won: info.balance.won,
        drawn: info.balance.drawn,
        lost: info.balance.lost,
        goalsFor: info.balance.goalsFor,
        goalsAgainst: info.balance.goalsAgainst,
      })
    : null;
  const label = [t('home.opponent'), teamName(info.opponent), tableLine, balanceLine]
    .filter(Boolean)
    .join('. ');

  return (
    <Card>
      <View accessible accessibilityLabel={label} style={styles.group}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.opponent')}
        </Text>
        <View style={styles.teamRow}>
          <TeamCrest team={info.opponent} size={36} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            {teamName(info.opponent)}
          </Text>
        </View>
        {tableLine ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{tableLine}</Text>
        ) : null}
        {balanceLine ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{balanceLine}</Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
