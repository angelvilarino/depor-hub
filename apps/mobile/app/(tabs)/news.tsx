import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FreshnessBanner } from '@/components/FreshnessBanner';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { NewsFiltersSheet } from '@/components/news/NewsFiltersSheet';
import { NewsStoryCard } from '@/components/news/NewsStoryCard';
import { NewsToolbar } from '@/components/news/NewsToolbar';
import type { NewsGroupT, NewsSourceT, NewsStoryT } from '@/data/schemas';
import { useNews } from '@/data/queries';
import {
  activeFilterCount,
  countLabel,
  EMPTY_FILTERS,
  filterNews,
  groupByDay,
  sourceOptions,
  tagOptions,
  todayKey,
  unreadCount,
  type NewsFilters,
  type NewsKindFilter,
  type NewsSection,
} from '@/features/news/logic';
import { useNow } from '@/features/home/useNow';
import { useNewsRead } from '@/store/news';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

const NO_STORIES: NewsStoryT[] = [];
const NO_SOURCES: NewsSourceT[] = [];

function useDebounced(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function yesterdayKey(now: number): string {
  return todayKey(now - 24 * 60 * 60 * 1000);
}

function dayLabel(
  section: NewsSection,
  language: string,
  now: number,
  t: (key: string) => string,
): string {
  if (section.key === todayKey(now)) return t('news.today');
  if (section.key === yesterdayKey(now)) return t('news.yesterday');
  return new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  }).format(new Date(section.date));
}

