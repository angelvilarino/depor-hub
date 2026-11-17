import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { PaperCard } from '@/components/design/DesignSystem';
import { MatchLineups } from '@/components/match/MatchLineups';
import { MatchScoreboard } from '@/components/match/MatchScoreboard';
import { MatchTimeline } from '@/components/match/MatchTimeline';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import type { MatchDetailT, MatchT } from '@/data/schemas';
import { useFixtures, useMatchDetail, useMatchSnapshot, useMeta } from '@/data/queries';
import { competitionLabel } from '@/features/home/text';
import { matchPhase } from '@/features/home/logic';
import { snapshotToMatch } from '@/features/match/snapshot';
import { useMatchActions } from '@/features/home/useMatchActions';
import { useNow } from '@/features/home/useNow';
import { ReminderSheet } from '@/features/reminders/ReminderSheet';
import { spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const fixtures = useFixtures();
  const meta = useMeta();
  const season = fixtures.data?.season ?? meta.data?.season ?? null;
  const snapshot = useMatchSnapshot(season, id);
  const detail = useMatchDetail(season, id);
  const match =
    fixtures.data?.matches.find((m) => String(m.id) === id) ??
    (snapshot.data ? snapshotToMatch(snapshot.data) : undefined);
  const waiting = !match && (fixtures.isPending || (season !== null && snapshot.isPending));
  // F3-22: un fallo de red no es un partido inexistente; se ofrece reintentar.
  const failed =
    !match && (fixtures.isError || (season !== null && snapshot.isError));
  const screenOptions = <Stack.Screen options={{ title: t('match.title') }} />;

  if (!match) {
    return (
      <Screen>
        {screenOptions}
        {waiting ? (
          <LoadingState />
        ) : failed ? (
          <ErrorState
            onRetry={() => {
              void fixtures.refetch();
              if (season !== null) void snapshot.refetch();
            }}
          />
        ) : (
          <EmptyState message={t('match.notFound')} />
        )}
      </Screen>
    );
  }

  return (
    <>
      {screenOptions}
      <MatchDetailBody
        match={match}
        competitionName={competitionLabel(
          meta.data?.competitionCode,
          meta.data?.competitionName,
          t,
        )}
        detail={detail.data ?? null}
        detailPending={detail.isFetching}
      />
    </>
  );
}

function MatchDetailBody({
  match,
  competitionName,
  detail,
  detailPending,
}: {
  match: MatchT;
  competitionName: string | null;
  detail: MatchDetailT | null;
  detailPending: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const {
    venue,
    time,
    remindable,
    reminded,
    reminderOffsets,
    reminderSummary,
    remindersEnabled,
    setRemindersEnabled,
    saveReminder,
    removeReminder,
    addToCalendar,
    requestExactAlarm,
    openSystemSettings,
  } = useMatchActions(match);

  const now = useNow(60_000);
  const phase = matchPhase(match, now);
  const live = phase === 'live';
  const finished = phase === 'finished';
  const canPlan = phase === 'upcoming' || phase === 'tbc';
  const referee = match.referee ?? null;
  const statusLabel = live
    ? t('match.liveNow')
    : finished
      ? t('match.finished')
      : phase === 'awaiting_result'
        ? t('home.awaitingResult')
        : t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const hasMeta = Boolean(venue || referee);

  return (
    <Screen>
      <MatchScoreboard
        match={match}
        competitionName={competitionName}
        time={time}
        statusLabel={statusLabel}
        live={live}
      />

      {hasMeta ? (
        <PaperCard>
          {venue ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={18} color={colors.paper.muted} />
              <Text style={{ color: colors.paper.text, flex: 1, ...text.body }}>{venue}</Text>
            </View>
          ) : null}
          {referee ? (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={18} color={colors.paper.muted} />
              <Text style={{ color: colors.paper.text, flex: 1, ...text.body }}>{referee}</Text>
            </View>
          ) : null}
        </PaperCard>
      ) : null}

      {canPlan ? (
        <PaperCard>
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
            <Text style={{ color: colors.paper.muted, ...text.body }}>
              {t('match.reminderNeedsTime')}
            </Text>
          )}
          <Button
            variant="secondary"
            label={t('match.addToCalendar')}
            onPress={() => void addToCalendar()}
          />
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
              onRequestExactAlarm={requestExactAlarm}
              onEnableReminders={() => setRemindersEnabled(true)}
              onOpenSettings={openSystemSettings}
            />
          ) : null}
        </PaperCard>
      ) : null}

      {finished && detail ? (
        <>
          <MatchLineups match={match} detail={detail} />
          <MatchTimeline match={match} detail={detail} />
        </>
      ) : null}

      {finished && !detail ? (
        detailPending ? (
          <PaperCard>
            <Text style={{ color: colors.paper.muted, ...text.body }}>
              {t('match.detailLoading')}
            </Text>
          </PaperCard>
        ) : (
          <EmptyState message={t('match.detailUnavailable')} />
        )
      ) : null}

      {live ? <EmptyState message={t('match.liveNoEvents')} /> : null}

      <View style={styles.sources}>
        <Text style={{ color: colors.textMuted, ...text.caption }}>{t('match.dataSource')}</Text>
        {detail ? (
          <Text style={{ color: colors.textMuted, ...text.caption }}>
            {t('match.detailSource')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sources: { gap: spacing.xs, paddingTop: spacing.sm },
});
