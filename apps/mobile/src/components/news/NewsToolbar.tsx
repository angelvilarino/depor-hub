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
import type { NewsGroupT } from '@/data/schemas';
import {
  activeFilterCount,
  GROUP_ORDER,
  type NewsFilters,
  type NewsKindFilter,
} from '@/features/news/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  filters: NewsFilters;
  query: string;
  searching: boolean;
  groups: NewsGroupT[];
  onQueryChange: (value: string) => void;
  onToggleSearch: () => void;
  onKindChange: (kind: NewsKindFilter) => void;
  onToggleGroup: (group: NewsGroupT) => void;
  onClear: () => void;
  onOpenFilters: () => void;
};

export function NewsToolbar({
  filters,
  query,
  searching,
  groups,
  onQueryChange,
  onToggleSearch,
  onKindChange,
  onToggleGroup,
  onClear,
  onOpenFilters,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const active = activeFilterCount(filters);
  const visibleGroups = GROUP_ORDER.filter((group) => groups.includes(group));

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searching ? t('news.searchClose') : t('news.searchOpen')}
          accessibilityState={{ expanded: searching }}
          onPress={onToggleSearch}
          style={styles.iconButton}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.segment}>
          <SegmentedControl
            value={filters.kind}
            onChange={onKindChange}
            options={[
              { value: 'all', label: t('news.kind.all') },
              { value: 'article', label: t('news.kind.article') },
              { value: 'video', label: t('news.kind.video') },
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('news.filters')}
          onPress={onOpenFilters}
          style={styles.iconButton}
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
          {active > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '700' }}>
                {active}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {searching ? (
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel={t('news.searchPlaceholder')}
            autoFocus
            value={query}
            onChangeText={onQueryChange}
            placeholder={t('news.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('news.searchClear')}
              hitSlop={8}
              onPress={() => onQueryChange('')}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {visibleGroups.map((group) => {
          const selected = filters.groups.includes(group);
          return (
            <Pressable
              key={group}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`news.group.${group}`)}
              hitSlop={8}
              onPress={() => onToggleGroup(group)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.onPrimary : colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {t(`news.group.${group}`)}
              </Text>
            </Pressable>
          );
        })}
        {active > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('news.clearFiltersCount', { count: active })}
            hitSlop={8}
            onPress={onClear}
            style={styles.clear}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
              {t('news.clearFiltersCount', { count: active })}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: minTouch,
    height: minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: minTouch,
  },
  input: { flex: 1, fontSize: 15, minHeight: minTouch },
  chips: { gap: spacing.sm, alignItems: 'center' },
  chip: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  clear: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
