import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MatchT } from '@/data/schemas';
import { TeamCrest } from '@/components/TeamCrest';
import { outcome, teamName } from '@/features/calendar/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate, formatMatchTime } from '@/utils/matchTime';

const PLAIN = new Set(['SCHEDULED', 'TIMED', 'FINISHED']);

export function MatchCard({ match }: { match: MatchT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const time = formatMatchTime(match.utcDate, match.status, i18n.language);
  const date = formatMatchDate(match.utcDate, match.status, i18n.language);
  const out = outcome(match);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const rows = [
    { team: match.home, goals: match.score.home, depor: match.deporIsHome },
    { team: match.away, goals: match.score.away, depor: !match.deporIsHome },
  ];
  const outColor = out === 'W' ? colors.primary : out === 'L' ? colors.danger : colors.textMuted;
  const summary = hasScore ? `${match.score.home}–${match.score.away}` : (time ?? t('calendar.timeTbc'));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${date}. ${teamName(match.home)} ${t('calendar.versus')} ${teamName(match.away)}. ${summary}`}
      onPress={() => router.push(`/match/${match.id}`)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.dateCol}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{date}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{time ?? t('calendar.timeTbc')}</Text>
        {!PLAIN.has(match.status) && (
          <Text style={{ color: colors.danger, fontSize: 12 }}>
            {t(`calendar.status.${match.status}`, { defaultValue: match.status })}
          </Text>
        )}
      </View>
      <View style={styles.teams}>
        {rows.map((r, i) => (
          <View key={i} style={styles.teamRow}>
            <TeamCrest team={r.team} size={22} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: r.depor ? '700' : '400' }}
            >
              {teamName(r.team)}
            </Text>
            {hasScore && (
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: r.depor ? '700' : '400' }}>{r.goals}</Text>
            )}
          </View>
        ))}
      </View>
      {out && (
        <Text accessibilityLabel={t(`calendar.outcomeLong.${out}`)} style={{ color: outColor, fontWeight: '700', width: 20, textAlign: 'center' }}>
          {t(`calendar.outcome.${out}`)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: minTouch + spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateCol: { width: 84, gap: 2 },
  teams: { flex: 1, gap: spacing.xs },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
