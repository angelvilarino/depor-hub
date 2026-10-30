import { useLocalSearchParams, router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { CrestBadge, PaperCard, PosterCard, SectionHeader, StatTile } from '@/components/design/DesignSystem';
import { FormChips } from '@/components/home/FormChips';
import { HeadToHeadBar } from '@/components/rival/HeadToHeadBar';
import { useMeta, useRivals, useStandings } from '@/data/queries';
import type { HeadToHeadMeetingT, RivalT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import { openExternal } from '@/utils/openExternal';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function normalized(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isDeporName(value: string) {
  const name = normalized(value);
  return name === 'depor' || name.includes('rc deportivo') || (name.includes('deportivo') && name.includes('coruna'));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function MeetingCard({ meeting, rival, depor }: { meeting: HeadToHeadMeetingT; rival: RivalT['team']; depor: NonNullable<ReturnType<typeof useMeta>['data']>['team'] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const date = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${meeting.date}T12:00:00Z`));
  const homeTeam = isDeporName(meeting.home) ? depor : rival;
  const awayTeam = isDeporName(meeting.away) ? depor : rival;
  const resultColor = meeting.deporResult === 'W'
    ? colors.paper.accent
    : meeting.deporResult === 'L'
      ? colors.loss
      : colors.draw;
  const label = t('home.rival.meetingA11y', {
    date,
    competition: meeting.competition,
    home: meeting.home,
    homeGoals: meeting.homeGoals,
    awayGoals: meeting.awayGoals,
    away: meeting.away,
    result: t(`calendar.outcomeLong.${meeting.deporResult}`),
  });
  return (
    <View accessible accessibilityLabel={label} style={[styles.meeting, { borderColor: colors.paper.border }]}>
      <Text style={{ color: colors.paper.muted, fontSize: 12 }}>{date} · {meeting.competition}</Text>
      <View style={styles.meetingTeams}>
        <CrestBadge team={homeTeam} size={38} />
        <Text style={[styles.meetingScore, { color: colors.paper.text }]}>
          {meeting.homeGoals}–{meeting.awayGoals}
        </Text>
        <CrestBadge team={awayTeam} size={38} />
        <Text style={[styles.meetingResult, { color: resultColor }]}>
          {t(`calendar.outcome.${meeting.deporResult}`)}
        </Text>
      </View>
      <Text style={{ color: colors.paper.text, fontSize: 13 }}>
        {meeting.home} · {meeting.away}
      </Text>
    </View>
  );
}

export default function RivalScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ teamId?: string | string[] }>();
  const teamIdValue = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const teamId = Number(teamIdValue);
  const meta = useMeta();
  const rivals = useRivals();
  const standings = useStandings();
  const rival = useMemo(() => {
    if (!Number.isInteger(teamId) || !rivals.data) return null;
    return rivals.data.rivals.find((item) => item.team.id === teamId) ?? null;
  }, [rivals.data, teamId]);
  const row = standings.data?.table.find((entry) => entry.team.id === teamId) ?? null;
  const refresh = () => {
    void rivals.refetch();
    void standings.refetch();
  };

  if (rivals.isPending && !rival) {
    return <Screen><LoadingState /></Screen>;
  }
  if (rivals.isError && !rivals.data) {
    return <Screen><ErrorState onRetry={refresh} /></Screen>;
  }
  if (!rival || !meta.data) {
    return <Screen><EmptyState message={t('home.rival.missing')} actionLabel={t('common.back')} onAction={() => router.back()} /></Screen>;
  }

  const head = rival.headToHead;
  const form = row?.form?.split(/[^WDL]/).filter((value): value is 'W' | 'D' | 'L' => value === 'W' || value === 'D' || value === 'L') ?? [];
  const meetings = head?.meetings ?? [];
  const coachInitials = rival.coach ? initials(rival.coach) : '';

  return (
    <Screen refreshing={rivals.isRefetching || standings.isRefetching} onRefresh={refresh}>
      <PosterCard>
        <View style={styles.profileHeader}>
          <CrestBadge team={rival.team} size={90} />
          <View style={styles.profileCopy}>
            <Text accessibilityRole="header" style={[styles.name, { color: colors.poster.text }]}>
              {teamName(rival.team)}
            </Text>
            {row ? (
              <Text style={[styles.position, { color: colors.poster.accent }]}>
                {t('home.rival.position', { position: row.position, points: row.points })}
              </Text>
            ) : null}
          </View>
        </View>
        {form.length > 0 ? (
          <View style={styles.section}>
            <Text style={{ color: colors.poster.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{t('home.rival.form')}</Text>
            <FormChips results={form} variant="poster" />
          </View>
        ) : null}
      </PosterCard>

      {rival.coach ? (
        <PaperCard>
          <SectionHeader title={t('home.rival.coach')} subtitle={t('home.rival.coachSource')} />
          <View style={styles.coachRow}>
            <View style={[styles.coachMonogram, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>{coachInitials}</Text>
            </View>
            <Text style={[styles.coachName, { color: colors.paper.text }]}>{rival.coach}</Text>
          </View>
        </PaperCard>
      ) : null}

      {head ? (
        <PaperCard>
          <SectionHeader title={t('home.rival.headToHead')} subtitle={t('home.rival.headToHeadScope', { source: head.source })} />
          <View style={styles.stats}>
            <StatTile label={t('home.rival.matchesShort')} value={head.played} />
            <StatTile label={t('home.rival.goalsForShort')} value={head.goalsFor} />
            <StatTile label={t('home.rival.goalsAgainstShort')} value={head.goalsAgainst} />
          </View>
          <HeadToHeadBar head={head} />
          <Text style={{ color: colors.paper.muted, fontSize: 12 }}>
            {t('home.rival.confidence', { confidence: t(`common.confidenceLevel.${head.confidence}`) })}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('home.rival.openSource')}
            onPress={() => void openExternal(head.sourceUrl)}
            style={styles.sourceLink}
          >
            <Text style={{ color: colors.paper.accent, fontSize: 13, fontWeight: '700' }}>
              {t('home.rival.sourceLink')} ↗
            </Text>
          </Pressable>
        </PaperCard>
      ) : null}

      {meetings.length > 0 ? (
        <PaperCard>
          <SectionHeader title={t('home.rival.lastMeetings')} subtitle={t('home.rival.meetingsNote')} />
          <View style={styles.meetings}>
            {meetings.map((meeting) => (
              <MeetingCard key={`${meeting.date}-${meeting.home}-${meeting.away}`} meeting={meeting} rival={rival.team} depor={meta.data!.team} />
            ))}
          </View>
        </PaperCard>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  name: { fontFamily: typography.display, fontSize: 32, lineHeight: 38 },
  position: { fontFamily: typography.numeric, fontSize: 21 },
  section: { gap: spacing.xs },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  coachMonogram: { width: 48, height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  coachName: { fontFamily: typography.headline, fontSize: 20 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  sourceLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  meetings: { gap: spacing.sm },
  meeting: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: spacing.sm, gap: spacing.xs },
  meetingTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  meetingScore: { fontFamily: typography.numeric, fontSize: 28 },
  meetingResult: { fontWeight: '900', fontSize: 14, width: 22, textAlign: 'center' },
});
