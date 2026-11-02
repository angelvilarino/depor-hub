import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/StateViews';
import { useClub } from '@/data/queries';
import { AnthemDetail } from '@/features/club/AnthemDetail';
import { ClubGate } from '@/features/club/ClubGate';

export default function AnthemScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const query = useClub();
  const anthem = query.data?.anthems.find((item) => item.id === id) ?? null;
  const title = anthem?.title ?? t('club.sections.himnos.title');

  return (
    <Screen>
      <Stack.Screen options={{ title, headerBackTitle: t('club.sections.himnos.title') }} />
      <ClubGate query={query}>
        {(club) => {
          const current = club.anthems.find((item) => item.id === id) ?? null;
          return current ? (
            <AnthemDetail anthem={current} />
          ) : (
            <EmptyState message={t('club.himnos.notFound')} />
          );
        }}
      </ClubGate>
    </Screen>
  );
}
