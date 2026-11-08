import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText, Card, Screen } from '@/components/Screen';
import { useClub, useRivalries } from '@/data/queries';
import type { ClubT } from '@/data/schemas';
import { ClubGate } from '@/features/club/ClubGate';
import { CLUB_SECTIONS, currentCrest, formatSeats, titleTotal, type ClubSectionId } from '@/features/club/logic';
import { useTheme } from '@/theme/useTheme';
import { spacing, radius } from '@/theme/tokens';
import { clubImageUrl } from '@/config';
import { HeroHeader, SectionHeader, StatCounter, Timeline } from '@/components/club/Editorial';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
function sectionBadge(club: ClubT, id: ClubSectionId, locale: string, rivalryCount: number): string | null {
  switch (id) {
    case 'himnos': return club.anthems.length ? String(club.anthems.length) : null;
    case 'escudo': return club.crests.length ? String(club.crests.length) : null;
    case 'equipaciones': return club.kits.length ? String(club.kits.length) : null;
    case 'estadio': return club.stadium?.capacity ? formatSeats(club.stadium.capacity.total, locale) : null;
    case 'junta': return club.board ? String(club.board.members.length + 1) : null;
    case 'patrocinadores': return club.sponsors ? String(club.sponsors.official.length) : null;
    case 'titulos': return club.titles.length ? String(titleTotal(club.titles)) : null;
    case 'rivalidades': return rivalryCount ? String(rivalryCount) : null;
    case 'redes': return null;
    default: return null;
  }
}

function sectionImage(club: ClubT, id: ClubSectionId): string | null {
  if (id === 'escudo') return clubImageUrl(currentCrest(club.crests)?.image);
  if (id === 'equipaciones') return clubImageUrl(club.kits.at(-1)?.kits[0]?.image);
  return null;
}

