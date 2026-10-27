import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchT } from '@/data/schemas';
import { useFixtures } from '@/data/queries';
import { isFinished, teamName } from '@/features/calendar/logic';
import { useMatchActions } from '@/features/home/useMatchActions';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate } from '@/utils/matchTime';

function InfoRow({ label, value }: { label: string; value: string | null }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const fixtures = useFixtures();
  const match = fixtures.data?.matches.find((m) => String(m.id) === id);
  const screenOptions = <Stack.Screen options={{ title: t('match.title') }} />;

  if (!match) {
    return (
      <Screen>
        {screenOptions}
        {fixtures.isPending ? <LoadingState /> : <EmptyState message={t('match.notFound')} />}
      </Screen>
    );
  }

  return (
    <>
      {screenOptions}
      <MatchDetailBody match={match} />
    </>
  );
}

function MatchDetailBody({ match }: { match: MatchT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { venue, time, title, remindable, reminded, toggleReminder, addToCalendar } =
    useMatchActions(match);

  const locale = i18n.language;
  const finished = isFinished(match);
  const referee = match.referee ?? null;
  const hasScore = match.score.home !== null && match.score.away !== null;
  const ht =
    match.score.halfTimeHome !== null && match.score.halfTimeAway !== null
      ? `${match.score.halfTimeHome}–${match.score.halfTimeAway}`
      : null;

  const side = (team: typeof match.home) => (
    <View style={styles.side}>
      <TeamCrest team={team} size={56} />
      <Text style={[styles.team, { color: colors.text }]}>{teamName(team)}</Text>
    </View>
  );

  return (
    <Screen>
      <Card>
        <View
          accessible
          accessibilityLabel={`${title}. ${hasScore ? `${match.score.home}–${match.score.away}` : ''}`}
          style={styles.board}
        >
          {side(match.home)}
          <Text style={[styles.score, { color: colors.text }]}>
            {hasScore ? `${match.score.home} – ${match.score.away}` : (time ?? 'vs')}
          </Text>
          {side(match.away)}
        </View>
        <BodyText muted>{t(`calendar.status.${match.status}`, { defaultValue: match.status })}</BodyText>
      </Card>

      <Card>
        <InfoRow label={t('match.date')} value={formatMatchDate(match.utcDate, match.status, locale, 'long')} />
        <InfoRow label={t('match.time')} value={time ?? t('calendar.timeTbc')} />
        <InfoRow label={t('match.matchday')} value={match.matchday !== null ? String(match.matchday) : null} />
        <InfoRow label={t('match.venue')} value={venue} />
        <InfoRow label={t('match.referee')} value={referee} />
        <InfoRow label={t('match.halfTime')} value={ht} />
      </Card>

      {!finished && (
        <Card>
          {remindable ? (
            <Button
              variant={reminded ? 'secondary' : 'primary'}
              label={t(reminded ? 'match.removeReminder' : 'match.remind')}
              onPress={() => void toggleReminder()}
            />
          ) : (
            <BodyText muted>{t('match.reminderNeedsTime')}</BodyText>
          )}
          <Button variant="secondary" label={t('match.addToCalendar')} onPress={() => void addToCalendar()} />
        </Card>
      )}

      <Card>
        <BodyText>{t('match.lineups')}</BodyText>
        <BodyText muted>{t('common.comingSoon')}</BodyText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  side: { flex: 1, alignItems: 'center', gap: spacing.sm },
  team: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  score: { fontSize: 28, fontWeight: '700' },
  infoRow: { gap: 2 },
});
