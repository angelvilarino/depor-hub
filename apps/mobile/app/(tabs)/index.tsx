import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, EmptyState } from '@/components/StateViews';
import { HeadlinesBlock } from '@/components/home/HeadlinesBlock';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { LastResultCard } from '@/components/home/LastResultCard';
import { MiniTable } from '@/components/home/MiniTable';
import { NextMatchCard } from '@/components/home/NextMatchCard';
import { OpponentCard } from '@/components/home/OpponentCard';
import { SeasonCard } from '@/components/home/SeasonCard';
import type { MatchT, StandingRowT } from '@/data/schemas';
import { useFixtures, useMeta, useNews, useStandings } from '@/data/queries';
import {
  miniTableWindow,
  nextOpponentInfo,
  recentForm,
  seasonSummary,
  selectLastResult,
  selectNextMatch,
} from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const NO_MATCHES: MatchT[] = [];
const NO_TABLE: StandingRowT[] = [];

export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const meta = useMeta();
  const standings = useStandings();
  const fixtures = useFixtures();
  const news = useNews();

  const refresh = () => {
    void meta.refetch();
    void standings.refetch();
    void fixtures.refetch();
  };

  const matches = fixtures.data?.matches ?? NO_MATCHES;
  const table = standings.data?.table ?? NO_TABLE;
  const teamId = meta.data?.team.id ?? null;

  const next = useMemo(() => selectNextMatch(matches), [matches]);
  const last = useMemo(() => selectLastResult(matches), [matches]);
  const form = useMemo(() => recentForm(matches), [matches]);
  const summary = seasonSummary(standings.data, teamId ?? -1);
  const opponent = teamId !== null ? nextOpponentInfo(matches, table, teamId) : null;
  const miniRows = teamId !== null ? miniTableWindow(table, teamId) : [];

  const pending =
    !meta.data &&
    !standings.data &&
    !fixtures.data &&
    (meta.isPending || standings.isPending || fixtures.isPending);
  const failed =
    !meta.data &&
    !standings.data &&
    !fixtures.data &&
    (meta.isError || standings.isError || fixtures.isError);

  const banner = (
    <FreshnessBanner
      dataUpdatedAt={meta.dataUpdatedAt}
      isFetching={meta.isFetching || standings.isFetching || fixtures.isFetching}
      isError={meta.isError || standings.isError || fixtures.isError}
    />
  );

  if (pending) {
    return (
      <Screen refreshing onRefresh={refresh}>
        {banner}
        <HomeSkeleton />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen refreshing={false} onRefresh={refresh}>
        {banner}
        <ErrorState onRetry={refresh} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={meta.isRefetching || standings.isRefetching || fixtures.isRefetching}
      onRefresh={refresh}
    >
      {banner}

      {next ? (
        <NextMatchCard match={next} competitionName={meta.data?.competitionName ?? null} />
      ) : (
        <EmptyState message={t('home.noNextMatch')} />
      )}

      {last ? <LastResultCard match={last} /> : <EmptyState message={t('home.noLastResult')} />}

      {summary ? (
        <SeasonCard summary={summary} form={form} />
      ) : (
        <EmptyState message={t('home.noStandings')} />
      )}

      {miniRows.length > 0 && teamId !== null ? (
        <MiniTable rows={miniRows} teamId={teamId} />
      ) : null}

      {opponent ? <OpponentCard info={opponent} /> : null}

      {news.data && news.data.items.length > 0 ? (
        <HeadlinesBlock items={news.data.items} />
      ) : null}

      {meta.data ? (
        <Text style={[styles.footer, { color: colors.textMuted }]}>
          {t('data.seasonLine', {
            season: meta.data.season,
            matchday: standings.data?.matchday ?? '—',
          })}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
});
