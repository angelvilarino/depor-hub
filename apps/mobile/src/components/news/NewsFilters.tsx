import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { NewsKindFilter, NewsFilters as Filters, SourceOption } from '@/features/news/logic';
import { hasActiveFilters } from '@/features/news/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { tagLabel } from './NewsCard';

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  sources: SourceOption[];
  tags: { tag: string; items: number }[];
  unread: number;
  onMarkAllRead: () => void;
};

export function NewsFilters({
  filters,
  onChange,
  sources,
  tags,
  unread,
  onMarkAllRead,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const active = hasActiveFilters(filters);

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    accessibilityLabel?: string,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: selected ? colors.onPrimary : colors.text, fontSize: 13, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={filters.text}
          onChangeText={(text) => onChange({ ...filters, text })}
          placeholder={t('news.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('news.searchPlaceholder')}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, { color: colors.text }]}
        />
        {filters.text ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('news.searchClear')}
            onPress={() => onChange({ ...filters, text: '' })}
            hitSlop={8}
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <SegmentedControl<NewsKindFilter>
        value={filters.kind}
        onChange={(kind) => onChange({ ...filters, kind })}
        options={[
          { value: 'all', label: t('news.kind.all') },
          { value: 'article', label: t('news.kind.article') },
          { value: 'video', label: t('news.kind.video') },
        ]}
      />

      {sources.length > 0 ? (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textMuted }]}>
            {t('news.sources')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {chip('all-sources', t('news.allSources'), filters.sourceId === null, () =>
              onChange({ ...filters, sourceId: null }),
            )}
            {sources.map((source) =>
              chip(
                source.id,
                source.name,
                filters.sourceId === source.id,
                () =>
                  onChange({
                    ...filters,
                    sourceId: filters.sourceId === source.id ? null : source.id,
                  }),
                t('news.filterSource', { source: source.name, count: source.items }),
              ),
            )}
          </ScrollView>
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textMuted }]}>
            {t('news.tagsTitle')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {chip('all-tags', t('news.allTags'), filters.tag === null, () =>
              onChange({ ...filters, tag: null }),
            )}
            {tags.map(({ tag, items }) =>
              chip(
                tag,
                t(`news.tags.${tag}`, { defaultValue: tagLabel(tag) }),
                filters.tag === tag,
                () => onChange({ ...filters, tag: filters.tag === tag ? null : tag }),
                t('news.filterTag', {
                  tag: t(`news.tags.${tag}`, { defaultValue: tagLabel(tag) }),
                  count: items,
                }),
              ),
            )}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.actions}>
        {active ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange({ text: '', kind: 'all', sourceId: null, tag: null })}
            style={styles.action}
          >
            <Ionicons name="close" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
              {t('news.clearFilters')}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        {unread > 0 ? (
          <Pressable accessibilityRole="button" onPress={onMarkAllRead} style={styles.action}>
            <Ionicons name="checkmark-done" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
              {t('news.markAllRead', { count: unread })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouch,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  clear: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.xs },
  groupTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  row: { gap: spacing.xs, paddingRight: spacing.md },
  chip: {
    minHeight: 36,
    maxWidth: 220,
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 36,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: minTouch },
});