export default function ClubScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const query = useClub();
  const rivalriesQuery = useRivalries();

  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <ClubGate query={query}>
        {(club) => {
          const identity = club.identity;
          const crest = currentCrest(club.crests);
          const place = [identity.city, identity.country].filter(Boolean).join(', ');
          const founded = identity.foundedYear ? t('club.founded', { year: identity.foundedYear }) : null;
          const subtitle = [founded, place].filter(Boolean).join(' · ');
          const sectionsTimeline = club.crests.map((item) => ({
            year: String(item.yearFrom),
            title: `${item.yearFrom}–${item.yearTo ?? t('club.present')}`,
            detail: item.description,
            category: t('club.sections.escudo.title'),
          })).slice(-4).reverse();
          const stats = [
            identity.foundedYear ? { value: identity.foundedYear, label: t('club.stats.founded') } : null,
            club.kits.length ? { value: club.kits.length, label: t('club.stats.kitSeasons') } : null,
            titleTotal(club.titles) ? { value: titleTotal(club.titles), label: t('club.stats.titles') } : null,
            club.stadium?.capacity ? { value: club.stadium.capacity.total, label: t('club.stats.capacity') } : null,
          ].filter((item): item is { value: number; label: string } => item !== null);

          return <>
            <HeroHeader title={identity.shortName ?? identity.officialName} subtitle={subtitle} chips={identity.nicknames} icon="shield-outline" emblem={clubImageUrl(crest?.image)} />
            <Text style={[styles.unofficial, { color: colors.textMuted }]}>{t('common.unofficial')}</Text>
            {stats.length ? <View style={styles.stats}>{stats.map((stat) => <StatCounter key={stat.label} value={stat.value} label={stat.label} />)}</View> : null}
            {identity.motto ? <Card><Text style={[styles.motto, { color: colors.text }]}>{identity.motto}</Text></Card> : null}
            <Card>
              <SectionHeader title={t('club.identity')} subtitle={identity.officialName} icon="information-circle-outline" />
              <View style={styles.identityGrid}>
                {identity.colors.length ? <View style={styles.identityItem}><Text style={styles.label}>{t('club.colors')}</Text><Text style={[styles.value, { color: colors.text }]}>{identity.colors.join(' · ')}</Text></View> : null}
                {identity.president ? <View style={styles.identityItem}><Text style={styles.label}>{t('club.president')}</Text><Text style={[styles.value, { color: colors.text }]}>{identity.president}</Text></View> : null}
                {identity.headquarters ? <View style={styles.identityItem}><Text style={styles.label}>{t('club.headquarters')}</Text><Text style={[styles.value, { color: colors.text }]}>{identity.headquarters}</Text></View> : null}
              </View>
            </Card>
            {sectionsTimeline.length ? <Card><SectionHeader title={t('club.timeline')} subtitle={t('club.timelineSubtitle')} icon="time-outline" /><Timeline entries={sectionsTimeline} /></Card> : null}
            <Card>
              <SectionHeader title={t('club.explore')} subtitle={t('club.exploreSubtitle')} icon="compass-outline" />
              <View style={styles.sectionGrid}>
                {CLUB_SECTIONS.map((section) => {
                  const badge = sectionBadge(club, section.id, i18n.language, rivalriesQuery.data?.rivalries.length ?? club.rivalries.length);
                  const image = sectionImage(club, section.id);
                  return <Pressable key={section.id} accessibilityRole="button" accessibilityLabel={t(`club.sections.${section.id}.title`)} onPress={() => router.push(`/club/${section.id}`)} style={[styles.sectionTile, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.tileArtwork}>
                      {image ? <View style={StyleSheet.absoluteFill}><ClubTileImage uri={image} /></View> : null}
                      <View style={styles.tileIcon}><Ionicons name={section.icon as IconName} size={24} color={colors.primary} /></View>
                      {badge ? <View style={[styles.tileBadge, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>{badge}</Text></View> : null}
                    </View>
                    <Text style={[styles.tileTitle, { color: colors.text }]}>{t(`club.sections.${section.id}.title`)}</Text>
                    <Text numberOfLines={2} style={[styles.tileSubtitle, { color: colors.textMuted }]}>{t(`club.sections.${section.id}.subtitle`)}</Text>
                  </Pressable>;
                })}
              </View>
            </Card>
            {club.facts.length ? <Card><SectionHeader title={t('club.facts')} icon="book-outline" />{club.facts.map((fact) => <BodyText key={fact}>{fact}</BodyText>)}</Card> : null}
            {identity.contact.email || identity.contact.phone ? <Card><SectionHeader title={t('club.contact')} icon="call-outline" />{identity.contact.email ? <Text style={[styles.value, { color: colors.text }]}>{identity.contact.email}</Text> : null}{identity.contact.phone ? <Text style={[styles.value, { color: colors.text }]}>{identity.contact.phone}</Text> : null}</Card> : null}
          </>;
        }}
      </ClubGate>
    </Screen>
  );
}

function ClubTileImage({ uri }: { uri: string }) {
  return <Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} />;
}

const styles = StyleSheet.create({
  unofficial: { fontSize: 12, lineHeight: 17 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  motto: { fontFamily: 'SourceSerif4-SemiBold', fontSize: 20, textAlign: 'center' },
  identityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, identityItem: { minWidth: '42%', flexGrow: 1, gap: 2 }, label: { color: '#64748B', fontSize: 12, fontWeight: '700' }, value: { fontSize: 15 },
  sectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, sectionTile: { width: '47%', minHeight: 150, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: spacing.sm, gap: 4 }, tileArtwork: { height: 66, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderRadius: radius.sm }, tileIcon: { width: 44, height: 44, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.88)' }, tileBadge: { position: 'absolute', right: 5, top: 5, minWidth: 28, height: 28, borderRadius: radius.pill, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 }, tileTitle: { fontSize: 16, fontWeight: '800' }, tileSubtitle: { fontSize: 12, lineHeight: 16 },
});
