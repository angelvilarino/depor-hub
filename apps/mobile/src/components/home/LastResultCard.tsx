import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CrestBadge, PosterCard, SectionHeader } from '@/components/design/DesignSystem';
import type { MatchT } from '@/data/schemas';
import { outcome, teamName } from '@/features/calendar/logic';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate } from '@/utils/matchTime';

export function LastResultCard({ match }: { match: MatchT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const result = outcome(match);
  const date = formatMatchDate(match.utcDate, match.status, i18n.language);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const score = hasScore ? `${match.score.home}–${match.score.away}` : t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const color = result ? colors.poster.outcome[
    result === 'W' ? 'winText' : result === 'L' ? 'lossText' : 'drawText'
  ] : colors.poster.text;
  const label = [
    t('home.finalResult'),
    `${teamName(match.home)} ${score} ${teamName(match.away)}`,
    result ? t(`calendar.outcomeLong.${result}`) : null,
    date,
    match.matchday !== null ? t('calendar.matchday', { n: match.matchday }) : null,
  ].filter(Boolean).join('. ');
  const resultBackground = result ? colors.poster.outcome[
    result === 'W' ? 'winBackground' : result === 'L' ? 'lossBackground' : 'drawBackground'
  ] : colors.poster.text;

  return (
    <PosterCard>
      <SectionHeader
        title={t('home.finalResult')}
        subtitle={match.matchday !== null ? t('calendar.matchday', { n: match.matchday }) : undefined}
        variant="poster"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.row}
      >
        <View style={styles.side}>
          <CrestBadge team={match.home} size={62} />
          <Text style={[styles.name, { color: colors.poster.text }]}>{teamName(match.home)}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text adjustsFontSizeToFit style={[styles.score, { color: colors.poster.text }]}>
            {score}
          </Text>
          <Text style={[styles.date, { color: colors.poster.muted }]}>{date}</Text>
        </View>
        <View style={styles.side}>
          <CrestBadge team={match.away} size={62} />
          <Text style={[styles.name, { color: colors.poster.text }]}>{teamName(match.away)}</Text>
        </View>
      </Pressable>
      {result ? (
        <View style={[styles.outcome, { backgroundColor: resultBackground }]}>
          <Text style={{ color, fontSize: 13, fontWeight: '900' }}>
            {t(`calendar.outcome.${result}`)} · {t(`calendar.outcomeLong.${result}`)}
          </Text>
        </View>
      ) : null}
    </PosterCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xs },
  name: { fontFamily: typography.display, fontSize: 18, lineHeight: 21, textAlign: 'center' },
  scoreBox: { alignItems: 'center', gap: spacing.xs },
  score: { fontFamily: typography.numeric, fontSize: 40, lineHeight: 46, textAlign: 'center' },
  date: { fontSize: 12, textAlign: 'center' },
  outcome: { alignSelf: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
