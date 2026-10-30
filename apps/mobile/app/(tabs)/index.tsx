import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { Screen } from '@/components/Screen';
import { ErrorState, EmptyState } from '@/components/StateViews';
import { HeadlinesBlock } from '@/components/home/HeadlinesBlock';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';
import { LastResultCard } from '@/components/home/LastResultCard';
import { NextMatchCard } from '@/components/home/NextMatchCard';
import { OpponentCard } from '@/components/home/OpponentCard';
import { SeasonCard } from '@/components/home/SeasonCard';
import { WhatsAtStakeCard } from '@/components/home/WhatsAtStakeCard';
import type { MatchT, StandingRowT } from '@/data/schemas';
import {
  useFixtures,
  useMeta,
  useNews,
  useRivals,
  useSeason,
  useStandings,
} from '@/data/queries';
import { teamName } from '@/features/calendar/logic';
import {
  isRecentResult,
  miniTableWindow,
  nextOpponentInfo,
  recentForm,
  seasonSummary,
  selectLastResult,
  selectNextMatch,
  selectPostponedNotice,
} from '@/features/home/logic';
import { useNow } from '@/features/home/useNow';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMatchDateShort } from '@/utils/matchTime';

const NO_MATCHES: MatchT[] = [];
const NO_TABLE: StandingRowT[] = [];

export default function Home() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const meta = useMeta();
  const standings = useStandings();
  const fixtures = useFixtures();
  const news = useNews();
  const season = useSeason();
  const rivals = useRivals();
  const now = useNow(60_000);

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
  const postponed = useMemo(() => selectPostponedNotice(matches), [matches]);
  const form = useMemo(() => recentForm(matches), [matches]);
  const summary = seasonSummary(standings.data, teamId ?? -1);
  const opponent = teamId !== null ? nextOpponentInfo(matches, table, teamId) : null;
  const miniRows = teamId !== null ? miniTableWindow(table, teamId) : [];
  const recent = last && isRecentResult(last, now) ? last : null;
  // Una caché de otra temporada no se mezcla con la actual: se usa el respaldo local.
  const seasonData =
    season.data && meta.data && season.data.season === meta.data.season ? season.data : null;
  const rivalsData =
    rivals.data && meta.data && rivals.data.season === meta.data.season ? rivals.data : null;
  const rival =
    opponent !== null
      ? (rivalsData?.rivals.find((entry) => entry.team.id === opponent.opponent.id) ?? null)
      : null;

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

      {recent ? <LastResultCard match={recent} /> : null}

      {next ? (
        <NextMatchCard
          match={next}
          competitionCode={meta.data?.competitionCode ?? null}
          competitionName={meta.data?.competitionName ?? null}
        />
      ) : (
        <EmptyState message={t('home.noNextMatch')} />
      )}

      {postponed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/match/${postponed.id}`)}
          style={[
            styles.notice,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('home.postponedNotice', {
              teams: `${teamName(postponed.home)} – ${teamName(postponed.away)}`,
              date: formatMatchDateShort(
                postponed.utcDate,
                postponed.status,
                i18n.language,
              ),
            })}
          </Text>
        </Pressable>
      ) : null}

      {opponent ? <OpponentCard info={opponent} rival={rival} /> : null}

      {seasonData?.whatIsAtStake ? (
        <WhatsAtStakeCard stake={seasonData.whatIsAtStake} />
      ) : null}

      <SeasonCard
        season={seasonData}
        summary={summary}
        form={form}
        rows={miniRows}
        teamId={teamId ?? -1}
      />

      {news.data && news.data.stories.length > 0 ? (
        <HeadlinesBlock
          stories={news.data.stories}
          sources={news.data.sources}
          onSeeAll={() => router.push('/news')}
        />
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
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
});
