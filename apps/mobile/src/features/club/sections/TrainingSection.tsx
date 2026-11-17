import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { HeroHeader, StatCounter } from '@/components/club/Editorial';
import { PosterCard } from '@/components/design/DesignSystem';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { trainingFacts } from '@/features/club/logic';
import { openMapLocation } from '@/features/club/openMap';
import { spacing, text, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Bullets, MutedText, SectionTitle } from './ui';

export function TrainingSection({ club }: { club: ClubT }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [mapFailed, setMapFailed] = useState(false);
  const training = club.trainingCenter;

  if (!training) return <EmptyState message={t('club.training.empty')} />;

  const coordinates = training.coordinates;
  const { facts, notes } = trainingFacts(training.facilities);
  const [lead, ...restFacts] = facts;
  const number = new Intl.NumberFormat(i18n.language);
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
      <HeroHeader title={training.name ?? t('club.sections.training.title')} subtitle={training.location} icon="barbell-outline" />

      {lead ? (
        // D-19: la cifra del proyecto manda; la descripción la acompaña.
        <PosterCard style={styles.poster}>
          <Text style={[styles.eyebrow, { color: colors.poster.accent }]}>{t('club.training.project')}</Text>
          <Text style={[styles.figure, { color: colors.poster.text }]}>
            {number.format(lead.value)}{lead.suffix ?? ''}
          </Text>
          <Text style={[styles.figureLabel, { color: colors.poster.muted }]}>{lead.label}</Text>
          {training.description ? (
            <Text style={[styles.description, { color: colors.poster.muted }]}>{training.description}</Text>
          ) : null}
        </PosterCard>
      ) : (
        <Card>
          {training.description ? (
            <Text style={{ color: colors.text, ...text.bodyLarge }}>{training.description}</Text>
          ) : null}
        </Card>
      )}

      {restFacts.length > 0 ? (
        <View style={styles.stats}>
          {restFacts.map((fact) => (
            <StatCounter
              key={`${fact.value}-${fact.label}`}
              value={fact.value}
              suffix={fact.suffix ?? undefined}
              label={fact.label}
              locale={i18n.language}
            />
          ))}
        </View>
      ) : null}

      {coordinates ? <Button label={t('club.training.openMap')} onPress={() => void openMap()} /> : null}
      {mapFailed ? <MutedText>{t('club.estadio.mapError')}</MutedText> : null}

      {notes.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.training.facilities')}</SectionTitle>
          <Bullets items={notes} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  poster: { gap: spacing.xs },
  eyebrow: { ...text.caption, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  figure: { fontFamily: typography.display, ...text.display },
  figureLabel: { ...text.bodyLarge, fontWeight: '700' },
  description: { ...text.body },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
