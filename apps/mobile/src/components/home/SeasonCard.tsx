import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { CrestBadge, PaperCard, SectionHeader, StatTile } from '@/components/design/DesignSystem';
import { StandingsTable } from '@/components/StandingsTable';
import { PositionChart } from '@/components/home/PositionChart';
import { FormChips } from '@/components/home/FormChips';
import type { SeasonFormMatchT, SeasonT, StandingRowT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import type { FormResult, SeasonSummary } from '@/features/home/logic';
import { minTouch, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function formDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T12:00:00Z`));
}

function score(match: SeasonFormMatchT) {
  return match.home
    ? `${match.scoreFor}–${match.scoreAgainst}`
    : `${match.scoreAgainst}–${match.scoreFor}`;
}

function FormTile({
  match,
  selected,
  onPress,
}: {
  match: SeasonFormMatchT;
  selected: boolean;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const tone = match.result === 'W' ? colors.win : match.result === 'L' ? colors.loss : colors.draw;
  const label = t('home.seasonCard.formA11y', {
    result: t(`calendar.outcomeLong.${match.result}`),
    opponent: teamName(match.opponent),
    date: formDate(match.date, i18n.language),
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.formTile, selected && { borderColor: paper.accent, backgroundColor: colors.surface }]}
    >
      <View style={[styles.crestRing, { borderColor: tone }]}>
        <CrestBadge team={match.opponent} size={38} />
        <View style={[styles.resultBadge, { backgroundColor: tone }]}>
          <Text style={[styles.resultLetter, { color: colors.onPrimary }]}>{t(`calendar.outcome.${match.result}`)}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={{ maxWidth: 76, textAlign: 'center', color: paper.text, fontSize: 11 }}>
        {match.opponent.shortName ?? teamName(match.opponent)}
      </Text>
    </Pressable>
  );
}

/** Prensa: temporada, cromos interactivos, gráfico táctil y tabla compacta. */
export function SeasonCard({
  season,
  summary,
  form,
  formMatches,
  seasonName,
  matchday,
  rows,
  teamId,
}: {
  season: SeasonT | null;
  summary: SeasonSummary | null;
  form: FormResult[];
  formMatches: SeasonFormMatchT[];
  seasonName: string | null;
  matchday: number | null;
  rows: StandingRowT[];
  teamId: number;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);
  const stats = season?.summary ?? summary;
  const evolution = season?.positionEvolution;
  const chronological = useMemo(() => {
    const source = formMatches.length > 0 ? formMatches : (season?.form ?? []);
    return [...source].sort((a, b) => a.date.localeCompare(b.date));
  }, [formMatches, season?.form]);
  const recent = chronological.slice(-5);
  const points = useMemo(
    () => [...(evolution ?? [])].sort((a, b) => a.matchday - b.matchday),
    [evolution],
  );
  const activeMatchday = selectedMatchday ?? points.at(-1)?.matchday ?? recent.at(-1)?.matchday ?? null;
  const selectedMatch = chronological.find((item) => item.matchday === activeMatchday) ?? null;
  if (!stats) return null;

  const seasonCaption = [
    seasonName,
    matchday != null ? t('home.seasonCard.matchday', { matchday }) : null,
  ].filter(Boolean).join(' · ');
  const record = `${stats.won}-${stats.drawn}-${stats.lost}`;
  const goals = `${stats.goalsFor}-${stats.goalsAgainst}`;
  const average = stats.played > 0
    ? new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.points / stats.played)
    : '—';
  const selectedLabel = selectedMatch
    ? t('home.seasonCard.formA11y', {
        result: t(`calendar.outcomeLong.${selectedMatch.result}`),
        opponent: teamName(selectedMatch.opponent),
        date: formDate(selectedMatch.date, i18n.language),
      })
    : null;

  return (
    <>
      <PaperCard>
        <SectionHeader title={t('home.season')} subtitle={seasonCaption || undefined} />
        <View style={styles.stats}>
          <StatTile label={t('calendar.col.played')} value={stats.played} />
          <StatTile label={t('home.stats.record')} value={record} />
          <StatTile label={t('home.stats.goals')} value={goals} />
          <StatTile label={t('calendar.col.goalDiff')} value={stats.goalDifference > 0 ? `+${stats.goalDifference}` : stats.goalDifference} />
          <StatTile label={t('home.seasonCard.pointsPerGame')} value={average} />
        </View>

        {recent.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title={t('home.seasonCard.form')} subtitle={t('home.seasonCard.formOrder')} />
            <View style={styles.formStrip}>
              {recent.map((item) => (
                <FormTile
                  key={item.matchId}
                  match={item}
                  selected={item.matchday === activeMatchday}
                  onPress={() => setSelectedMatchday(item.matchday ?? null)}
                />
              ))}
            </View>
            <Text style={{ color: paper.muted, fontSize: 12 }}>{t('home.seasonCard.formLegend')}</Text>
            {selectedMatch && selectedLabel ? (
              <View style={[styles.matchDetail, { borderColor: paper.border }]}>
                <CrestBadge team={selectedMatch.opponent} size={46} />
                <View style={styles.matchCopy}>
                  <Text style={[styles.opponent, { color: paper.text }]}>{teamName(selectedMatch.opponent)}</Text>
                  <Text style={{ color: paper.muted, fontSize: 12 }}>
                    {formDate(selectedMatch.date, i18n.language)} · {selectedMatch.home ? t('home.local') : t('home.away')}
                  </Text>
                </View>
                <Text accessibilityLabel={selectedLabel} style={[styles.score, { color: paper.text }]}>{score(selectedMatch)}</Text>
                <Button
                  variant="secondary"
                  label={t('home.seasonCard.viewMatch')}
                  onPress={() => router.push(`/match/${selectedMatch.matchId}`)}
                />
              </View>
            ) : null}
          </View>
        ) : form.length > 0 ? (
          <View style={styles.block}>
            <Text style={{ color: paper.muted, fontSize: 13 }}>{t('home.seasonCard.form')}</Text>
            <FormChips results={form} />
            <Text style={{ color: paper.muted, fontSize: 12 }}>{t('home.seasonCard.formLegend')}</Text>
          </View>
        ) : null}

        {points.length > 1 ? (
          <View style={styles.block}>
            <SectionHeader title={t('home.seasonCard.evolution')} />
            <PositionChart
              points={points}
              matches={chronological}
              selectedMatchday={activeMatchday}
              onSelectMatchday={setSelectedMatchday}
            />
          </View>
        ) : null}
      </PaperCard>

      {rows.length > 0 ? (
        <PaperCard>
          <SectionHeader title={t('home.miniTable')} subtitle={t('home.miniTableContext')} />
          <StandingsTable table={rows} highlightTeamId={teamId} compact />
          <Button
            variant="secondary"
            label={t('home.seeFullTable')}
            onPress={() => router.push({ pathname: '/calendar', params: { tab: 'standings' } })}
          />
        </PaperCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.md },
  block: { gap: spacing.xs },
  formStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  formTile: { minWidth: minTouch + 14, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 12, padding: 4 },
  crestRing: { width: 48, height: 48, borderWidth: 2, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  resultBadge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  resultLetter: { fontSize: 11, fontWeight: '900' },
  matchDetail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  matchCopy: { flex: 1, minWidth: 100 },
  opponent: { fontFamily: typography.headline, fontSize: 17 },
  score: { fontFamily: typography.numeric, fontSize: 24 },
});
