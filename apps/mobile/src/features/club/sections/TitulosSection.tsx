import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { ConfidenceBadge, SectionHeader } from '@/components/club/Editorial';
import { useTitles } from '@/data/queries';
import type { ClubT } from '@/data/schemas';
import { formatDate, titleTotal } from '@/features/club/logic';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { TagList } from './ui';

export function TitulosSection({ club }: { club: ClubT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const query = useTitles();
  const [competition, setCompetition] = useState<string | null>(null);

  const total = titleTotal(club.titles);
  const editions = query.data?.editions;
  const competitions = [...new Set((editions ?? []).map((edition) => edition.competition))];
  const visibleEditions = (editions ?? [])
    .filter((edition) => !competition || edition.competition === competition)
    .slice()
    .sort((a, b) => b.year - a.year);
  if (club.titles.length === 0 && !editions?.length) return <EmptyState message={t('club.titulos.empty')} />;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionHeader title={t('club.titulos.title')} subtitle={t('club.titulos.editorialSubtitle')} icon="trophy-outline" />
        <Text style={{ color: colors.text, fontSize: 15 }}>
          {t('club.titulos.total', {
            total,
            competitions: club.titles.length,
          })}
        </Text>
      </Card>

      {competitions.length ? <View style={styles.filters}>{[null, ...competitions].map((item) => <Pressable key={item ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: competition === item }} onPress={() => setCompetition(item)} style={[styles.filter, { backgroundColor: competition === item ? colors.primary : colors.surface, borderColor: colors.border }]}><Text style={{ color: competition === item ? colors.onPrimary : colors.text, fontWeight: '700' }}>{item ?? t('club.titulos.all')}</Text></Pressable>)}</View> : null}

      {query.isError ? <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>{t('data.error')}</Text> : null}
      {visibleEditions.map((edition) => {
        const match = edition.finalMatch;
        const deporName = /deportivo/i;
        const rival = match?.home && deporName.test(match.home) ? match.away : match?.away && deporName.test(match.away) ? match.home : null;
        const score = match?.homeGoals !== null && match?.homeGoals !== undefined && match.awayGoals !== null ? `${match.homeGoals}–${match.awayGoals}` : null;
        const locale = i18n.language;
        return <Card key={`${edition.competition}-${edition.year}`}>
          <View style={styles.editionHeader}><View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>{edition.year}</Text><Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{edition.competition}</Text></View><ConfidenceBadge label={t('club.titulos.confidence')} status={edition.status} /></View>
          {rival ? <Text style={{ color: colors.text, fontFamily: 'SourceSerif4-SemiBold', fontSize: 17 }}>{t('club.titulos.finalAgainst', { rival })}</Text> : null}
          {score ? <Text accessibilityLabel={t('club.titulos.score', { score })} style={{ color: colors.primary, fontSize: 32, fontWeight: '900' }}>{score}</Text> : null}
          {match?.date ? <Text style={{ color: colors.textMuted }}>{formatDate(match.date, locale)}</Text> : null}
          {match?.venue ? <Text style={{ color: colors.textMuted }}>{match.venue}</Text> : null}
          {edition.coach ? <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text }}>{t('club.titulos.coach', { coach: edition.coach })}</Text>
            {edition.coachProvenance ? <FieldProvenance
              source={edition.coachProvenance.source}
              confidence={t(`common.confidenceLevel.${edition.coachProvenance.confidence}`)}
            /> : null}
          </View> : null}
          {match?.goalScorers.length ? <View style={{ gap: spacing.xs }}><Text style={{ color: colors.textMuted, fontWeight: '700' }}>{t('club.titulos.scorers')}</Text>{match.goalScorers.map((goal, index) => <Text key={`${goal.player}-${index}`} style={{ color: colors.text }}>{goal.player}{goal.minute !== null ? ` · ${goal.minute}′` : ''}</Text>)}</View> : null}
          {edition.squad.length ? <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{t('club.titulos.squad')}</Text>
            {edition.squadProvenance ? <FieldProvenance
              source={edition.squadProvenance.source}
              confidence={t(`common.confidenceLevel.${edition.squadProvenance.confidence}`)}
            /> : null}
            {edition.squad.map((player) => <Text key={player.name} style={{ color: colors.text }}>{player.name}{player.role ? ` · ${player.role}` : ''}</Text>)}
          </View> : null}
          {edition.note ? <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{edition.note}</Text> : null}
          {match?.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(match.sourceUrl!)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('club.titulos.source')}</Text></Pressable> : null}
        </Card>;
      })}

      {club.titles.map((title) => {
        const years = [...title.years].sort((a, b) => b - a).map(String);
        return (
          <View
            key={title.competition}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
                {title.competition}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t('club.titulos.count', { count: title.years.length })}
              </Text>
            </View>
            <TagList items={years} />
          </View>
        );
      })}
    </View>
  );
}

function FieldProvenance({ source, confidence }: { source: string; confidence: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const url = source.match(/https?:\/\/[^\s)]+/)?.[0];
  const label = t('club.titulos.fieldProvenance', { source, confidence });
  const content = <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>;

  return url ? (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {content}
    </Pressable>
  ) : content;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  filter: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  editionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
