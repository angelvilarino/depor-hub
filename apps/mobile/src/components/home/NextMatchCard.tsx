import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchT, TeamRefT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import { ReminderSheet } from '@/features/reminders/ReminderSheet';
import {
  hasCountdown,
  isLive,
  showsSeconds,
  utcDayDiff,
  type CountdownParts,
} from '@/features/home/logic';
import { competitionLabel } from '@/features/home/text';
import { useCountdown } from '@/features/home/useCountdown';
import { useMatchActions } from '@/features/home/useMatchActions';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDateShort } from '@/utils/matchTime';

function TeamSide({ team, side }: { team: TeamRefT; side: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.side}>
      <View style={styles.crestBox}>
        <TeamCrest team={team} size={56} />
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[styles.teamName, { color: colors.text }]}
      >
        {teamName(team)}
      </Text>
      <Text style={[styles.sideLabel, { color: colors.textMuted }]}>{side}</Text>
    </View>
  );
}

function Countdown({ parts, withSeconds }: { parts: CountdownParts; withSeconds: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (parts.expired) return null;
  const units: string[] = [];
  if (parts.days > 0) units.push(t('home.countdown.days', { n: parts.days }));
  if (parts.days > 0 || parts.hours > 0) {
    units.push(t('home.countdown.hours', { n: parts.hours }));
  }
  units.push(t('home.countdown.minutes', { n: parts.minutes }));
  if (withSeconds) units.push(t('home.countdown.seconds', { n: parts.seconds }));
  return (
    <Text
      accessibilityLiveRegion="none"
      accessibilityLabel={t(withSeconds ? 'home.countdown.labelWithSeconds' : 'home.countdown.label', {
        days: parts.days,
        hours: parts.hours,
        minutes: parts.minutes,
        seconds: parts.seconds,
      })}
      style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}
    >
      {units.join(' ')}
    </Text>
  );
}

export function NextMatchCard({
  match,
  competitionCode,
  competitionName,
}: {
  match: MatchT;
  competitionCode: string | null;
  competitionName: string | null;
}) {
  const { t, i18n } = useTranslation();
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
    openSystemSettings,
  } = useMatchActions(match);
  const target = Date.parse(match.utcDate);
  const timed = hasCountdown(match);
  const countdown = useCountdown(target, timed, timed);
  const live = isLive(match);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const status = t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const date = formatMatchDateShort(match.utcDate, match.status, i18n.language);
  const timeLabel = time ?? t('calendar.timeTbc');
  const daysUntil = utcDayDiff(match.utcDate, countdown.nowMs);
  const homeSide = match.deporIsHome ? t('home.local') : t('home.away');
  const awaySide = match.deporIsHome ? t('home.away') : t('home.local');
  const competition = competitionLabel(competitionCode, competitionName, t);
  const competitionLine = match.matchday !== null
    ? `${t('calendar.matchday', { n: match.matchday })}${competition ? ` · ${competition}` : ''}`
    : competition;
  const summary = [
    t('home.nextMatch'),
    competitionLine,
    `${teamName(match.home)} ${t('calendar.versus')} ${teamName(match.away)}`,
    live && hasScore ? `${match.score.home}–${match.score.away}` : status,
    date,
    timeLabel,
    venue,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}
        >
          {t('home.nextMatch')}
        </Text>
        {competitionLine ? (
          <Text numberOfLines={1} style={[styles.competition, { color: colors.textMuted }]}>
            {competitionLine}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.openArea}
      >
        <View style={styles.teamsRow}>
          <TeamSide team={match.home} side={homeSide} />
          <View style={styles.vsBox}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>
              {t('calendar.versus')}
            </Text>
          </View>
          <TeamSide team={match.away} side={awaySide} />
        </View>

        {live ? (
          <View style={styles.liveRow}>
            <Text style={{ color: colors.danger, fontSize: 24, fontWeight: '700' }}>
              {hasScore ? `${match.score.home} – ${match.score.away}` : status}
            </Text>
            <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>{status}</Text>
          </View>
        ) : hasCountdown(match) ? (
          <Countdown parts={countdown} withSeconds={showsSeconds(target, countdown.nowMs)} />
        ) : match.status === 'SCHEDULED' ? (
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>
            {daysUntil <= 0 ? t('home.matchToday') : t('home.daysUntil', { count: daysUntil })}
          </Text>
        ) : (
          <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '700' }}>{status}</Text>
        )}

        <Text style={[styles.dateLine, { color: colors.text }]}>
          {date} · {timeLabel}
        </Text>
      </Pressable>

      {venue ? (
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 14 }}>
          {venue}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
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
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t('match.reminderNeedsTime')}
            </Text>
          )}
        </View>
        <View style={styles.action}>
          <Button
            variant="secondary"
            label={t('match.addToCalendar')}
            onPress={() => void addToCalendar()}
          />
        </View>
      </View>

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
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  competition: { flexShrink: 1, fontSize: 14, textAlign: 'right' },
  openArea: { gap: spacing.sm, minHeight: minTouch },
  teamsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  crestBox: { height: 60, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  sideLabel: { fontSize: 12, fontWeight: '700' },
  vsBox: { width: 44, height: 60, alignItems: 'center', justifyContent: 'center' },
  liveRow: { alignItems: 'center', gap: 2 },
  dateLine: { fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
