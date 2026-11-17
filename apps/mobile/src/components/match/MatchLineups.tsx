import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '@/components/Pressable';
import { PaperCard, SectionHeader } from '@/components/design/DesignSystem';
import { TeamCrest } from '@/components/TeamCrest';
import type { MatchDetailT, MatchDetailPlayerT, MatchT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import { minTouch, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Lineup = MatchDetailT['lineups']['home'];

function PlayerRows({ players }: { players: MatchDetailPlayerT[] }) {
  const { colors } = useTheme();
  if (players.length === 0) {
    return (
      <Text style={{ color: colors.paper.muted, ...text.body }}>—</Text>
    );
  }
  return (
    <View style={styles.rows}>
      {players.map((player, index) => (
        <View
          key={`${player.bdfutbolId ?? player.name}-${index}`}
          accessible
          accessibilityLabel={[player.shirtNumber, player.name].filter(Boolean).join(' ')}
          style={styles.row}
        >
          <Text
            style={{
              color: colors.paper.accent,
              width: 22,
              ...text.body,
              fontWeight: '800',
            }}
          >
            {player.shirtNumber ?? '·'}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.paper.text, flex: 1, ...text.body }}
          >
            {player.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function LineupColumn({
  lineup,
  team,
}: {
  lineup: Lineup;
  team: MatchT['home'];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.column}>
      <View style={styles.columnHead}>
        <TeamCrest team={team} size={18} />
        <Text numberOfLines={1} style={{ color: colors.paper.text, flex: 1, ...text.bodyLarge, fontWeight: '700' }}>
          {teamName(team)}
        </Text>
      </View>
      {lineup.coach ? (
        <Text numberOfLines={1} style={{ color: colors.paper.muted, ...text.caption }}>
          {t('match.coach')}: {lineup.coach}
        </Text>
      ) : null}
      <PlayerRows players={lineup.starters} />
    </View>
  );
}

/** D-05: el once de cada equipo, en dos columnas y con el dorsal delante. */
export function MatchLineups({ match, detail }: { match: MatchT; detail: MatchDetailT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const { home, away } = detail.lineups;
  const substitutes = home.substitutes.length + away.substitutes.length;
  const hasLineups = home.starters.length > 0 || away.starters.length > 0;

  if (!hasLineups) return null;

  return (
    <PaperCard>
      <SectionHeader
        icon="shirt-outline"
        title={t('match.lineups')}
        subtitle={t('match.starters')}
        trailing={
          substitutes > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showSubstitutes }}
              onPress={() => setShowSubstitutes((value) => !value)}
              style={styles.toggle}
            >
              <Text style={{ color: colors.paper.accent, ...text.body, fontWeight: '700' }}>
                {showSubstitutes
                  ? t('match.substitutesHide')
                  : t('match.substitutesCount', { count: substitutes })}
              </Text>
              <Ionicons
                name={showSubstitutes ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.paper.accent}
              />
            </Pressable>
          ) : undefined
        }
      />
      <View style={styles.columns}>
        <LineupColumn lineup={home} team={match.home} />
        <View style={[styles.divider, { backgroundColor: colors.paper.border }]} />
        <LineupColumn lineup={away} team={match.away} />
      </View>
      {showSubstitutes ? (
        <View style={[styles.subs, { borderTopColor: colors.paper.border }]}>
          <Text style={{ color: colors.paper.muted, ...text.caption, fontWeight: '700', textTransform: 'uppercase' }}>
            {t('match.substitutes')}
          </Text>
          <View style={styles.columns}>
            <View style={styles.column}>
              <Text numberOfLines={1} style={{ color: colors.paper.muted, ...text.caption, fontWeight: '700' }}>
                {teamName(match.home)}
              </Text>
              <PlayerRows players={home.substitutes} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.paper.border }]} />
            <View style={styles.column}>
              <Text numberOfLines={1} style={{ color: colors.paper.muted, ...text.caption, fontWeight: '700' }}>
                {teamName(match.away)}
              </Text>
              <PlayerRows players={away.substitutes} />
            </View>
          </View>
        </View>
      ) : null}
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: spacing.sm },
  column: { flex: 1, minWidth: 0, gap: spacing.xs },
  columnHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { width: StyleSheet.hairlineWidth },
  rows: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 20 },
  toggle: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  subs: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.xs },
});
