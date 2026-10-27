import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TeamCrest } from '@/components/TeamCrest';
import type { StandingsT } from '@/data/schemas';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function StandingsTable({
  table,
  highlightTeamId,
  compact = false,
}: {
  table: StandingsT['table'];
  highlightTeamId?: number;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cell = (text: string | number, width: number, bold = false, muted = false) => (
    <Text
      style={{
        width,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: bold ? '700' : '400',
        color: muted ? colors.textMuted : colors.text,
      }}
    >
      {text}
    </Text>
  );
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        {cell(t('calendar.col.pos'), 28, true, true)}
        <View style={{ width: 20 }} />
        <Text style={{ flex: 1, color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>{t('calendar.col.team')}</Text>
        {!compact && cell(t('calendar.col.played'), 32, true, true)}
        {!compact && cell(t('calendar.col.goalDiff'), 36, true, true)}
        {cell(t('calendar.col.points'), 36, true, true)}
      </View>
      {table.map((r) => {
        const me = r.team.id === highlightTeamId;
        return (
          <View
            key={r.team.id}
            accessible
            accessibilityLabel={`${r.position}. ${r.team.shortName ?? r.team.name}, ${r.points} ${t('calendar.col.points')}`}
            style={[styles.row, { borderLeftWidth: 3, borderLeftColor: me ? colors.primary : 'transparent' }]}
          >
            {cell(r.position, 28, me)}
            <TeamCrest team={r.team} size={20} />
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 15, fontWeight: me ? '700' : '400' }}>
              {r.team.shortName ?? r.team.name}
            </Text>
            {!compact && cell(r.played, 32, me)}
            {!compact && cell(r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference, 36, me)}
            {cell(r.points, 36, true)}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: spacing.sm, gap: spacing.xs },
});