export default function NewsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const news = useNews();
  const readIds = useNewsRead((state) => state.readIds);
  const markRead = useNewsRead((state) => state.markRead);
  const markAllRead = useNewsRead((state) => state.markAllRead);
  const restoreRead = useNewsRead((state) => state.restoreRead);
  const pruneRead = useNewsRead((state) => state.pruneRead);

  const [filters, setFilters] = useState<NewsFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [undo, setUndo] = useState<{ ids: string[]; count: number } | null>(null);
  const debouncedQuery = useDebounced(query);

  const stories = news.data?.stories ?? NO_STORIES;
  const sources = news.data?.sources ?? NO_SOURCES;
  const effectiveFilters = useMemo(
    () => ({ ...filters, text: debouncedQuery }),
    [filters, debouncedQuery],
  );
  const filtered = useMemo(
    () => filterNews(stories, effectiveFilters, sources),
    [stories, effectiveFilters, sources],
  );
  const sections = useMemo(() => groupByDay(filtered), [filtered]);
  const sourceList = useMemo(() => sourceOptions(stories, sources), [stories, sources]);
  const tags = useMemo(() => tagOptions(stories), [stories]);
  const groups = useMemo(
    () => Array.from(new Set(sources.map((source) => source.group))),
    [sources],
  );
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unread = useMemo(() => unreadCount(filtered, readIds), [filtered, readIds]);
  const now = useNow(60_000);

  useEffect(() => {
    if (stories.length > 0) pruneRead(stories.map((story) => story.id));
  }, [stories, pruneRead]);

  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(id);
  }, [undo]);

  const refresh = useCallback(() => {
    void news.refetch();
  }, [news]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setQuery('');
  }, []);

  const toggleGroup = useCallback((group: NewsGroupT) => {
    setFilters((current) => ({
      ...current,
      groups: current.groups.includes(group)
        ? current.groups.filter((item) => item !== group)
        : [...current.groups, group],
    }));
  }, []);

  const toggleKind = useCallback((kind: NewsKindFilter) => {
    setFilters((current) => ({ ...current, kind }));
  }, []);

  const toggleSource = useCallback((id: string) => {
    setFilters((current) => ({
      ...current,
      sourceIds: current.sourceIds.includes(id)
        ? current.sourceIds.filter((item) => item !== id)
        : [...current.sourceIds, id],
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag],
    }));
  }, []);

  const openStory = useCallback(
    async (story: NewsStoryT) => {
      markRead(story.id);
      const ok = await openExternal(story.url);
      if (!ok) Alert.alert(t('news.openError'));
    },
    [markRead, t],
  );

  const confirmMarkAll = useCallback(() => {
    if (unread === 0) return;
    Alert.alert(
      t('news.markAllTitle'),
      t('news.markAllMessage', { count: unread }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('news.markAllConfirm'),
          onPress: () => {
            const snapshot = readIds;
            markAllRead(filtered.map((story) => story.id));
            setUndo({ ids: snapshot, count: unread });
          },
        },
      ],
    );
  }, [filtered, markAllRead, readIds, t, unread]);

  const undoMarkAll = useCallback(() => {
    if (!undo) return;
    restoreRead(undo.ids);
    setUndo(null);
  }, [restoreRead, undo]);

  const banner = (
    <FreshnessBanner
      dataUpdatedAt={news.dataUpdatedAt}
      isFetching={news.isFetching}
      isError={news.isError}
      maxAgeHours={12}
    />
  );

  if (!news.data && news.isPending) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.state}>
          {banner}
          <LoadingState />
        </View>
      </View>
    );
  }

  if (!news.data && news.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.state}>
          {banner}
          <ErrorState onRetry={refresh} />
        </View>
      </View>
    );
  }

  const active = activeFilterCount(effectiveFilters);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <NewsToolbar
        filters={effectiveFilters}
        query={query}
        searching={searching}
        groups={groups}
        onQueryChange={setQuery}
        onToggleSearch={() => {
          setSearching((value) => {
            if (value) setQuery('');
            return !value;
          });
        }}
        onKindChange={toggleKind}
        onToggleGroup={toggleGroup}
        onClear={clearFilters}
        onOpenFilters={() => setSheetOpen(true)}
      />
      <SectionList
        sections={sections}
        keyExtractor={(story) => story.id}
        renderItem={({ item }) => (
          <NewsStoryCard
            story={item}
            sources={sources}
            read={readSet.has(item.id)}
            onOpen={openStory}
            onTag={toggleTag}
            now={now}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.dayHeader, { backgroundColor: colors.background }]}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              {dayLabel(section, i18n.language, now, t)}
            </Text>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            {banner}
            <View style={styles.summary}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
                {t('news.count', { count: filtered.length })}
              </Text>
              {unread > 0 ? (
                <View style={[styles.unreadPill, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                    {t('news.unreadCount', { count: countLabel(unread) })}
                  </Text>
                </View>
              ) : null}
              {unread > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('news.markAllTitle')}
                  hitSlop={8}
                  onPress={confirmMarkAll}
                  style={styles.markAll}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                    {t('news.markAllShort')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {active > 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {t('news.activeFilters', { count: active })}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            message={stories.length === 0 ? t('news.emptyAll') : t('news.emptyFiltered')}
            actionLabel={active > 0 ? t('news.clearFilters') : undefined}
            onAction={active > 0 ? clearFilters : undefined}
          />
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                textAlign: 'center',
                paddingVertical: spacing.md,
              }}
            >
              {t('news.count', { count: filtered.length })}
            </Text>
          ) : undefined
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled
        refreshing={news.isRefetching}
        onRefresh={refresh}
      />

      {undo ? (
        <View style={[styles.undo, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.background, flex: 1, fontSize: 14 }}>
            {t('news.markedCount', { count: undo.count })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('news.undo')}
            onPress={undoMarkAll}
            style={styles.undoButton}
          >
            <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>
              {t('news.undo')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <NewsFiltersSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        sources={sourceList}
        tags={tags}
        filters={effectiveFilters}
        onToggleSource={toggleSource}
        onToggleTag={toggleTag}
        onClear={clearFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  state: { padding: spacing.md, gap: spacing.md },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouch },
  unreadPill: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  markAll: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  dayHeader: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  undo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  undoButton: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
