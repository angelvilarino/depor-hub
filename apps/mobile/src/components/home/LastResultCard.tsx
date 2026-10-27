import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchT } from '@/data/schemas';
import { outcome, teamName } from '@/features/calendar/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate } from '@/utils/matchTime';

export function LastResultCard({ match }: { match: MatchT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const result = outcome(match);
  const date = formatMatchDate(match.utcDate, match.status, i18n.language);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const score = hasScore
    ? `${match.score.home}–${match.score.away}`
    : t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const color =
    result === 'W' ? colors.primary : result === 'L' ? colors.danger : colors.textMuted;
  const summary = [
    t('home.lastResult'),
    `${teamName(match.home)} ${score} ${teamName(match.away)}`,
    result ? t(`calendar.outcomeLong.${result}`) : null,
    date,
    match.matchday !== null ? t('calendar.matchday', { n: match.matchday }) : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.lastResult')}
        </Text>
        {match.matchday !== null ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {t('calendar.matchday', { n: match.matchday })}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.row}
      >
        <View style={styles.side}>
          <TeamCrest team={match.home} size={36} />
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
            {teamName(match.home)}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>{score}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{date}</Text>
        </View>
        <View style={styles.side}>
          <TeamCrest team={match.away} size={36} />
          <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
            {teamName(match.away)}
          </Text>
        </View>
        {result ? (
          <Text
            accessibilityLabel={t(`calendar.outcomeLong.${result}`)}
            style={{ color, fontSize: 18, fontWeight: '700', width: 22, textAlign: 'center' }}
          >
            {t(`calendar.outcome.${result}`)}
          </Text>
        ) : null}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  name: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  scoreBox: { alignItems: 'center', gap: 2, minWidth: 72 },
});
