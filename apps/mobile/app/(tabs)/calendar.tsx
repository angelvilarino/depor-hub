import { useMemo } from 'react';
import { Alert, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { MatchCard } from '@/components/MatchCard';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { StandingsTable } from '@/components/StandingsTable';
import { useFixtures, useMeta, useStandings } from '@/data/queries';
import { groupByMonth, splitMatches } from '@/features/calendar/logic';
import { shareIcs } from '@/features/calendar/system';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { buildIcs } from '@/utils/ics';
import { formatMonth } from '@/utils/matchTime';

type Tab = 'upcoming' | 'results' | 'standings';

const isTab = (value: unknown): value is Tab =>
  value === 'upcoming' || value === 'results' || value === 'standings';

export default function CalendarScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const fixtures = useFixtures();
  const standings = useStandings();
  const meta = useMeta();
  // La Home enlaza a «Ver tabla completa» con ?tab=standings. La pestaña vive en la
  // URL para que el enlace funcione aunque la pantalla ya estuviera montada.
  const tab: Tab = isTab(tabParam) ? tabParam : 'upcoming';
  const setTab = (next: Tab) => router.setParams({ tab: next });

  const { upcoming, results } = useMemo(() => splitMatches(fixtures.data?.matches ?? []), [fixtures.data]);
  const query = tab === 'standings' ? standings : fixtures;
  const refreshing = fixtures.isRefetching || standings.isRefetching;
  const refresh = () => { void fixtures.refetch(); void standings.refetch(); void meta.refetch(); };

  const onExport = async () => {
    if (!fixtures.data) return;
    try {
      const ics = buildIcs(fixtures.data.matches, new Date().toISOString(), {
        venue: meta.data?.team.venue ?? null,
        matchdayLabel: (n) => t('calendar.matchday', { n }),
        tbcLabel: t('calendar.timeTbc'),
      });
      await shareIcs(ics);
    } catch {
      Alert.alert(t('calendar.exportError'));
    }
  };

  const header = (
    <View style={styles.header}>
      <FreshnessBanner dataUpdatedAt={query.dataUpdatedAt} isFetching={query.isFetching} isError={query.isError} />
      <SegmentedControl<Tab> value={tab} onChange={setTab} options={[
        { value: 'upcoming', label: t('calendar.upcoming') },
        { value: 'results', label: t('calendar.results') },
        { value: 'standings', label: t('calendar.standings') },
      ]} />
      {tab === 'upcoming' && fixtures.data ? <Button variant="secondary" label={t('calendar.export')} onPress={() => void onExport()} /> : null}
    </View>
  );

  if (!query.data) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        {header}
        {query.isPending ? <LoadingState /> : <ErrorState onRetry={() => void query.refetch()} />}
      </Screen>
    );
  }

  if (tab === 'standings') {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh}>
        {header}
        {standings.data && standings.data.table.length > 0
          ? <StandingsTable table={standings.data.table} highlightTeamId={meta.data?.team.id} />
          : <EmptyState message={t('calendar.emptyStandings')} />}
      </Screen>
    );
  }

  const list = tab === 'upcoming' ? upcoming : results;
  const sections = groupByMonth(list).map((g) => ({ title: formatMonth(g.key, i18n.language), data: g.data }));

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(m) => String(m.id)}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState message={t(tab === 'upcoming' ? 'calendar.emptyUpcoming' : 'calendar.emptyResults')} />}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700', textTransform: 'capitalize', paddingTop: spacing.sm }}>{section.title}</Text>
      )}
      renderItem={({ item }) => <MatchCard match={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  header: { gap: spacing.md, marginBottom: spacing.sm },
});
