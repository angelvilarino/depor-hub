import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { StandingsTable } from '@/components/StandingsTable';
import { FormChips } from '@/components/home/FormChips';
import { PositionChart } from '@/components/home/PositionChart';
import type { SeasonFormMatchT, SeasonT, StandingRowT } from '@/data/schemas';
import { teamName } from '@/features/calendar/logic';
import type { FormResult, SeasonSummary } from '@/features/home/logic';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function formDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function FormRow({ match, locale }: { match: SeasonFormMatchT; locale: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const color =
    match.result === 'W' ? colors.win : match.result === 'L' ? colors.loss : colors.draw;
  const label = t('home.seasonCard.formA11y', {
    result: t(`calendar.outcomeLong.${match.result}`),
    opponent: teamName(match.opponent),
    date: formDate(match.date, locale),
  });
  return (
    <View accessible accessibilityLabel={label} style={styles.formRow}>
      <Text style={{ color: colors.textMuted, fontSize: 12, width: 56 }}>
        {formDate(match.date, locale)}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, flex: 1 }}>
        {teamName(match.opponent)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, width: 66 }}>
        {match.home ? t('home.local') : t('home.away')}
      </Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', width: 42, textAlign: 'center' }}>
        {match.scoreFor}–{match.scoreAgainst}
      </Text>
      <Text
        accessibilityLabel={t(`calendar.outcomeLong.${match.result}`)}
        style={{ color, fontSize: 14, fontWeight: '700', width: 16, textAlign: 'center' }}
      >
        {t(`calendar.outcome.${match.result}`)}
      </Text>
    </View>
  );
}

/**
 * «La temporada» fusionada: un único resumen (posición y puntos no se repiten),
 * racha con leyenda y detalle, evolución de la posición y mini-clasificación.
 * Si `season.json` no existe (404 o caché anterior) se usa la clasificación y la
 * racha calculada con los partidos; el detalle y la gráfica simplemente no salen.
 */
export function SeasonCard({
  season,
  summary,
  form,
  rows,
  teamId,
}: {
  season: SeasonT | null;
  summary: SeasonSummary | null;
  form: FormResult[];
  rows: StandingRowT[];
  teamId: number;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();

  const stats = season?.summary ?? summary;
  if (!stats) return null;

  const formMatches = season?.form ?? [];
  const results = formMatches.length > 0 ? formMatches.map((match) => match.result) : form;
  const evolution = season?.positionEvolution ?? [];
  const label = t('home.seasonSummary', {
    position: stats.position,
    points: stats.points,
    played: stats.played,
    won: stats.won,
    drawn: stats.drawn,
    lost: stats.lost,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
    goalDifference: stats.goalDifference,
  });

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('home.season')}
      </Text>

      <View accessible accessibilityLabel={label} style={styles.grid}>
        <Stat label={t('home.stats.position')} value={`${stats.position}º`} />
        <Stat label={t('home.stats.points')} value={String(stats.points)} />
        <Stat label={t('calendar.col.played')} value={String(stats.played)} />
        <Stat
          label={t('home.stats.record')}
          value={`${stats.won}-${stats.drawn}-${stats.lost}`}
        />
        <Stat
          label={t('home.stats.goals')}
          value={`${stats.goalsFor}-${stats.goalsAgainst}`}
        />
        <Stat
          label={t('calendar.col.goalDiff')}
          value={
            stats.goalDifference > 0 ? `+${stats.goalDifference}` : String(stats.goalDifference)
          }
        />
      </View>

      {results.length > 0 ? (
        <View style={styles.block}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
            {t('home.seasonCard.form')}
          </Text>
          <FormChips results={results} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {t('home.seasonCard.formLegend')}
          </Text>
          {formMatches.length > 0 ? (
            <View style={styles.formList}>
              {formMatches.map((match) => (
                <FormRow key={match.matchId} match={match} locale={i18n.language} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {evolution.length > 1 ? (
        <View style={styles.block}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
            {t('home.seasonCard.evolution')}
          </Text>
          <PositionChart points={evolution} />
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.block}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
            {t('home.miniTable')}
          </Text>
          <StandingsTable table={rows} highlightTeamId={teamId} compact />
          <Button
            variant="secondary"
            label={t('home.seeFullTable')}
            onPress={() => router.push({ pathname: '/calendar', params: { tab: 'standings' } })}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm },
  stat: { width: '33.33%', gap: 2 },
  block: { gap: spacing.xs },
  formList: { gap: 2, marginTop: spacing.xs },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
});
