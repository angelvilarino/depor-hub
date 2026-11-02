import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { openMapLocation } from '@/features/club/openMap';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Bullets, InfoRow, MutedText, SectionTitle } from './ui';

export function TrainingSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [mapFailed, setMapFailed] = useState(false);
  const training = club.trainingCenter;

  if (!training) return <EmptyState message={t('club.training.empty')} />;

  const coordinates = training.coordinates;
  const openMap = async () => {
    if (!coordinates) return;
    const opened = await openMapLocation(
      coordinates.lat,
      coordinates.lon,
      training.location ?? training.name ?? t('club.sections.training.title'),
    );
    if (!opened) {
      setMapFailed(true);
      Alert.alert(t('club.estadio.mapError'));
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionTitle>{training.name ?? t('club.sections.training.title')}</SectionTitle>
        {training.description ? (
          <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>
            {training.description}
          </Text>
        ) : null}
        <InfoRow label={t('club.training.location')} value={training.location} />
        {coordinates ? (
          <Button label={t('club.training.openMap')} onPress={() => void openMap()} />
        ) : null}
        {mapFailed ? <MutedText>{t('club.estadio.mapError')}</MutedText> : null}
      </Card>

      {training.facilities.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.training.facilities')}</SectionTitle>
          <Bullets items={training.facilities} />
        </Card>
      ) : null}
    </View>
  );
}
