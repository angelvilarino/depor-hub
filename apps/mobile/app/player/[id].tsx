import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlayerPortrait } from '@/components/PlayerPortrait';
import { BodyText, Card, Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useSquad } from '@/data/queries';
import type { CareerEntryT, ConfidenceT, PlayerT } from '@/data/schemas';
import { countryLabel } from '@/features/squad/labels';
import {
  ageFrom,
  careerChronological,
  formatEuro,
  formatPartialDate,
  hasCareerTotals,
  matchScore,
  pendingFields,
  positionGroup,
  provenanceSummary,
  seasonRange,
  socialLinks,
  summarizeMatches,
} from '@/features/squad/logic';
import { radius, spacing } from '@/theme/tokens';
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

type Provenance = PlayerT['provenance'];
type Summary = { sources: string[]; confidence: ConfidenceT };

function SourceNote({ summary }: { summary: Summary | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!summary) return null;
  return (
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
      {t('player.sourceLine', {
        sources: summary.sources.join(', '),
        confidence: t(`player.confidence.${summary.confidence}`),
      })}
    </Text>
  );
}

function Stats({
  values,
}: {
  values: { key: string; label: string; value: number | null }[];
}) {
  const { colors } = useTheme();
  const present = values.filter((item) => item.value !== null);
  if (present.length === 0) return null;
  return (
    <View style={styles.stats}>
      {present.map((item) => (
        <View key={item.key} style={styles.stat}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{item.value}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function seasonLine(entry: CareerEntryT, t: TFunction) {
  return entry.seasons
    .map((season) => {
      const parts = [
        season.appearances !== null ? `${season.appearances} ${t('player.stats.appearancesShort')}` : null,
        season.goals !== null ? `${season.goals} ${t('player.stats.goalsShort')}` : null,
        season.assists !== null ? `${season.assists} ${t('player.stats.assistsShort')}` : null,
        season.minutes !== null ? `${season.minutes} ${t('player.stats.minutesShort')}` : null,
      ].filter(Boolean);
      return parts.length > 0 ? `${season.season} · ${parts.join(' · ')}` : season.season;
    })
    .join('\n');
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
  const provenance: Provenance = player.provenance;
  const career = careerChronological(player.career);
  const totals = player.careerTotals;
  const matches = player.deporMatches;
  const matchSummary = summarizeMatches(matches);
  const social = socialLinks(player.social);
  const marketValue = formatEuro(player.marketValueEur, locale);
  const bioProvenance = provenanceSummary(provenance, [
    'shirtNumber',
    'contractUntil',
    'heightCm',
    'weightKg',
    'birthPlace',
    'preferredFoot',
    'loanFrom',
    'loanTo',
    'marketValueEur',
  ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: player.name }} />
      <Card>
        <View style={styles.hero}>
          <PlayerPortrait player={player} size={72} />
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

      {(player.photos?.length ?? 0) > 0 && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.photosTitle')}
          </Text>
          {(player.photos ?? []).map((photo, index) => {
            const attribution = photo.credit ?? photo.author;
            const author = photo.author && photo.credit && photo.author !== photo.credit ? photo.author : null;
            const sourceUrl = photo.sourceUrl;
            return (
              <View key={`${photo.url}-${index}`} style={styles.photoBlock}>
                <Image
                  accessible
                  accessibilityLabel={`${player.name} · ${index + 1}`}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: photo.url }}
                  style={[styles.photo, { backgroundColor: colors.border }]}
                  transition={150}
                />
                {attribution ? (
                  <Text style={{ color: colors.text, fontSize: 12 }}>{attribution}</Text>
                ) : null}
                {author ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {t('player.photoAuthor', { author })}
                  </Text>
                ) : null}
                {photo.license ? (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {t('player.photoLicense', { license: photo.license })}
                  </Text>
                ) : null}
                {sourceUrl ? (
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(sourceUrl)}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {t('player.photoSource')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('player.photoNote')}</Text>
          <SourceNote summary={provenanceSummary(provenance, ['photos'])} />
        </Card>
      )}

      <Card>
        <InfoRow label={t('player.position')} value={positionLabel} />
        <InfoRow
          label={t('player.nationality')}
          value={player.nationality ? countryLabel(t, player.nationality) : null}
        />
        <InfoRow label={t('player.birth')} value={birth} />
        <InfoRow label={t('player.birthPlace')} value={player.birthPlace} />
        <InfoRow label={t('player.age')} value={age !== null ? t('player.ageValue', { n: age }) : null} />
        <InfoRow label={t('player.height')} value={height !== null ? t('player.heightValue', { n: height }) : null} />
        <InfoRow
          label={t('player.weight')}
          value={player.weightKg !== null ? t('player.weightValue', { n: player.weightKg }) : null}
        />
        <InfoRow
          label={t('player.preferredFoot')}
          value={player.preferredFoot ? t(`player.foot.${player.preferredFoot}`) : null}
        />
        <InfoRow label={t('player.contract')} value={formatPartialDate(player.contractUntil, locale)} />
        <InfoRow label={t('player.loanFrom')} value={player.loanFrom} />
        <InfoRow label={t('player.loanTo')} value={player.loanTo} />
        <InfoRow
          label={t('player.marketValue')}
          value={marketValue ? `${marketValue} · ${t('player.estimated')}` : null}
        />
        <SourceNote summary={bioProvenance} />
      </Card>

      {social.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.socialTitle')}
          </Text>
          <View style={styles.socialRow}>
            {social.map((link) => (
              <Pressable
                key={link.network}
                accessibilityRole="link"
                accessibilityLabel={`${t(`player.social.${link.network}`)} @${link.handle}`}
                onPress={() => void Linking.openURL(link.url)}
                style={[styles.socialButton, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                  {t(`player.social.${link.network}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <SourceNote summary={provenanceSummary(provenance, ['social'])} />
        </Card>
      )}

      {hasCareerTotals(totals) && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.careerTotalsTitle')}
          </Text>
          <Stats
            values={[
              { key: 'appearances', label: t('player.stats.appearances'), value: totals.appearances },
              { key: 'goals', label: t('player.stats.goals'), value: totals.goals },
              { key: 'assists', label: t('player.stats.assists'), value: totals.assists },
              { key: 'minutes', label: t('player.stats.minutes'), value: totals.minutes },
              { key: 'yellowCards', label: t('player.stats.yellowCards'), value: totals.yellowCards },
              { key: 'redCards', label: t('player.stats.redCards'), value: totals.redCards },
            ]}
          />
          <SourceNote summary={provenanceSummary(provenance, ['careerTotals'])} />
        </Card>
      )}

      {career.length > 0 && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.careerTitle')}
          </Text>
          {career.map((entry, index) => {
            const range = seasonRange(entry.from, entry.to);
            const line = seasonLine(entry, t);
            return (
              <View
                key={`${entry.club}-${entry.from ?? index}`}
                style={[styles.careerEntry, { borderTopColor: colors.border }]}
              >
                <View style={styles.careerHead}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 }}>{entry.club}</Text>
                  {range ? <Text style={{ color: colors.textMuted, fontSize: 14 }}>{range}</Text> : null}
                </View>
                <Stats
                  values={[
                    { key: 'appearances', label: t('player.stats.appearancesShort'), value: entry.appearances },
                    { key: 'goals', label: t('player.stats.goalsShort'), value: entry.goals },
                    { key: 'assists', label: t('player.stats.assistsShort'), value: entry.assists },
                    { key: 'minutes', label: t('player.stats.minutesShort'), value: entry.minutes },
                  ]}
                />
                {line ? (
                  <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>{line}</Text>
                ) : null}
              </View>
            );
          })}
          <SourceNote summary={provenanceSummary(provenance, ['career'])} />
        </Card>
      )}

      {matchSummary && (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {t('player.deporMatchesTitle')}
          </Text>
          <Stats
            values={[
              {
                key: 'appearances',
                label: t('player.stats.appearancesShort'),
                value: matchSummary.appearances,
              },
              { key: 'goals', label: t('player.stats.goalsShort'), value: matchSummary.goals },
              { key: 'assists', label: t('player.stats.assistsShort'), value: matchSummary.assists },
              { key: 'minutes', label: t('player.stats.minutesShort'), value: matchSummary.minutes },
              {
                key: 'yellowCards',
                label: t('player.stats.yellowCardsShort'),
                value: matchSummary.yellowCards,
              },
              { key: 'redCards', label: t('player.stats.redCardsShort'), value: matchSummary.redCards },
            ]}
          />
          {matches.map((match) => {
            const score = matchScore(match);
            const details = [
              match.home ? t('player.matchHome') : t('player.matchAway'),
              score,
              match.minutes !== null ? `${match.minutes}'` : null,
              match.goals !== null && match.goals > 0 ? `${match.goals} ${t('player.stats.goalsShort')}` : null,
              match.assists !== null && match.assists > 0 ? `${match.assists} ${t('player.stats.assistsShort')}` : null,
              match.yellowCards !== null && match.yellowCards > 0
                ? `${match.yellowCards} ${t('player.stats.yellowCardsShort')}`
                : null,
              match.redCards !== null && match.redCards > 0
                ? `${match.redCards} ${t('player.stats.redCardsShort')}`
                : null,
            ].filter(Boolean);
            return (
              <View key={`${match.date}-${match.opponent}`} style={styles.matchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    {formatPartialDate(match.date, locale)} · {match.opponent}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{details.join(' · ')}</Text>
                </View>
              </View>
            );
          })}
          <SourceNote summary={provenanceSummary(provenance, ['deporMatches'])} />
        </Card>
      )}

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
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { minWidth: 64, gap: 1 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  socialButton: { borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 12 },
  careerEntry: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  careerHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  matchRow: { flexDirection: 'row', gap: spacing.sm },
  photoBlock: { gap: spacing.xs },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md },
});
