import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { InfoRow, SectionTitle } from './ui';

export function RivalidadesSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (club.rivalries.length === 0) {
    return <EmptyState message={t('club.rivalidades.empty')} />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      {club.rivalries.map((rivalry) => {
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
    </View>
  );
}
