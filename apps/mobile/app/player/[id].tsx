import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import { countryLabel } from '@/features/squad/labels';
import { ageFrom, formatPartialDate, pendingFields, positionGroup } from '@/features/squad/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function InfoRow({ label, value }: { label: string; value: string | null }) {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity
  const player = squad.data?.players.find((p) => String(p.id) === id);

  if (!player) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('player.title') }} />
        {squad.isPending ? <LoadingState /> : <EmptyState message={t('player.notFound')} />}
      </Screen>
    );
  }

  const locale = i18n.language;
  const group = positionGroup(player.position);
  const positionLabel = group === 'OTHER' ? player.position : t(`player.positionName.${group}`);
  const age = ageFrom(player.dateOfBirth, now);
  const birth = formatPartialDate(player.dateOfBirth, locale);
  const height = player.heightCm ?? null; // la caché anterior al ADR 0007 no trae el campo
  const pending = pendingFields(player);

  return (
    <Screen>
      <Stack.Screen options={{ title: player.name }} />
      <Card>
        <View style={styles.hero}>
          <PlayerAvatar id={player.id} name={player.name} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
              {player.name}
            </Text>
            {positionLabel ? <BodyText muted>{positionLabel}</BodyText> : null}
          </View>
          {player.shirtNumber !== null ? (
            <Text
              accessibilityLabel={`${t('player.shirtNumber')} ${player.shirtNumber}`}
              style={{ color: colors.primary, fontSize: 32, fontWeight: '700' }}
            >
              {player.shirtNumber}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <InfoRow label={t('player.position')} value={positionLabel} />
        <InfoRow
          label={t('player.nationality')}
          value={player.nationality ? countryLabel(t, player.nationality) : null}
        />
        <InfoRow label={t('player.birth')} value={birth} />
        <InfoRow label={t('player.age')} value={age !== null ? t('player.ageValue', { n: age }) : null} />
        <InfoRow label={t('player.height')} value={height !== null ? t('player.heightValue', { n: height }) : null} />
        <InfoRow label={t('player.contract')} value={formatPartialDate(player.contractUntil, locale)} />
      </Card>

      {pending.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.pendingTitle')}
          </Text>
          <BodyText muted>{t('player.pendingBody')}</BodyText>
          <BodyText>{pending.map((k) => t(`player.field.${k}`)).join(' · ')}</BodyText>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoRow: { gap: 2 },
});
