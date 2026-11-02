import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { InfoRow, SectionTitle, TagList } from './ui';

export function PatrocinadoresSection({ club }: { club: ClubT }) {
  const { t } = useTranslation();
  const sponsors = club.sponsors;

  if (!sponsors) return <EmptyState message={t('club.patrocinadores.empty')} />;

  const since = sponsors.sinceYear
    ? t('club.patrocinadores.since', { year: sponsors.sinceYear })
    : null;

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionTitle>{t('club.patrocinadores.title')}</SectionTitle>
        <InfoRow label={t('club.patrocinadores.principal')} value={sponsors.principal} />
        <InfoRow label={t('club.patrocinadores.technical')} value={sponsors.technical} />
        <InfoRow label={t('club.patrocinadores.sinceLabel')} value={since} />
      </Card>

      {sponsors.official.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.patrocinadores.official')}</SectionTitle>
          <TagList items={sponsors.official} />
        </Card>
      ) : null}

      {sponsors.collaborators.length > 0 ? (
        <Card>
          <SectionTitle>{t('club.patrocinadores.collaborators')}</SectionTitle>
          <TagList items={sponsors.collaborators} />
        </Card>
      ) : null}
    </View>
  );
}
