import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import type { ClubT } from '@/data/schemas';

type ClubQuery = {
  data?: ClubT | null;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => unknown;
};

/**
 * Estado común de las pantallas del Club: carga, error con reintento, contrato
 * ausente (404 tolerado) y aviso de caché/offline. El contenido solo se pinta con
 * datos válidos.
 */
export function ClubGate({
  query,
  children,
}: {
  query: ClubQuery;
  children: (club: ClubT) => ReactNode;
}) {
  const { t } = useTranslation();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (!query.data) return <EmptyState message={t('club.empty')} />;

  return (
    <Fragment>
      <FreshnessBanner
        dataUpdatedAt={query.dataUpdatedAt}
        isFetching={query.isFetching}
        isError={query.isError}
      />
      {children(query.data)}
    </Fragment>
  );
}
