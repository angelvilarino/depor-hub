import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import type { NewsFilters, SourceOption } from '@/features/news/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  sources: SourceOption[];
  tags: { tag: string; items: number }[];
  filters: NewsFilters;
  onToggleSource: (id: string) => void;
  onToggleTag: (tag: string) => void;
  onClear: () => void;
};

export function NewsFiltersSheet({
  visible,
  onClose,
  sources,
  tags,
  filters,
  onToggleSource,
  onToggleTag,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {t('news.filtersTitle')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.heading, { color: colors.textMuted }]}>
              {t('news.sources')}
            </Text>
            {sources.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('news.noSources')}</Text>
            ) : (
              sources.map((source) => {
                const checked = filters.sourceIds.includes(source.id);
                return (
                  <Pressable
                    key={source.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={t('news.filterSource', {
                      source: source.name,
                      count: source.items,
                    })}
                    onPress={() => onToggleSource(source.id)}
                    style={styles.option}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.primary : colors.textMuted}
                    />
                    <Text style={{ color: colors.text, flex: 1, fontSize: 15 }}>
                      {source.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                      {source.items}
                    </Text>
                  </Pressable>
                );
              })
            )}

            <Text style={[styles.heading, { color: colors.textMuted }]}>
              {t('news.tagsTitle')}
            </Text>
            {tags.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('news.noTags')}</Text>
            ) : (
              tags.map(({ tag, items }) => {
                const checked = filters.tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={t('news.filterTag', {
                      tag: t(`news.tags.${tag}`),
                      count: items,
                    })}
                    onPress={() => onToggleTag(tag)}
                    style={styles.option}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.primary : colors.textMuted}
                    />
                    <Text style={{ color: colors.text, flex: 1, fontSize: 15 }}>
                      {t(`news.tags.${tag}`)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{items}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={[styles.footer, { borderColor: colors.border }]}>
            <Button label={t('news.clearFilters')} onPress={onClear} variant="secondary" />
            <Button label={t('common.close')} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.lg,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  close: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  heading: { fontSize: 13, fontWeight: '700', marginTop: spacing.md, textTransform: 'uppercase' },
  option: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
});
