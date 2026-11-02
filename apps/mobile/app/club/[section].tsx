import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useClub } from '@/data/queries';
import { ClubGate } from '@/features/club/ClubGate';
import type { ClubSectionId } from '@/features/club/logic';
import { CLUB_SECTION_COMPONENTS } from '@/features/club/sections';
import { EquipacionesSection } from '@/features/club/sections/EquipacionesSection';
import { spacing } from '@/theme/tokens';

export default function ClubSectionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const raw = Array.isArray(params.section) ? params.section[0] : params.section;
  const id = raw && raw in CLUB_SECTION_COMPONENTS ? (raw as ClubSectionId) : null;
  const Component = id ? CLUB_SECTION_COMPONENTS[id] : null;
  const query = useClub();
  const title = id ? t(`club.sections.${id}.title`) : t('club.sections.unknownTitle');
  const screenOptions = <Stack.Screen options={{ title, headerBackTitle: t('tabs.club') }} />;

  if (!Component) {
    return (
      <Screen>
        {screenOptions}
        <EmptyState message={t('club.sections.unknown')} />
      </Screen>
    );
  }

  if (id === 'equipaciones') {
    return (
      <View style={styles.container}>
        {screenOptions}
        {query.isPending ? (
          <View style={styles.state}>
            <LoadingState />
          </View>
        ) : query.isError ? (
          <View style={styles.state}>
            <ErrorState onRetry={() => void query.refetch()} />
          </View>
        ) : !query.data ? (
          <View style={styles.state}>
            <EmptyState message={t('club.empty')} />
          </View>
        ) : (
          <>
            <View style={styles.banner}>
              <FreshnessBanner
                dataUpdatedAt={query.dataUpdatedAt}
                isFetching={query.isFetching}
                isError={query.isError}
              />
            </View>
            <EquipacionesSection club={query.data} />
          </>
        )}
      </View>
    );
  }

  return (
    <Screen>
      {screenOptions}
      <ClubGate query={query}>{(club) => <Component club={club} />}</ClubGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  state: { padding: spacing.md },
  banner: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
});
