import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CrestBadge, PosterCard, SectionHeader } from '@/components/design/DesignSystem';
import type { MatchT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import { radius, spacing, text, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDateShort } from '@/utils/matchTime';

type Props = {
  match: MatchT;
  competitionName: string | null;
  time: string | null;
  statusLabel: string;
  live: boolean;
};

/** D-05: el marcador es el protagonista; el contexto vive en una sola cabecera. */
export function MatchScoreboard({ match, competitionName, time, statusLabel, live }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const hasScore = match.score.home !== null && match.score.away !== null;
  const score = hasScore ? `${match.score.home} – ${match.score.away}` : (time ?? 'vs');
  const date = formatMatchDateShort(match.utcDate, match.status, i18n.language);
  const halfTime =
    match.score.halfTimeHome !== null && match.score.halfTimeAway !== null
      ? `${match.score.halfTimeHome}–${match.score.halfTimeAway}`
      : null;
  const subtitle =
    match.matchday !== null ? t('calendar.matchday', { n: match.matchday }) : undefined;
  const summary = [
    `${teamName(match.home)} ${score} ${teamName(match.away)}`,
    statusLabel,
    date,
    time,
    halfTime ? `${t('match.halfTime')} ${halfTime}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <PosterCard>
      <SectionHeader
        title={competitionName ?? t('match.title')}
        subtitle={subtitle || undefined}
        variant="poster"
      />
      <View accessible accessibilityLabel={summary} style={styles.board}>
        <View style={styles.side}>
          <CrestBadge size={56} team={match.home} />
          <Text numberOfLines={2} style={[styles.team, { color: colors.poster.text }]}>
            {teamName(match.home)}
          </Text>
        </View>
        <View style={styles.center}>
          <Text
            adjustsFontSizeToFit
            maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}
            numberOfLines={1}
            style={[styles.score, { color: colors.poster.text }]}
          >
            {score}
          </Text>
          {halfTime ? (
            <Text style={[styles.halfTime, { color: colors.poster.muted }]}>
              {t('match.halfTime')} {halfTime}
            </Text>
          ) : null}
        </View>
        <View style={styles.side}>
          <CrestBadge size={56} team={match.away} />
          <Text numberOfLines={2} style={[styles.team, { color: colors.poster.text }]}>
            {teamName(match.away)}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View
          style={[
            styles.status,
            { borderColor: live ? colors.poster.accent : colors.poster.muted },
          ]}
        >
          {live ? (
            <View style={[styles.liveDot, { backgroundColor: colors.poster.accent }]} />
          ) : null}
          <Text
            style={{
              color: live ? colors.poster.accent : colors.poster.text,
              ...text.caption,
              fontWeight: '800',
              letterSpacing: live ? 1 : 0,
            }}
          >
            {live ? statusLabel.toLocaleUpperCase(i18n.language) : statusLabel}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.poster.muted }]}>
          {[date, time].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </PosterCard>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.sm },
  team: { fontFamily: typography.display, ...text.bodyLarge, textAlign: 'center' },
  center: { minWidth: 88, alignItems: 'center', gap: spacing.xs },
  score: { fontFamily: typography.numeric, ...text.hero, textAlign: 'center' },
  halfTime: { ...text.caption, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    minHeight: 28,
  },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill },
  date: { flexShrink: 1, textAlign: 'right', ...text.body },
});
