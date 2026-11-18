import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { HeroHeader, MapActions, PhotoGallery, StatCounter } from '@/components/club/Editorial';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { formatPrice, museumPieces } from '@/features/club/logic';
import { radius, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';
import { InfoRow, MutedText, SectionTitle } from './ui';

export function MuseoSection({ club }: { club: ClubT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const museum = club.museum;

  if (!museum) return <EmptyState message={t('club.museo.empty')} />;

  const verifiedPhotos = museum.media.filter(
    (media) => media.kind === 'photo' && media.status === 'verified',
  );
  const pieces = museumPieces(museum.description);
  const visitLink =
    museum.links.find((link) => /entrada|ticket/i.test(`${link.id} ${link.label}`)) ?? null;

  return (
    <View style={{ gap: spacing.md }}>
      <HeroHeader
        title={museum.name ?? t('club.sections.museo.title')}
        subtitle={museum.location}
        icon="business-outline"
        image={verifiedPhotos[0]?.url}
        credit={verifiedPhotos[0]}
      />
      <PhotoGallery photos={verifiedPhotos} />

      {pieces !== null ? (
        <View style={styles.stats}>
          <StatCounter value={pieces} label={t('club.museo.pieces')} locale={i18n.language} />
        </View>
      ) : null}

      <Card>
        <SectionTitle>{t('club.museo.visit')}</SectionTitle>
        {museum.description ? (
          <Text style={{ color: colors.text, ...text.bodyLarge }}>{museum.description}</Text>
        ) : null}
        {museum.schedule ? (
          <InfoRow label={t('club.museo.schedule')} value={museum.schedule} />
        ) : (
          <MutedText>{t('club.museo.schedulePending')}</MutedText>
        )}
        {club.stadium?.coordinates ? (
          <MapActions
            latitude={club.stadium.coordinates.lat}
            longitude={club.stadium.coordinates.lon}
            label={museum.name ?? t('club.sections.museo.title')}
          />
        ) : null}
        {visitLink ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={visitLink.label}
            onPress={() => void openExternal(visitLink.url)}
            style={styles.primaryLink}
          >
            <Ionicons name="ticket-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, ...text.bodyLarge, fontWeight: '700', flex: 1 }}>
              {visitLink.label}
            </Text>
            <Ionicons name="open-outline" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </Card>

      {museum.prices.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.museo.prices')}</SectionTitle>
          {museum.prices.map((price) => (
            <View key={price.label} style={{ gap: spacing.xs }}>
              <View style={styles.row}>
                <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '600', flex: 1 }}>
                  {price.label}
                </Text>
                {price.priceEur !== null ? (
                  <Text style={{ color: colors.text, ...text.bodyLarge, fontWeight: '700' }}>
                    {formatPrice(price.priceEur, i18n.language)}
                  </Text>
                ) : null}
              </View>
              {price.note ? <MutedText>{price.note}</MutedText> : null}
            </View>
          ))}
        </Card>
      ) : null}

      {museum.links.length > 1 ? (
        <Card>
          <SectionTitle>{t('club.museo.links')}</SectionTitle>
          {museum.links
            .filter((link) => link.id !== visitLink?.id)
            .map((link) => (
              <Pressable
                key={link.id}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                onPress={() => void openExternal(link.url)}
                style={styles.link}
              >
                <Text
                  style={{ color: colors.primary, ...text.bodyLarge, fontWeight: '600', flex: 1 }}
                >
                  {link.label}
                </Text>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </Pressable>
            ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  primaryLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
});
