import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { PosterCard, SectionHeader } from '@/components/design/DesignSystem';
import { TeamCrest } from '@/components/TeamCrest';
import { Countdown } from '@/components/home/Countdown';
import { WeatherLine } from '@/components/home/WeatherLine';
import type { MatchT, TeamRefT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import { ReminderSheet } from '@/features/reminders/ReminderSheet';
import { matchPhase, utcDayDiff } from '@/features/home/logic';
import { competitionLabel } from '@/features/home/text';
import { useMatchActions } from '@/features/home/useMatchActions';
import { useNow } from '@/features/home/useNow';
import { useWeather } from '@/features/home/useWeather';
import { motion, minTouch, radius, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDateShort } from '@/utils/matchTime';

function TeamSide({ team, side }: { team: TeamRefT; side: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.side}>
      <View style={styles.crestBox}>
        <TeamCrest team={team} size={72} />
      </View>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}
        style={[styles.teamName, { color: colors.poster.text }]}
      >
        {teamName(team)}
      </Text>
      <Text style={[styles.sideLabel, { color: colors.poster.muted }]}>{side}</Text>
    </View>
  );
}

function LiveBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: motion.standard, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: motion.standard, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);
  return (
    <View accessible accessibilityLabel={label} style={[styles.liveBadge, { borderColor: colors.poster.text }]}>
      <Animated.View style={[styles.liveDot, { backgroundColor: colors.poster.accent, opacity }]} />
      <Text style={{ color: colors.poster.text, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function NextMatchCard({
  match,
  competitionCode,
  competitionName,
  postponed,
}: {
  match: MatchT;
  competitionCode: string | null;
  competitionName: string | null;
  postponed: MatchT | null;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expiredTarget, setExpiredTarget] = useState<number | null>(null);
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
    calendarStatus,
    openSystemSettings,
  } = useMatchActions(match);
  const target = Date.parse(match.utcDate);
  const now = useNow(60_000);
  const phase = matchPhase(match, now);
  const visiblePhase = expiredTarget === target && phase === 'upcoming' ? 'awaiting_result' : phase;
  const weather = useWeather(match, now);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const status = t(`calendar.status.${match.status}`, { defaultValue: match.status });
  const date = formatMatchDateShort(match.utcDate, match.status, i18n.language);
  const timeLabel = time ?? t('calendar.timeTbc');
  const daysUntil = utcDayDiff(match.utcDate, now);
  const homeSide = match.deporIsHome ? t('home.local') : t('home.away');
  const awaySide = match.deporIsHome ? t('home.away') : t('home.local');
  const competition = competitionLabel(competitionCode, competitionName, t);
  const competitionLine = match.matchday !== null
    ? `${t('calendar.matchday', { n: match.matchday })}${competition ? ` · ${competition}` : ''}`
    : competition;
  const summary = [
    t('home.nextMatch'), competitionLine,
    `${teamName(match.home)} ${t('calendar.versus')} ${teamName(match.away)}`,
    visiblePhase === 'live' && hasScore ? `${match.score.home}–${match.score.away}` : status,
    date, timeLabel, venue,
  ].filter(Boolean).join('. ');
  const calendarLabel = calendarStatus === 'saved'
    ? t('match.calendarSaved')
    : calendarStatus === 'shared'
      ? t('match.calendarShared')
      : t('match.addToCalendar');

  return (
    <PosterCard>
      <SectionHeader title={t('home.nextMatch')} subtitle={competitionLine ?? undefined} variant="poster" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        onPress={() => router.push(`/match/${match.id}`)}
        style={styles.openArea}
      >
        <View style={styles.teamsRow}>
          <TeamSide team={match.home} side={homeSide} />
          <View style={styles.vsBox}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.vs, { color: colors.poster.accent }]}>
              {t('calendar.versus').toUpperCase()}
            </Text>
          </View>
          <TeamSide team={match.away} side={awaySide} />
        </View>

        {visiblePhase === 'live' ? (
          <View style={styles.stateBlock}>
            <LiveBadge label={t('home.liveNow')} />
            <Text maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier} style={[styles.heroScore, { color: colors.poster.text }]}>
              {hasScore ? `${match.score.home} – ${match.score.away}` : status}
            </Text>
          </View>
        ) : visiblePhase === 'upcoming' ? (
          <Countdown targetMs={target} onExpire={() => setExpiredTarget(target)} />
        ) : visiblePhase === 'tbc' ? (
          <View style={styles.tbc}>
            <Text style={[styles.tbcDays, { color: colors.poster.text }]}>
              {daysUntil <= 0 ? t('home.matchToday') : t('home.daysUntil', { count: daysUntil })}
            </Text>
            <Text style={{ color: colors.poster.muted, fontSize: 14 }}>{t('calendar.timeTbc')}</Text>
          </View>
        ) : visiblePhase === 'awaiting_result' ? (
          <Text style={[styles.stateText, { color: colors.poster.text }]}>{t('home.awaitingResult')}</Text>
        ) : (
          <Text style={[styles.stateText, { color: colors.poster.text }]}>
            {t(`home.phase.${visiblePhase}`, { defaultValue: status })}
          </Text>
        )}

        <Text style={[styles.dateLine, { color: colors.poster.text }]}>
          {date.toLocaleUpperCase(i18n.language)} · {timeLabel}
        </Text>
      </Pressable>

      {venue ? <Text style={[styles.venue, { color: colors.poster.muted }]}>{venue}</Text> : null}

      {postponed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/match/${postponed.id}`)}
          style={[styles.postponed, { borderColor: colors.poster.muted }]}
        >
          <Text style={{ color: colors.poster.text, fontSize: 13 }}>
            {t('home.postponedNotice', {
              teams: `${teamName(postponed.home)} – ${teamName(postponed.away)}`,
              date: formatMatchDateShort(postponed.utcDate, postponed.status, i18n.language),
            })}
          </Text>
        </Pressable>
      ) : null}

      {weather.data ? (
        <WeatherLine
          weather={weather.data}
          capturedAt={weather.dataUpdatedAt}
          offline={weather.isError}
          now={now}
        />
      ) : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          {remindable ? (
            <Button
              variant={reminded ? 'secondary' : 'primary'}
              label={reminded ? t('reminder.active', { offsets: reminderSummary }) : t('match.remind')}
              onPress={() => setSheetOpen(true)}
            />
          ) : (
            <Text style={{ color: colors.poster.muted, fontSize: 13, textAlign: 'center' }}>
              {t('match.reminderNeedsTime')}
            </Text>
          )}
        </View>
        <View style={styles.action}>
          <Button variant="secondary" label={calendarLabel} onPress={() => void addToCalendar()} />
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
    </PosterCard>
  );
}

const styles = StyleSheet.create({
  openArea: { gap: spacing.md, minHeight: minTouch },
  teamsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xs },
  crestBox: { minHeight: 76, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontFamily: typography.display, fontSize: 23, lineHeight: 26, textAlign: 'center' },
  sideLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  vsBox: { width: 50, minHeight: 76, alignItems: 'center', justifyContent: 'center' },
  vs: { fontFamily: typography.display, fontSize: 18 },
  stateBlock: { alignItems: 'center', gap: spacing.sm },
  heroScore: { fontFamily: typography.numeric, fontSize: 44, lineHeight: 50 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 30 },
  liveDot: { width: 8, height: 8, borderRadius: radius.pill },
  tbc: { alignItems: 'center', gap: spacing.xs },
  tbcDays: { fontFamily: typography.display, fontSize: 27 },
  stateText: { fontFamily: typography.headline, fontSize: 21, textAlign: 'center' },
  dateLine: { fontFamily: typography.display, fontSize: 22, lineHeight: 27, textAlign: 'center', letterSpacing: 0.6 },
  venue: { fontSize: 14, textAlign: 'center' },
  postponed: { minHeight: minTouch, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: spacing.sm, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, minWidth: 0, justifyContent: 'center', minHeight: minTouch },
});
