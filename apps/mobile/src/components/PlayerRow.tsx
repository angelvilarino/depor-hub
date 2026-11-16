import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { PlayerPortrait } from '@/components/PlayerPortrait';
import type { PlayerSummaryT } from '@/data/schemas';
import { countryLabel } from '@/features/squad/labels';
import { ageFrom } from '@/features/squad/logic';
import { minTouch, radius, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export function PlayerRow({ player, now }: { player: PlayerSummaryT; now: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const age = ageFrom(player.dateOfBirth, now);
  const subtitle = [
    player.nationality ? countryLabel(t, player.nationality) : null,
    age !== null ? t('player.ageValue', { n: age }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const label = [player.name, subtitle, player.shirtNumber !== null ? `${t('player.shirtNumber')} ${player.shirtNumber}` : null]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(`/player/${player.id}`)}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <PlayerPortrait player={player} size={44} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>
          {player.name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.textMuted, ...text.body }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {player.shirtNumber !== null ? (
        <Text style={{ color: colors.textMuted, ...text.subtitle, fontWeight: '700' }}>{player.shirtNumber}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouch + spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: spacing.xs },
});
