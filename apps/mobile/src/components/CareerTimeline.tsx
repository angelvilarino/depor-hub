import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TeamCrest } from '@/components/TeamCrest';
import type { CareerEntryT } from '@/data/schemas';
import { formatNumber, mergeCareerPeriods, seasonRange } from '@/features/squad/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = { career: CareerEntryT[]; emptyLabel?: string };

/**
 * Trayectoria en línea vertical (ADR 0014).
 *
 * Las etapas contiguas del mismo club se unifican en un solo periodo, de modo que no
 * se repite el club por cada temporada. El escudo se pinta siempre: si no hay URL,
 * `TeamCrest` muestra el monograma y el hueco no cambia de tamaño.
 */
export function CareerTimeline({ career, emptyLabel }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const entries = mergeCareerPeriods(career);

  if (entries.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>
        {emptyLabel ?? t('player.careerEmpty')}
      </Text>
    );
  }

  return (
    <View style={styles.timeline}>
      {entries.map((entry, index) => {
        const range = seasonRange(entry.from, entry.to);
        const stats = [
          entry.appearances !== null
            ? `${formatNumber(entry.appearances, i18n.language)} ${t('player.stats.appearancesShort')}`
            : null,
          entry.goals !== null
            ? `${formatNumber(entry.goals, i18n.language)} ${t('player.stats.goalsShort')}`
            : null,
          entry.minutes !== null
            ? `${formatNumber(entry.minutes, i18n.language)} ${t('player.stats.minutesShort')}`
            : null,
        ].filter(Boolean);
        return (
          <View key={`${entry.club}-${entry.from ?? index}-${entry.role ?? 'player'}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              {index < entries.length - 1 ? (
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              ) : null}
            </View>
            <View
              style={[
                styles.body,
                index > 0
                  ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }
                  : null,
              ]}
            >
              <View style={styles.head}>
                <TeamCrest
                  size={24}
                  team={{ name: entry.club, tla: null, crestUrl: entry.crestUrl }}
                />
                <Text style={[styles.club, { color: colors.text }]}>{entry.club}</Text>
                {range ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{range}</Text>
                ) : null}
              </View>
              {stats.length > 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{stats.join(' · ')}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  body: { flex: 1, gap: 2, paddingBottom: spacing.md, paddingTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  club: { flex: 1, fontSize: 15, fontWeight: '700' },
});
