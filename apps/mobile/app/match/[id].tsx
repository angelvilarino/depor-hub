import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TeamCrest } from '@/components/TeamCrest';
import { useFixtures, useMeta } from '@/data/queries';
import { isFinished, teamName } from '@/features/calendar/logic';
import { addMatchToCalendar } from '@/features/calendar/system';
import { ensureReminderPermission } from '@/features/reminders/notifications';
import { isRemindable } from '@/features/reminders/plan';
import { useSettings } from '@/store/settings';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate, formatMatchTime } from '@/utils/matchTime';

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
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const fixtures = useFixtures();
  const meta = useMeta();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const { remindMatchIds, remindersEnabled, toggleRemind, setRemindersEnabled } = useSettings();
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

  const locale = i18n.language;
  const finished = isFinished(match);
  const time = formatMatchTime(match.utcDate, match.status, locale);
  // `?? null`: la caché persistida anterior al ADR 0006 puede no traer estos campos.
  const venue = match.venue ?? (match.deporIsHome ? (meta.data?.team.venue ?? null) : null);
  const referee = match.referee ?? null;
  const hasScore = match.score.home !== null && match.score.away !== null;
  const remindable = isRemindable(match, now);
  const reminded = remindersEnabled && remindMatchIds.includes(match.id);
  const title = `${teamName(match.home)} – ${teamName(match.away)}`;
  const ht =
    match.score.halfTimeHome !== null && match.score.halfTimeAway !== null
      ? `${match.score.halfTimeHome}–${match.score.halfTimeAway}`
      : null;

  const onRemind = async () => {
    if (reminded) {
      toggleRemind(match.id, false);
      return;
    }
    if (!(await ensureReminderPermission())) {
      Alert.alert(t('match.permissionDenied'));
      return;
    }
    if (!remindersEnabled) setRemindersEnabled(true);
    toggleRemind(match.id, true);
  };

  const onAddToCalendar = async () => {
    try {
      await addMatchToCalendar(match, {
        title,
        venue,
        notes: time ? undefined : t('calendar.timeTbc'),
      });
    } catch {
      Alert.alert(t('match.addError'));
    }
  };

  const side = (team: typeof match.home) => (
    <View style={styles.side}>
      <TeamCrest team={team} size={56} />
      <Text style={[styles.team, { color: colors.text }]}>{teamName(team)}</Text>
    </View>
  );

  return (
    <Screen>
      {screenOptions}
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
              onPress={() => void onRemind()}
            />
          ) : (
            <BodyText muted>{t('match.reminderNeedsTime')}</BodyText>
          )}
          <Button variant="secondary" label={t('match.addToCalendar')} onPress={() => void onAddToCalendar()} />
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
