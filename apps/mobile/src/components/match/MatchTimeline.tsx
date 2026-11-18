import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PaperCard, SectionHeader } from '@/components/design/DesignSystem';
import type { MatchDetailT, MatchT } from '@/data/schemas';
import { buildTimeline, type TimelineEntry } from '@/features/match/timeline';
import { spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** D-05: goles, tarjetas y cambios en una sola línea temporal ordenada por minuto. */
export function MatchTimeline({ match, detail }: { match: MatchT; detail: MatchDetailT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const entries = buildTimeline(detail);
  const sideLabel = (side: TimelineEntry['side']) => {
    const team = side === 'home' ? match.home : match.away;
    return team.shortName ?? team.tla ?? team.name;
  };
  const note = (entry: TimelineEntry): string | null => {
    if (entry.kind === 'goal') {
      return entry.penalty ? t('match.penalty') : entry.ownGoal ? t('match.ownGoal') : null;
    }
    if (entry.kind === 'card') {
      if (entry.card === 'red') return t('match.red');
      if (entry.card === 'second_yellow') return t('match.secondYellow');
      return t('match.yellow');
    }
    if (entry.playerOut && entry.playerIn) {
      return `${entry.playerOut} → ${entry.playerIn}`;
    }
    if (entry.playerOut) return `${t('match.playerOut')}: ${entry.playerOut}`;
    return `${t('match.playerIn')}: ${entry.playerIn}`;
  };
  const label = (entry: TimelineEntry) => {
    if (entry.kind === 'goal') return entry.player;
    if (entry.kind === 'card') return entry.player;
    return note(entry) ?? '';
  };
  const icon = (entry: TimelineEntry): IconName => {
    if (entry.kind === 'goal') return 'football';
    if (entry.kind === 'substitution') return 'swap-horizontal';
    return 'square';
  };
  const tint = (entry: TimelineEntry): string => {
    if (entry.kind === 'card' && entry.card !== 'yellow') return colors.loss;
    if (entry.kind === 'card') return colors.rating;
    return colors.paper.accent;
  };

  return (
    <PaperCard>
      <SectionHeader icon="time-outline" title={t('match.timeline')} />
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="list-outline" size={22} color={colors.paper.muted} />
          <Text style={{ color: colors.paper.muted, flex: 1, ...text.body }}>
            {t('match.noEventsShort')}
          </Text>
        </View>
      ) : (
        <View>
          {entries.map((entry, index) => {
            const extra = note(entry);
            return (
              <View
                key={entry.key}
                accessible
                accessibilityLabel={`${entry.minuteLabel}' ${sideLabel(entry.side)} ${label(entry)}${extra && entry.kind !== 'substitution' ? ` (${extra})` : ''}`}
                style={[
                  styles.row,
                  index > 0
                    ? {
                        borderTopColor: colors.paper.border,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      }
                    : null,
                ]}
              >
                <Text
                  style={{ color: colors.paper.muted, width: 38, ...text.body, fontWeight: '700' }}
                >
                  {entry.minuteLabel}&apos;
                </Text>
                <Ionicons name={icon(entry)} size={16} color={tint(entry)} />
                <View style={styles.body}>
                  {entry.kind === 'substitution' ? (
                    <Text style={{ color: colors.paper.text, ...text.body }}>{extra}</Text>
                  ) : (
                    <Text style={{ color: colors.paper.text, ...text.body }}>
                      <Text style={{ fontWeight: '700' }}>{label(entry)}</Text>
                      {extra ? <Text style={{ color: colors.paper.muted }}> ({extra})</Text> : null}
                      {entry.kind === 'goal' && entry.scoreAfter ? (
                        <Text style={{ color: colors.paper.accent, fontWeight: '800' }}>
                          {'  '}
                          {entry.scoreAfter}
                        </Text>
                      ) : null}
                    </Text>
                  )}
                </View>
                <Text numberOfLines={1} style={{ color: colors.paper.muted, ...text.caption }}>
                  {sideLabel(entry.side)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  empty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  body: { flex: 1, minWidth: 0 },
});
