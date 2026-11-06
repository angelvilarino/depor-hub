import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchDetailT, MatchT } from '@/data/schemas';
import { useFixtures, useMatchDetail, useMatchSnapshot, useMeta } from '@/data/queries';
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
  const detail = useMatchDetail(season, id);
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
      <MatchDetailBody
        match={match}
        detail={detail.data ?? null}
        detailPending={detail.isFetching}
      />
    </>
  );
}

function MatchDetailBody({
  match,
  detail,
  detailPending,
}: {
  match: MatchT;
  detail: MatchDetailT | null;
  detailPending: boolean;
}) {
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

      {finished && detail ? <MatchDetailSections detail={detail} /> : null}

      {finished && !detail ? (
        <Card>
          <BodyText>{detailPending ? t('match.detailLoading') : t('match.detailUnavailable')}</BodyText>
          {!detailPending ? (
            <BodyText muted>{t('match.detailUnavailableHint')}</BodyText>
          ) : null}
          <BodyText muted>{t('match.dataSource')}</BodyText>
        </Card>
      ) : null}

      {live ? (
        <Card>
          <BodyText>{t('match.detailUnavailable')}</BodyText>
          <BodyText muted>{t('match.liveUnavailable')}</BodyText>
          <BodyText muted>{t('match.dataSource')}</BodyText>
        </Card>
      ) : null}
    </Screen>
  );
}

function MatchDetailSections({ detail }: { detail: MatchDetailT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sideName = (side: 'home' | 'away') =>
    side === 'home' ? detail.home.name : detail.away.name;
  const playerLabel = (player: MatchDetailT['lineups']['home']['starters'][number]) =>
    player.shirtNumber !== null ? `${player.shirtNumber} · ${player.name}` : player.name;

  const lineupBlock = (side: 'home' | 'away') => {
    const lineup = detail.lineups[side];
    return (
      <View key={side} style={styles.lineup}>
        <Text style={[styles.lineupTeam, { color: colors.text }]}>{sideName(side)}</Text>
        {lineup.coach ? (
          <Text style={[styles.metaLine, { color: colors.textMuted }]}>
            {t('match.coach')}: {lineup.coach}
          </Text>
        ) : null}
        {lineup.starters.length ? (
          <>
            <Text style={[styles.lineupLabel, { color: colors.textMuted }]}>
              {t('match.starters')}
            </Text>
            {lineup.starters.map((player, index) => (
              <Text key={`${side}-in-${index}`} style={[styles.playerLine, { color: colors.text }]}>
                {playerLabel(player)}
              </Text>
            ))}
          </>
        ) : null}
        {lineup.substitutes.length ? (
          <>
            <Text style={[styles.lineupLabel, { color: colors.textMuted }]}>
              {t('match.substitutes')}
            </Text>
            {lineup.substitutes.map((player, index) => (
              <Text key={`${side}-sub-${index}`} style={[styles.playerLine, { color: colors.text }]}>
                {playerLabel(player)}
              </Text>
            ))}
          </>
        ) : null}
      </View>
    );
  };

  const cardLabel = (kind: MatchDetailT['cards'][number]['kind']) =>
    kind === 'red'
      ? t('match.red')
      : kind === 'second_yellow'
        ? t('match.secondYellow')
        : t('match.yellow');

  const substitutionLabel = (sub: MatchDetailT['substitutions'][number]) => {
    if (sub.playerOut && sub.playerIn) return `${sub.playerOut} → ${sub.playerIn}`;
    if (sub.playerOut) return `${t('match.playerOut')}: ${sub.playerOut}`;
    return `${t('match.playerIn')}: ${sub.playerIn}`;
  };

  const hasEvents =
    detail.goals.length > 0 || detail.cards.length > 0 || detail.substitutions.length > 0;

  return (
    <>
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('match.lineups')}</Text>
        {lineupBlock('home')}
        {lineupBlock('away')}
      </Card>

      {detail.goals.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('match.goals')}</Text>
          {detail.goals.map((goal, index) => (
            <Text key={`goal-${index}`} style={[styles.eventLine, { color: colors.text }]}>
              <Text style={{ color: colors.textMuted }}>
                {goal.minuteLabel}&apos; · {sideName(goal.team)} ·{' '}
              </Text>
              {goal.player}
              {goal.penalty ? ` (${t('match.penalty')})` : ''}
              {goal.ownGoal ? ` (${t('match.ownGoal')})` : ''}
              {goal.scoreAfter ? ` · ${goal.scoreAfter.home}–${goal.scoreAfter.away}` : ''}
            </Text>
          ))}
        </Card>
      ) : null}

      {detail.cards.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('match.cards')}</Text>
          {detail.cards.map((card, index) => (
            <Text key={`card-${index}`} style={[styles.eventLine, { color: colors.text }]}>
              <Text style={{ color: colors.textMuted }}>
                {card.minuteLabel}&apos; · {sideName(card.team)} ·{' '}
              </Text>
              {card.player} ({cardLabel(card.kind)})
            </Text>
          ))}
        </Card>
      ) : null}

      {detail.substitutions.length ? (
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('match.substitutions')}
          </Text>
          {detail.substitutions.map((sub, index) => (
            <Text key={`sub-${index}`} style={[styles.eventLine, { color: colors.text }]}>
              <Text style={{ color: colors.textMuted }}>
                {sub.minuteLabel}&apos; · {sideName(sub.team)} ·{' '}
              </Text>
              {substitutionLabel(sub)}
            </Text>
          ))}
        </Card>
      ) : null}

      {hasEvents ? null : (
        <Card>
          <BodyText muted>{t('match.noEvents')}</BodyText>
        </Card>
      )}

      <Card>
        <BodyText muted>{t('match.detailSource')}</BodyText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  side: { flex: 1, alignItems: 'center', gap: spacing.sm },
  team: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  score: { fontSize: 28, fontWeight: '700' },
  infoRow: { gap: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  lineup: { gap: 2 },
  lineupTeam: { fontSize: 16, fontWeight: '700' },
  lineupLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: spacing.xs, textTransform: 'uppercase' },
  playerLine: { fontSize: 15 },
  metaLine: { fontSize: 14 },
  eventLine: { fontSize: 15, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
});
