import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { ConfidenceBadge, SectionHeader, Timeline } from '@/components/club/Editorial';
import { useRivalries } from '@/data/queries';
import type { ClubT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { InfoRow, SectionTitle } from './ui';

export function RivalidadesSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const query = useRivalries();
  const historical = query.data?.rivalries ?? [];

  if (club.rivalries.length === 0 && historical.length === 0) {
    return <EmptyState message={t('club.rivalidades.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {club.rivalries.filter((rivalry) => !historical.some((item) => item.rival === rivalry.rival)).map((rivalry) => {
        const since = rivalry.sinceYear
          ? t('club.rivalidades.since', { year: rivalry.sinceYear })
          : null;
        return (
          <Card key={rivalry.rival}>
            <SectionTitle>{rivalry.rival}</SectionTitle>
            {rivalry.description ? (
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
                {rivalry.description}
              </Text>
            ) : null}
            <InfoRow label={t('club.rivalidades.sinceLabel')} value={since} />
          </Card>
        );
      })}
      {query.isError ? <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>{t('data.error')}</Text> : null}
      {historical.map((rivalry) => {
        const balance = rivalry.headToHead;
        const results = balance ? [balance.won, balance.drawn, balance.lost] : [];
        const resultTotal = results.reduce((sum, n) => sum + n, 0);
        const meetings = (balance?.meetings ?? []).map((meeting) => ({
          year: meeting.date,
          title: `${meeting.home} ${meeting.homeGoals}–${meeting.awayGoals} ${meeting.away}`,
          detail: [meeting.competition, meeting.round].filter(Boolean).join(' · '),
          category: meeting.competition ?? undefined,
        }));
        return <Card key={`balance-${rivalry.rival}`}>
          <View style={styles.header}><SectionHeader title={rivalry.rival} subtitle={rivalry.tier === 'derbi' ? t('club.rivalidades.derby') : t('club.rivalidades.historical')} icon="football-outline" /><ConfidenceBadge label={t('club.rivalidades.confidence')} status={rivalry.status} /></View>
          {balance ? <>
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.text }]}>{balance.played}</Text><Text style={{ color: colors.textMuted }}>{t('club.rivalidades.played')}</Text></View>
              <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.primary }]}>{balance.won}</Text><Text style={{ color: colors.textMuted }}>{t('club.rivalidades.won')}</Text></View>
              <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.textMuted }]}>{balance.drawn}</Text><Text style={{ color: colors.textMuted }}>{t('club.rivalidades.drawn')}</Text></View>
              <View style={styles.stat}><Text style={[styles.statNumber, { color: colors.danger }]}>{balance.lost}</Text><Text style={{ color: colors.textMuted }}>{t('club.rivalidades.lost')}</Text></View>
            </View>
            {resultTotal > 0 ? <View accessibilityLabel={t('club.rivalidades.resultBar')} style={styles.bar}>
              {[{ n: balance.won, color: colors.primary }, { n: balance.drawn, color: colors.textMuted }, { n: balance.lost, color: colors.danger }].map((part) => <View key={part.color} style={{ width: `${(part.n / resultTotal) * 100}%`, height: 8, backgroundColor: part.color }} />)}
            </View> : null}
            <Text style={{ color: colors.textMuted }}>{t('club.rivalidades.goals', { for: balance.goalsFor, against: balance.goalsAgainst, source: balance.source })}</Text>
            {balance.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(balance.sourceUrl!)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('club.rivalidades.source')}</Text></Pressable> : null}
            {meetings.length ? <View style={{ gap: spacing.sm }}><SectionHeader title={t('club.rivalidades.meetings')} icon="time-outline" /><Timeline entries={meetings} filters /></View> : null}
          </> : null}
          {rivalry.facts.length ? <View style={{ gap: spacing.xs }}>{rivalry.facts.map((fact, index) => <View key={`${fact.text}-${index}`} style={{ gap: 2 }}><Text style={{ color: colors.text }}>{fact.text}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>{fact.provenance.source}</Text></View>)}</View> : null}
        </Card>;
      })}
    </View>
  );
}

const styles = {
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: spacing.sm },
  stats: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  stat: { flex: 1, minWidth: 60, alignItems: 'center' as const, gap: 2 },
  statNumber: { fontSize: 24, fontWeight: '900' as const },
  bar: { flexDirection: 'row' as const, overflow: 'hidden' as const, borderRadius: 4 },
};
