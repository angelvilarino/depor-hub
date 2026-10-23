import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { BodyText, Card, Screen } from '@/components/Screen';
import { PlayerRow } from '@/components/PlayerRow';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import { countryLabel } from '@/features/squad/labels';
import { groupSquad } from '@/features/squad/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function TeamScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const squad = useSquad();
  const [now] = useState(() => Date.now()); // fuera del render: regla react-hooks/purity

  const sections = useMemo(
    () =>
      groupSquad(squad.data?.players ?? []).map((g) => ({
        key: g.group,
        title: `${t(`team.group.${g.group}`)} · ${g.data.length}`,
        data: g.data,
      })),
    [squad.data, t],
  );

  const coach = squad.data?.coach ?? null;
  const header = (
    <View style={styles.header}>
      <FreshnessBanner dataUpdatedAt={squad.dataUpdatedAt} isFetching={squad.isFetching} isError={squad.isError} />
      {coach?.name ? (
        <Card>
          <View style={styles.coach}>
            <PlayerAvatar id={0} name={coach.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('team.coach')}</Text>
              <BodyText>
                {coach.nationality ? `${coach.name} · ${countryLabel(t, coach.nationality)}` : coach.name}
              </BodyText>
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );

  if (!squad.data) {
    return (
      <Screen refreshing={squad.isRefetching} onRefresh={() => void squad.refetch()}>
        {header}
        {squad.isPending ? <LoadingState /> : <ErrorState onRetry={() => void squad.refetch()} />}
      </Screen>
    );
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(p) => String(p.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState message={t('team.empty')} />}
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700', paddingTop: spacing.sm }}
        >
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => <PlayerRow player={item} now={now} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      refreshControl={
        <RefreshControl
          refreshing={squad.isRefetching}
          onRefresh={() => void squad.refetch()}
          tintColor={colors.primary}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  coach: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
