import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { HeroHeader, PhotoGallery } from '@/components/club/Editorial';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { capacityShare, formatDate, formatSeats } from '@/features/club/logic';
import { openMapLocation } from '@/features/club/openMap';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Bullets, InfoRow, MutedText, SectionTitle } from './ui';

export function EstadioSection({ club }: { club: ClubT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [mapFailed, setMapFailed] = useState(false);
  const stadium = club.stadium;

  if (!stadium) return <EmptyState message={t('club.estadio.empty')} />;

  const locale = i18n.language;
  const opened = formatDate(stadium.openedOn, locale);
  const capacity = stadium.capacity;
  const total = capacity ? formatSeats(capacity.total, locale) : null;
  const coordinates = stadium.coordinates;
  const verifiedPhotos = stadium.media.filter((media) => media.kind === 'photo' && media.status === 'verified');

  const openMap = async () => {
    if (!coordinates) return;
    const opened = await openMapLocation(coordinates.lat, coordinates.lon, stadium.name);
    if (!opened) {
      setMapFailed(true);
      Alert.alert(t('club.estadio.mapError'));
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <HeroHeader title={stadium.name} subtitle={stadium.address} icon="football-outline" image={verifiedPhotos[0]?.url} credit={verifiedPhotos[0]} />
      <PhotoGallery photos={verifiedPhotos} />
      <Card>
        {stadium.description ? (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            {stadium.description}
          </Text>
        ) : null}
        <InfoRow label={t('club.estadio.address')} value={stadium.address} />
        <InfoRow label={t('club.estadio.opened')} value={opened} />
        <InfoRow label={t('club.estadio.pitch')} value={stadium.pitch} />
        <InfoRow label={t('club.estadio.dimensions')} value={stadium.dimensions} />
        {coordinates ? (
          <Button label={t('club.estadio.openMap')} onPress={() => void openMap()} />
        ) : null}
        {mapFailed ? <MutedText>{t('club.estadio.mapError')}</MutedText> : null}
      </Card>

      <Card>
        <SectionTitle>{t('club.estadio.capacity')}</SectionTitle>
        {capacity ? (
          <View style={{ gap: spacing.md }}>
            <Text
              accessibilityLabel={t('club.estadio.capacityTotal', { seats: total ?? '' })}
              style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}
            >
              {total}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {t('club.estadio.capacityTotal', { seats: total ?? '' })}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {capacity.breakdown.map((zone) => {
                const share = capacityShare(zone.seats, capacity.total);
                return (
                  <View key={zone.zone} style={{ gap: spacing.xs }}>
                    <View style={styles.zoneRow}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                        {zone.zone}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                        {t('club.estadio.zoneValue', {
                          seats: formatSeats(zone.seats, locale),
                          share: Math.round(share),
                        })}
                      </Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: colors.background }]}>
                      <View
                        style={[styles.barFill, { backgroundColor: colors.primary, width: `${share}%` }]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t('club.estadio.capacityNote')}
            </Text>
          </View>
        ) : (
          <MutedText>{t('club.estadio.noCapacity')}</MutedText>
        )}
      </Card>

      {stadium.renovations.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.estadio.renovations')}</SectionTitle>
          <Bullets items={stadium.renovations} />
        </Card>
      ) : null}

      {stadium.access || stadium.transport || stadium.parking ? (
        <Card>
          <SectionTitle>{t('club.estadio.visit')}</SectionTitle>
          <InfoRow label={t('club.estadio.access')} value={stadium.access} />
          <InfoRow label={t('club.estadio.transport')} value={stadium.transport} />
          <InfoRow label={t('club.estadio.parking')} value={stadium.parking} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
