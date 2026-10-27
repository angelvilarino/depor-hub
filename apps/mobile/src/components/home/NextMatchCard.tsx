import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchT, TeamRefT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import {
  hasCountdown,
  isLive,
  showsSeconds,
  utcDayDiff,
  type CountdownParts,
} from '@/features/home/logic';
import { openVenueInMaps } from '@/features/home/maps';
import { useCountdown } from '@/features/home/useCountdown';
import { useMatchActions } from '@/features/home/useMatchActions';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate } from '@/utils/matchTime';

function TeamSide({ team, side }: { team: TeamRefT; side: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.side}>
      <TeamCrest team={team} size={52} />
      <Text numberOfLines={2} style={[styles.teamName, { color: colors.text }]}>
        {teamName(team)}
      </Text>
      {side ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{side}</Text>
      ) : null}
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
  competitionName,
}: {
  match: MatchT;
  competitionName: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { venue, time, remindable, reminded, toggleReminder, addToCalendar } =
    useMatchActions(match);
  const target = Date.parse(match.utcDate);
  const timed = hasCountdown(match);
  const countdown = useCountdown(target, timed, timed);
  const live = isLive(match);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const status = t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const date = formatMatchDate(match.utcDate, match.status, i18n.language, 'long');
  const timeLabel = time ?? t('calendar.timeTbc');
  const daysUntil = utcDayDiff(match.utcDate, countdown.nowMs);
  const side = match.deporIsHome ? t('home.local') : t('home.away');
  const summary = [
    t('home.nextMatch'),
    `${teamName(match.home)} ${t('calendar.versus')} ${teamName(match.away)}`,
    live && hasScore ? `${match.score.home}–${match.score.away}` : status,
    date,
    timeLabel ?? t('calendar.timeTbc'),
    venue,
  ]
    .filter(Boolean)
    .join('. ');

  const onMap = async () => {
    if (!venue) return;
    try {
      await openVenueInMaps(venue);
    } catch {
      Alert.alert(t('home.mapError'));
    }
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.nextMatch')}
        </Text>
        {match.matchday !== null ? (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>
            {t('calendar.matchday', { n: match.matchday })}
          </Text>
        ) : null}
      </View>
      {competitionName ? (
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{competitionName}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.openArea}
      >
        <View style={styles.teamsRow}>
          <TeamSide team={match.home} side={match.deporIsHome ? side : null} />
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>
            {t('calendar.versus')}
          </Text>
          <TeamSide team={match.away} side={match.deporIsHome ? null : side} />
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

        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{date}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 15 }}>
          {timeLabel ?? t('calendar.timeTbc')}
        </Text>
      </Pressable>

      {venue ? (
        <View style={styles.venueRow}>
          <Text style={{ flex: 1, color: colors.textMuted, fontSize: 14 }}>{venue}</Text>
          <Button label={t('home.howToGetThere')} onPress={() => void onMap()} />
        </View>
      ) : null}

      <View style={styles.actions}>
        {remindable ? (
          <Button
            variant={reminded ? 'secondary' : 'primary'}
            label={t(reminded ? 'match.removeReminder' : 'match.remind')}
            onPress={() => void toggleReminder()}
          />
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('match.reminderNeedsTime')}</Text>
        )}
        <Button
          variant="secondary"
          label={t('match.addToCalendar')}
          onPress={() => void addToCalendar()}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  openArea: { gap: spacing.sm, minHeight: minTouch },
  teamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  teamName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  liveRow: { alignItems: 'center', gap: 2 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { gap: spacing.sm },
});
