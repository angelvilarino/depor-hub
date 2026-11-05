import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchT } from '@/data/schemas';
import { useFixtures, useMatchSnapshot, useMeta } from '@/data/queries';
import { teamName } from '@/features/calendar/logic';
import { matchPhase } from '@/features/home/logic';
import { snapshotToMatch } from '@/features/match/snapshot';
import { useMatchActions } from '@/features/home/useMatchActions';
import { useNow } from '@/features/home/useNow';
import { ReminderSheet } from '@/features/reminders/ReminderSheet';
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
  const meta = useMeta();
  const season = fixtures.data?.season ?? meta.data?.season ?? null;
  const snapshot = useMatchSnapshot(season, id);
  const match =
    fixtures.data?.matches.find((m) => String(m.id) === id) ??
    (snapshot.data ? snapshotToMatch(snapshot.data) : undefined);
  const waiting = !match && (fixtures.isPending || (season !== null && snapshot.isPending));
  const screenOptions = <Stack.Screen options={{ title: t('match.title') }} />;

  if (!match) {
    return (
      <Screen>
        {screenOptions}
        {waiting ? <LoadingState /> : <EmptyState message={t('match.notFound')} />}
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    venue,
    time,
    title,
    remindable,
    reminded,
    reminderOffsets,
    reminderSummary,
    remindersEnabled,
    setRemindersEnabled,
    saveReminder,
    removeReminder,
    addToCalendar,
    openSystemSettings,
  } = useMatchActions(match);

  const locale = i18n.language;
  const now = useNow(60_000);
  const phase = matchPhase(match, now);
  const live = phase === 'live';
  const finished = phase === 'finished';
  const canPlan = phase === 'upcoming' || phase === 'tbc';
  const referee = match.referee ?? null;
  const hasScore = match.score.home !== null && match.score.away !== null;
  const ht =
    match.score.halfTimeHome !== null && match.score.halfTimeAway !== null
      ? `${match.score.halfTimeHome}–${match.score.halfTimeAway}`
      : null;
  const statusLabel = live
    ? t('match.liveNow')
    : finished
      ? t('match.finished')
      : phase === 'awaiting_result'
        ? t('home.awaitingResult')
        : t(`calendar.status.${match.status}`, { defaultValue: match.status });

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
        <View style={styles.statusRow}>
          {live ? <View style={[styles.liveDot, { backgroundColor: colors.danger }]} /> : null}
          <Text
            style={{
              color: live ? colors.danger : colors.textMuted,
              fontSize: 14,
              fontWeight: live ? '800' : '400',
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </Card>

      <Card>
        <InfoRow label={t('match.date')} value={formatMatchDate(match.utcDate, match.status, locale, 'long')} />
        <InfoRow label={t('match.time')} value={time ?? t('calendar.timeTbc')} />
        <InfoRow label={t('match.matchday')} value={match.matchday !== null ? String(match.matchday) : null} />
        <InfoRow label={t('match.venue')} value={venue} />
        <InfoRow label={t('match.referee')} value={referee} />
        <InfoRow label={t('match.halfTime')} value={ht} />
      </Card>

      {canPlan ? (
        <Card>
          {remindable ? (
            <Button
              variant={reminded ? 'secondary' : 'primary'}
              label={
                reminded
                  ? t('reminder.active', { offsets: reminderSummary })
                  : t('match.remind')
              }
              onPress={() => setSheetOpen(true)}
            />
          ) : (
            <BodyText muted>{t('match.reminderNeedsTime')}</BodyText>
          )}
          <Button variant="secondary" label={t('match.addToCalendar')} onPress={() => void addToCalendar()} />
          {sheetOpen ? (
            <ReminderSheet
              visible
              onClose={() => setSheetOpen(false)}
              match={match}
              initialOffsets={reminderOffsets}
              reminded={reminded}
              remindable={remindable}
              remindersEnabled={remindersEnabled}
              onSave={saveReminder}
              onRemove={removeReminder}
              onEnableReminders={() => setRemindersEnabled(true)}
              onOpenSettings={openSystemSettings}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <BodyText>{t('match.detailUnavailable')}</BodyText>
        <BodyText muted>
          {live ? t('match.liveUnavailable') : t('match.detailUnavailableHint')}
        </BodyText>
        <BodyText muted>{t('match.dataSource')}</BodyText>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
});
