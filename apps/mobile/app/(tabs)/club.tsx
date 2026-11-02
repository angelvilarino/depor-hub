import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ClubImage } from '@/components/club/ClubImage';
import { BodyText, Card, Screen } from '@/components/Screen';
import { useClub } from '@/data/queries';
import type { ClubT } from '@/data/schemas';
import { ClubGate } from '@/features/club/ClubGate';
import {
  CLUB_SECTIONS,
  currentCrest,
  formatSeats,
  titleTotal,
  type ClubSectionId,
} from '@/features/club/logic';
import { Bullets, InfoRow, SectionTitle, TagList } from '@/features/club/sections/ui';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function sectionBadge(
  club: ClubT,
  id: ClubSectionId,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): string | null {
  switch (id) {
    case 'himnos':
      return club.anthems.length > 0 ? String(club.anthems.length) : null;
    case 'escudo':
      return club.crests.length > 0 ? String(club.crests.length) : null;
    case 'equipaciones':
      return club.kits.length > 0 ? String(club.kits.length) : null;
    case 'estadio':
      return club.stadium?.capacity
        ? formatSeats(club.stadium.capacity.total, locale)
        : null;
    case 'junta':
      return club.board ? String(club.board.members.length + 1) : null;
    case 'patrocinadores':
      return club.sponsors ? String(club.sponsors.official.length) : null;
    case 'titulos':
      return club.titles.length > 0 ? String(titleTotal(club.titles)) : null;
    case 'rivalidades':
      return club.rivalries.length > 0 ? String(club.rivalries.length) : null;
    case 'redes':
      return t('club.redes.count');
    default:
      return null;
  }
}

export default function ClubScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const query = useClub();

  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <ClubGate query={query}>
        {(club) => {
          const identity = club.identity;
          const crest = currentCrest(club.crests);
          const place = [identity.city, identity.country].filter(Boolean).join(', ');
          const founded = identity.foundedYear
            ? t('club.founded', { year: identity.foundedYear })
            : null;
          const subtitle = [founded, place].filter(Boolean).join(' · ');

          return (
            <>
              <Card>
                <View style={styles.hero}>
                  <ClubImage
                    path={crest?.image}
                    label={t('club.crestLabel')}
                    width={96}
                    height={96}
                    contentFit="contain"
                  />
                  <View style={styles.heroText}>
                    <Text
                      accessibilityRole="header"
                      style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}
                    >
                      {identity.officialName}
                    </Text>
                    {identity.shortName ? (
                      <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                        {identity.shortName}
                      </Text>
                    ) : null}
                    {subtitle ? (
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{subtitle}</Text>
                    ) : null}
                  </View>
                </View>

                {identity.nicknames.length > 0 ? <TagList items={identity.nicknames} /> : null}
                <InfoRow label={t('club.colors')} value={identity.colors.join(' · ')} />
                <InfoRow label={t('club.president')} value={identity.president} />
                <InfoRow label={t('club.headquarters')} value={identity.headquarters} />
              </Card>

              {club.facts.length > 0 ? (
                <Card>
                  <SectionTitle>{t('club.facts')}</SectionTitle>
                  <Bullets items={club.facts} />
                </Card>
              ) : null}

              <Card>
                <SectionTitle>{t('club.explore')}</SectionTitle>
                <View style={{ gap: spacing.xs }}>
                  {CLUB_SECTIONS.map((section) => {
                    const badge = sectionBadge(club, section.id, t, i18n.language);
                    return (
                      <Pressable
                        key={section.id}
                        accessibilityRole="button"
                        accessibilityLabel={t(`club.sections.${section.id}.title`)}
                        onPress={() => router.push(`/club/${section.id}`)}
                        style={[styles.sectionRow, { borderColor: colors.border }]}
                      >
                        <View style={[styles.sectionIcon, { backgroundColor: colors.background }]}>
                          <Ionicons
                            name={section.icon as IconName}
                            size={22}
                            color={colors.primary}
                          />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                            {t(`club.sections.${section.id}.title`)}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                            {t(`club.sections.${section.id}.subtitle`)}
                          </Text>
                        </View>
                        {badge ? (
                          <View style={[styles.badge, { backgroundColor: colors.background }]}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                              {badge}
                            </Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </Card>

              {identity.contact.email || identity.contact.phone ? (
                <Card>
                  <SectionTitle>{t('club.contact')}</SectionTitle>
                  <InfoRow label={t('club.redes.email')} value={identity.contact.email} />
                  <InfoRow label={t('club.redes.phone')} value={identity.contact.phone} />
                  <BodyText muted>{t('common.unofficial')}</BodyText>
                </Card>
              ) : null}
            </>
          );
        }}
      </ClubGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heroText: { flex: 1, gap: 2 },
  sectionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
});
