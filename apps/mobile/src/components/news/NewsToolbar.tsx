import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '@/components/Pressable';
import { useTranslation } from 'react-i18next';
import { activeFilterCount, type NewsFilters } from '@/features/news/logic';
import { minTouch, radius, spacing, text } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  filters: NewsFilters;
  query: string;
  searching: boolean;
  onQueryChange: (value: string) => void;
  onToggleSearch: () => void;
  onOpenFilters: () => void;
};

export function NewsToolbar({
  filters,
  query,
  searching,
  onQueryChange,
  onToggleSearch,
  onOpenFilters,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const active = activeFilterCount(filters);

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
        <Text numberOfLines={1} style={{ color: colors.text, flex: 1, ...text.title, fontWeight: '700' }}>
          {t('tabs.news')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('news.filters')}
          onPress={onOpenFilters}
          style={styles.iconButton}
        >
          <Ionicons name="options-outline" size={22} color={colors.text} />
          {active > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, ...text.caption, fontWeight: '700' }}>
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
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
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
  input: { flex: 1, ...text.bodyLarge, minHeight: minTouch },
});
