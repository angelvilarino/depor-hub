import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFilters } from '@/components/news/NewsFilters';
import { SocialBlock } from '@/components/news/SocialBlock';
import type { NewsItemT } from '@/data/schemas';
import { useNews, useSocial, useSources } from '@/data/queries';
import {
  availableSources,
  EMPTY_FILTERS,
  filterNews,
  paginate,
  tagOptions,
  type NewsFilters as Filters,
} from '@/features/news/logic';
import { useNewsRead } from '@/store/news';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const NO_ITEMS: NewsItemT[] = [];

export default function NewsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const news = useNews();
  const social = useSocial();
  const sourcesData = useSources();
  const readIds = useNewsRead((state) => state.readIds);
  const markRead = useNewsRead((state) => state.markRead);
  const markAllRead = useNewsRead((state) => state.markAllRead);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const changeFilters = useCallback((next: Filters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    void news.refetch();
    void social.refetch();
  }, [news, social]);

  const items = news.data?.items ?? NO_ITEMS;
  const filtered = useMemo(() => filterNews(items, filters), [items, filters]);
  const pageData = useMemo(() => paginate(filtered, page), [filtered, page]);
  const sources = useMemo(
    () => availableSources(items, sourcesData.data?.sources ?? null),
    [items, sourcesData.data],
  );
  const tags = useMemo(() => tagOptions(items), [items]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unread = useMemo(
    () => filtered.reduce((count, item) => (readSet.has(item.id) ? count : count + 1), 0),
    [filtered, readSet],
  );

  const banner = (
    <FreshnessBanner
      dataUpdatedAt={news.dataUpdatedAt}
      isFetching={news.isFetching || social.isFetching}
      isError={news.isError}
      maxAgeHours={24}
    />
  );

  if (!news.data && news.isPending) {
    return (
      <Screen refreshing={false}>
        {banner}
        <LoadingState />
      </Screen>
    );
  }

  if (!news.data && news.isError) {
    return (
      <Screen refreshing={false}>
        {banner}
        <ErrorState onRetry={refresh} />
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      {banner}
      <SocialBlock social={social.data ?? null} />
      <NewsFilters
        filters={filters}
        onChange={changeFilters}
        sources={sources}
        tags={tags}
        unread={unread}
        onMarkAllRead={() => markAllRead(filtered.map((item) => item.id))}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={pageData.visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NewsCard
            item={item}
            read={readSet.has(item.id)}
            onPress={(pressed) => markRead(pressed.id)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            message={items.length === 0 ? t('news.emptyAll') : t('news.emptyFiltered')}
            actionLabel={items.length > 0 ? t('news.clearFilters') : undefined}
            onAction={items.length > 0 ? () => changeFilters(EMPTY_FILTERS) : undefined}
          />
        }
        ListFooterComponent={
          pageData.visible.length > 0 ? (
            <View style={styles.footer}>
              {pageData.hasMore ? (
                <Button
                  label={t('news.loadMore', { count: pageData.remaining })}
                  onPress={() => setPage((current) => current + 1)}
                />
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                  {t('news.count', { count: filtered.length })}
                </Text>
              )}
            </View>
          ) : undefined
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={news.isRefetching || social.isRefetching}
        onRefresh={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  footer: { marginTop: spacing.sm, gap: spacing.xs },
});
