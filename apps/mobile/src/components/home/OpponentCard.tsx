import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { TeamCrest } from '@/components/TeamCrest';
import { FormChips } from '@/components/home/FormChips';
import type { HeadToHeadT, RivalT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import type { FormResult, OpponentInfo } from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function parseForm(value: string | null): FormResult[] {
  if (!value) return [];
  return value.split(/[^WDL]/).filter((part): part is FormResult => part === 'W' || part === 'D' || part === 'L');
}

function meetingDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function Meeting({ meeting, locale }: { meeting: HeadToHeadT['meetings'][number]; locale: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const color =
    meeting.deporResult === 'W'
      ? colors.win
      : meeting.deporResult === 'L'
        ? colors.loss
        : colors.draw;
  return (
    <View
      accessible
      accessibilityLabel={`${meetingDate(meeting.date, locale)}, ${meeting.competition}, ${meeting.home} ${meeting.homeGoals}–${meeting.awayGoals} ${meeting.away}, ${t(`calendar.outcomeLong.${meeting.deporResult}`)}`}
      style={styles.meeting}
    >
      <Text style={{ color: colors.textMuted, fontSize: 12, width: 84 }}>
        {meetingDate(meeting.date, locale)}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, flex: 1 }}>
        {meeting.home} {meeting.homeGoals}–{meeting.awayGoals} {meeting.away}
      </Text>
      <Text
        accessibilityLabel={t(`calendar.outcomeLong.${meeting.deporResult}`)}
        style={{ color, fontSize: 14, fontWeight: '700', width: 18, textAlign: 'center' }}
      >
        {t(`calendar.outcome.${meeting.deporResult}`)}
      </Text>
    </View>
  );
}

export function OpponentCard({ info, rival }: { info: OpponentInfo; rival: RivalT | null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const tableLine = info.row
    ? t('home.rival.position', { position: info.row.position, points: info.row.points })
    : null;
  const balanceLine = info.balance
    ? t('home.rival.seasonBalance', {
        played: info.balance.played,
        won: info.balance.won,
        drawn: info.balance.drawn,
        lost: info.balance.lost,
        goalsFor: info.balance.goalsFor,
        goalsAgainst: info.balance.goalsAgainst,
      })
    : null;
  const form = parseForm(info.row?.form ?? null);
  const head = rival?.headToHead ?? null;

  return (
    <Card>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.opponent')}
        </Text>
        <View style={styles.teamRow}>
          <TeamCrest team={info.opponent} size={32} />
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: '700', flexShrink: 1 }}>
            {teamName(info.opponent)}
          </Text>
        </View>
      </View>

      {tableLine ? (
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{tableLine}</Text>
      ) : null}

      {form.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('home.rival.form')}</Text>
          <FormChips results={form} />
        </View>
      ) : null}

      {balanceLine ? (
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{balanceLine}</Text>
      ) : null}

      {rival?.coach ? (
        <View style={styles.lineRow}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('home.rival.coach')}</Text>
          <Text style={{ color: colors.text, fontSize: 15 }}>{rival.coach}</Text>
        </View>
      ) : null}

      {rival && rival.keyPlayers.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('home.rival.keyPlayers')}</Text>
          {rival.keyPlayers.map((player) => (
            <Text key={player.id} style={{ color: colors.text, fontSize: 14 }}>
              {player.name} · {t('home.rival.goals', { count: player.goals })}
            </Text>
          ))}
        </View>
      ) : null}

      {head ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('home.rival.headToHead')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {t('home.rival.headToHeadScope', { source: head.source })}
          </Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
            {t('home.rival.headToHeadRecord', {
              played: head.played,
              won: head.won,
              drawn: head.drawn,
              lost: head.lost,
              goalsFor: head.goalsFor,
              goalsAgainst: head.goalsAgainst,
            })}
          </Text>
          {head.meetings.length > 0 ? (
            <View style={styles.meetings}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('home.rival.lastMeetings')}</Text>
              {head.meetings.map((meeting) => (
                <Meeting
                  key={`${meeting.date}-${meeting.home}-${meeting.away}`}
                  meeting={meeting}
                  locale={i18n.language}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  block: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  lineRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  meetings: { gap: 2, marginTop: spacing.xs },
  meeting: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
});
