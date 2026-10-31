import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NewsSourceT, NewsStoryT } from '@/data/schemas';
import { newsAge, sourceMonogram } from '@/features/news/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  story: NewsStoryT;
  sources: NewsSourceT[];
  read: boolean;
  onOpen: (story: NewsStoryT) => void;
  onTag: (tag: string) => void;
  now?: number;
};

export function tagLabel(tag: string, t: (key: string) => string): string {
  return t(`news.tags.${tag}`);
}

/**
 * Tarjeta de historia: una noticia puede tener varias versiones (`alsoIn`). La fila de
 * etiquetas y el desplegable de medios quedan fuera del área pulsable del titular.
 */
export function NewsStoryCard({ story, sources, read, onOpen, onTag, now }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const source = sources.find((item) => item.id === story.sourceId);
  const name = source?.name ?? story.sourceId;
  const age = newsAge(story.publishedAt, now);
  const relative = t(`data.ago_${age.unit}`, { n: age.n });
  const tags = story.tags.slice(0, 2);
  const alternatives = story.alsoIn;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: read ? 0.78 : 1,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('news.openItem', { title: story.title, source: name })}
        accessibilityHint={t('news.openHint')}
        onPress={() => onOpen(story)}
        style={styles.main}
      >
        <View style={styles.text}>
          <View style={styles.meta}>
            <View style={[styles.monogram, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '700' }}>
                {sourceMonogram(name)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{ color: colors.textMuted, flexShrink: 1, fontSize: 12, fontWeight: '600' }}
            >
              {name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>·</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{relative}</Text>
            {!read ? (
              <View
                accessibilityLabel={t('news.unread')}
                style={[styles.dot, { backgroundColor: colors.primary }]}
              />
            ) : null}
            {story.kind === 'video' ? (
              <Ionicons name="play-circle-outline" size={14} color={colors.textMuted} />
            ) : null}
          </View>
          <Text
            numberOfLines={3}
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: read ? '600' : '700',
              lineHeight: 21,
            }}
          >
            {story.title}
          </Text>
          {story.summary ? (
            <Text
              numberOfLines={2}
              style={{ color: colors.textMuted, fontSize: 14, lineHeight: 19 }}
            >
              {story.summary}
            </Text>
          ) : null}
        </View>
        {story.thumbnailUrl && !failedImage ? (
          <Image
            source={{ uri: story.thumbnailUrl }}
            style={[styles.thumb, { backgroundColor: colors.background }]}
            contentFit="cover"
            transition={150}
            onError={() => setFailedImage(true)}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </Pressable>

      {tags.length > 0 || alternatives.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.tags}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={t('news.filterTagOnly', { tag: tagLabel(tag, t) })}
                hitSlop={8}
                onPress={() => onTag(tag)}
                style={[styles.tag, { borderColor: colors.border }]}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}
                >
                  {tagLabel(tag, t)}
                </Text>
              </Pressable>
            ))}
          </View>
          {alternatives.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t('news.alsoInCount', { count: alternatives.length })}
              hitSlop={8}
              onPress={() => setExpanded((value) => !value)}
              style={styles.alsoButton}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                {t('news.alsoInCount', { count: alternatives.length })}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {expanded ? (
        <View style={[styles.alternatives, { borderColor: colors.border }]}>
          {alternatives.map((alternative) => {
            const altName =
              sources.find((item) => item.id === alternative.sourceId)?.name ??
              alternative.sourceId;
            return (
              <Pressable
                key={`${alternative.sourceId}-${alternative.url}`}
                accessibilityRole="link"
                accessibilityLabel={t('news.openAlsoIn', {
                  source: altName,
                  title: alternative.title,
                })}
                onPress={() => onOpen({ ...story, url: alternative.url, title: alternative.title })}
                style={styles.alternative}
              >
                <Text numberOfLines={2} style={{ color: colors.text, fontSize: 13 }}>
                  {alternative.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{altName}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  main: { flexDirection: 'row', gap: spacing.md, minHeight: minTouch },
  text: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  monogram: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  tag: {
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  alsoButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 2 },
  alternatives: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  alternative: { gap: 2, minHeight: minTouch, justifyContent: 'center' },
});
