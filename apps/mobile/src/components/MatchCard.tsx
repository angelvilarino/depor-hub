import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import type { MatchT } from '@/data/schemas';
import { TeamCrest } from '@/components/TeamCrest';
import { outcome, teamName } from '@/features/calendar/logic';
import { minTouch, radius, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDate, formatMatchTime } from '@/utils/matchTime';

const PLAIN = new Set(['SCHEDULED', 'TIMED', 'FINISHED']);

type Props = {
  match: MatchT;
  competitionName?: string | null;
  /** D-10: el próximo partido se distingue del resto de la lista. */
  highlight?: boolean;
};

export function MatchCard({ match, competitionName = null, highlight = false }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const time = formatMatchTime(match.utcDate, match.status, i18n.language);
  const date = formatMatchDate(match.utcDate, match.status, i18n.language);
  const out = outcome(match);
  const hasScore = match.score.home !== null && match.score.away !== null;
  const rows = [
    { team: match.home, goals: match.score.home, depor: match.deporIsHome },
    { team: match.away, goals: match.score.away, depor: !match.deporIsHome },
  ];
  const outColor = out === 'W' ? colors.primary : out === 'L' ? colors.danger : colors.textMuted;
  const summary = hasScore ? `${match.score.home}–${match.score.away}` : (time ?? t('calendar.timeTbc'));
  const meta = [
    match.matchday !== null ? t('calendar.matchday', { n: match.matchday }) : null,
    competitionName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[date, meta, `${teamName(match.home)} ${t('calendar.versus')} ${teamName(match.away)}`, summary]
        .filter(Boolean)
        .join('. ')}
      onPress={() => router.push(`/match/${match.id}`)}
      style={[
        styles.card,
        highlight
          ? { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {highlight ? (
        <View style={styles.nextRow}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, ...text.caption, fontWeight: '800', letterSpacing: 0.8 }}>
            {t('calendar.next')}
            {time ? ` · ${time}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.top}>
        {meta ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted, flex: 1, ...text.caption }}>
            {meta}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text style={{ color: colors.textMuted, ...text.caption }}>{date}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.teams}>
          {rows.map((r, i) => (
            <View key={i} style={styles.teamRow}>
              <TeamCrest team={r.team} size={24} />
              <Text
                numberOfLines={1}
                style={{
                  color: colors.text,
                  flex: 1,
                  ...text.bodyLarge,
                  fontWeight: r.depor ? '700' : '400',
                }}
              >
                {teamName(r.team)}
              </Text>
              {hasScore ? (
                <Text
                  style={{
                    color: colors.text,
                    ...text.bodyLarge,
                    fontWeight: r.depor ? '700' : '400',
                  }}
                >
                  {r.goals}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.accessory}>
          {out ? (
            <View
              accessible
              accessibilityLabel={t(`calendar.outcomeLong.${out}`)}
              style={[styles.outcome, { borderColor: outColor }]}
            >
              <Text style={{ color: outColor, ...text.body, fontWeight: '800' }}>
                {t(`calendar.outcome.${out}`)}
              </Text>
            </View>
          ) : highlight ? null : (
            <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>
              {time ?? t('calendar.timeTbc')}
            </Text>
          )}
        </View>
      </View>

      {!PLAIN.has(match.status) ? (
        <Text style={{ color: colors.danger, ...text.caption, fontWeight: '700' }}>
          {t(`calendar.status.${match.status}`, { defaultValue: match.status })}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: minTouch + spacing.lg,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teams: { flex: 1, gap: spacing.xs },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accessory: { minWidth: 44, alignItems: 'flex-end' },
  outcome: {
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
});
