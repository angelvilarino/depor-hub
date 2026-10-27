import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { NewsItemT } from '@/data/schemas';
import { durationLabel, newsAge } from '@/features/news/logic';
import { minTouch, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

type Props = {
  item: NewsItemT;
  read: boolean;
  onPress?: (item: NewsItemT) => void;
  now?: number;
};

export function tagLabel(tag: string): string {
  return tag.startsWith('rival:') ? tag.slice('rival:'.length).replace(/-/g, ' ') : tag;
}

export function NewsCard({ item, read, onPress, now }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [failedImage, setFailedImage] = useState(false);
  const age = newsAge(item.publishedAt, now);
  const relative = t(`data.ago_${age.unit}`, { n: age.n });
  const minutes = durationLabel(item.durationSeconds);
  const tags = item.tags.slice(0, 3);
  const alsoIn = item.alsoIn.slice(0, 3).map((alt) => alt.sourceName);
  const thumbnail = item.thumbnailUrl && !failedImage ? item.thumbnailUrl : null;

  const open = async () => {
    onPress?.(item);
    const ok = await openExternal(item.url);
    if (!ok) Alert.alert(t('news.openError'));
  };

  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('news.openItem', { title: item.title, source: item.sourceName })}
        accessibilityHint={t('news.openHint')}
        onPress={() => void open()}
        style={styles.pressable}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.thumb,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            {thumbnail ? (
              <Image
                source={{ uri: thumbnail }}
                style={styles.thumbImage}
                contentFit="cover"
                transition={120}
                onError={() => setFailedImage(true)}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={{ color: colors.primary, fontSize: 26, fontWeight: '800' }}>
                {item.sourceName.trim().charAt(0).toUpperCase() || 'D'}
              </Text>
            )}
            {item.kind === 'video' ? (
              <View style={[styles.play, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={14} color={colors.onPrimary} />
              </View>
            ) : null}
          </View>

          <View style={styles.content}>
            <View style={styles.metaRow}>
              {!read ? (
                <View
                  accessibilityLabel={t('news.unread')}
                  style={[styles.dot, { backgroundColor: colors.primary }]}
                />
              ) : null}
              <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
                {item.sourceName} · {relative}
              </Text>
            </View>
            <Text
              style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
              numberOfLines={3}
            >
              {item.title}
            </Text>
            {item.summary ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : null}

            {tags.length > 0 || item.kind === 'video' ? (
              <View style={styles.tags}>
                {item.kind === 'video' ? (
                  <View style={[styles.chip, { borderColor: colors.primary }]}>
                    <Ionicons name="play-circle-outline" size={12} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                      {t('news.video')}
                      {minutes ? ` · ${t('news.minutes', { n: minutes })}` : ''}
                    </Text>
                  </View>
                ) : null}
                {tags.map((tag) => (
                  <View
                    key={tag}
                    style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.background }]}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {t(`news.tags.${tag}`, { defaultValue: tagLabel(tag) })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {alsoIn.length > 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>
                {t('news.alsoIn', { sources: alsoIn.join(', ') })}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <Text style={[styles.date, { color: colors.textMuted }]}>
        {new Intl.DateTimeFormat(i18n.language, {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Madrid',
        }).format(new Date(item.publishedAt))}
        {item.publishedEstimated ? ` · ${t('news.estimated')}` : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  pressable: { minHeight: minTouch },
  row: { flexDirection: 'row', gap: spacing.sm },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  play: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  date: { fontSize: 11, marginTop: spacing.xs },
});
