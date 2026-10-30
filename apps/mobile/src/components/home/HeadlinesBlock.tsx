import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { PaperCard, SectionHeader } from '@/components/design/DesignSystem';
import type { NewsAlsoInT, NewsSourceT, NewsStoryT } from '@/data/schemas';
import {
  HOME_HEADLINES,
  relativePublishedAt,
  sourceBadgeIndex,
  sourceById,
  sourceMonogram,
  sourceName,
  topHeadlines,
} from '@/features/news/logic';
import { minTouch, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

function SourceMark({ source, name, compact = false }: { source?: NewsSourceT; name: string; compact?: boolean }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const size = compact ? 42 : 48;
  const uri = failed ? null : source?.iconUrl;
  const badge = colors.news.sourceBadges[sourceBadgeIndex(source?.id ?? name, colors.news.sourceBadges.length)]!;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.sourceMark, { width: size, height: size, borderRadius: compact ? 8 : 10, backgroundColor: badge }]}>
      {uri ? (
        <Image source={{ uri }} cachePolicy="memory-disk" contentFit="contain" onError={() => setFailed(true)} style={{ width: size * 0.7, height: size * 0.7 }} />
      ) : (
        <Text style={{ color: colors.poster.text, fontSize: compact ? 13 : 15, fontWeight: '900' }}>{sourceMonogram(name)}</Text>
      )}
    </View>
  );
}

function StoryImage({ story, source, sourceLabel }: { story: NewsStoryT; source?: NewsSourceT; sourceLabel: string }) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();
  if (story.thumbnailUrl && !failed) {
    return <Image source={{ uri: story.thumbnailUrl }} cachePolicy="memory-disk" contentFit="cover" onError={() => setFailed(true)} style={styles.featureImage} />;
  }
  const badge = colors.news.sourceBadges[sourceBadgeIndex(source?.id ?? story.sourceId, colors.news.sourceBadges.length)]!;
  return (
    <LinearGradient colors={[badge, colors.poster.stops[0]]} style={[styles.featureImage, styles.featureFallback]}>
      <Text style={[styles.fallbackMonogram, { color: colors.poster.text }]}>{sourceMonogram(sourceLabel)}</Text>
    </LinearGradient>
  );
}

function StoryThumb({ story, source, sourceLabel }: { story: NewsStoryT; source?: NewsSourceT; sourceLabel: string }) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();
  const badge = colors.news.sourceBadges[sourceBadgeIndex(source?.id ?? story.sourceId, colors.news.sourceBadges.length)]!;
  if (story.thumbnailUrl && !failed) {
    return <Image source={{ uri: story.thumbnailUrl }} cachePolicy="memory-disk" contentFit="cover" onError={() => setFailed(true)} style={styles.thumb} />;
  }
  return (
    <View style={[styles.thumbFallback, { backgroundColor: badge }]}>
      <Text style={{ color: colors.poster.text, fontWeight: '900', fontSize: 13 }}>{sourceMonogram(sourceLabel)}</Text>
    </View>
  );
}

export function HeadlinesBlock({
  stories,
  sources,
  onSeeAll,
}: {
  stories: NewsStoryT[];
  sources: NewsSourceT[];
  onSeeAll?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const headlines = topHeadlines(stories, HOME_HEADLINES);
  if (headlines.length === 0) return null;

  const open = async (url: string) => {
    if (!(await openExternal(url))) Alert.alert(t('home.openError'));
  };
  const relative = (publishedAt: string) => relativePublishedAt(publishedAt, i18n.language);
  const [featured, ...list] = headlines;
  if (!featured) return null;
  const featuredSource = sourceById(sources, featured.sourceId);
  const featuredSourceName = sourceName(featured, sources);
  const alternatesOpen = expandedStory === featured.id;

  return (
    <PaperCard>
      <SectionHeader
        title={t('home.headlines')}
        trailing={onSeeAll ? (
          <Pressable accessibilityRole="link" accessibilityLabel={t('home.seeAllHeadlines')} onPress={onSeeAll} style={styles.seeAll}>
            <Text style={{ color: paper.accent, fontSize: 14, fontWeight: '700' }}>{t('home.seeAllHeadlines')}</Text>
          </Pressable>
        ) : undefined}
      />

      <View style={styles.feature}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('home.openHeadline', { title: featured.title, source: featuredSourceName })}
          accessibilityHint={t('news.openHint')}
          onPress={() => void open(featured.url)}
          style={styles.featurePress}
        >
          <View style={styles.featureImageWrap}>
            <StoryImage story={featured} source={featuredSource} sourceLabel={featuredSourceName} />
          </View>
          <View style={styles.featureHeading}>
            <Text style={[styles.featureTitle, { color: paper.text }]}>{featured.title}</Text>
            <View style={styles.meta}>
              <SourceMark source={featuredSource} name={featuredSourceName} compact />
              <View style={styles.metaCopy}>
                <Text style={{ color: paper.text, fontSize: 13, fontWeight: '700' }}>{featuredSourceName}</Text>
                <Text style={{ color: paper.muted, fontSize: 12 }}>{relative(featured.publishedAt)}</Text>
              </View>
            </View>
          </View>
        </Pressable>
        {featured.alsoIn.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: alternatesOpen }}
              accessibilityLabel={t('news.alsoInCount', { count: featured.alsoIn.length })}
              onPress={() => setExpandedStory(alternatesOpen ? null : featured.id)}
              style={styles.coverageButton}
            >
              <Text style={{ color: paper.accent, fontWeight: '700', fontSize: 12 }}>
                {t('news.alsoInCount', { count: featured.alsoIn.length })} {alternatesOpen ? '−' : '+'}
              </Text>
            </Pressable>
            {alternatesOpen ? (
              <View style={[styles.alternateList, { borderColor: paper.border }]}>
                {featured.alsoIn.map((item) => <AlternateStory key={item.url} item={item} sources={sources} open={open} relative={relative} />)}
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <View style={[styles.list, { borderTopColor: paper.border }]}>
        {list.map((story) => {
          const name = sourceName(story, sources);
          const source = sourceById(sources, story.sourceId);
          return (
            <View key={story.id} style={[styles.listItem, { borderBottomColor: paper.border }]}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('home.openHeadline', { title: story.title, source: name })}
                accessibilityHint={t('news.openHint')}
                onPress={() => void open(story.url)}
                style={styles.listPress}
              >
                <StoryThumb story={story} source={source} sourceLabel={name} />
                <View style={styles.listCopy}>
                  <Text numberOfLines={3} style={[styles.listTitle, { color: paper.text }]}>{story.title}</Text>
                  <View style={styles.listMeta}>
                    <SourceMark source={source} name={name} compact />
                    <View style={styles.metaCopy}>
                      <Text numberOfLines={1} style={{ color: paper.text, fontSize: 12, fontWeight: '700' }}>{name}</Text>
                      <Text style={{ color: paper.muted, fontSize: 11 }}>{relative(story.publishedAt)}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
              {story.alsoIn.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('news.alsoInCount', { count: story.alsoIn.length })}
                  onPress={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                  style={styles.listCoverage}
                >
                  <Text style={{ color: paper.accent, fontWeight: '700', fontSize: 11 }}>{t('news.alsoInCount', { count: story.alsoIn.length })}</Text>
                </Pressable>
              ) : null}
              {expandedStory === story.id ? (
                <View style={[styles.alternateList, { borderColor: paper.border }]}>
                  {story.alsoIn.map((item) => <AlternateStory key={item.url} item={item} sources={sources} open={open} relative={relative} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </PaperCard>
  );
}

function AlternateStory({
  item,
  sources,
  open,
  relative,
}: {
  item: NewsAlsoInT;
  sources: NewsSourceT[];
  open: (url: string) => Promise<void>;
  relative: (date: string) => string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const source = sourceById(sources, item.sourceId);
  const name = source?.name ?? item.sourceId;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={t('news.openAlsoIn', { source: name, title: item.title })} onPress={() => void open(item.url)} style={styles.alternate}>
      <SourceMark source={source} name={name} compact />
      <View style={styles.metaCopy}>
        <Text style={{ color: paper.text, fontSize: 13, fontWeight: '700' }}>{name}</Text>
        <Text style={{ color: paper.text, fontSize: 13 }}>{item.title}</Text>
        <Text style={{ color: paper.muted, fontSize: 11 }}>{relative(item.publishedAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seeAll: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.xs },
  feature: { gap: spacing.xs },
  featurePress: { gap: spacing.sm },
  featureImageWrap: { overflow: 'hidden', borderRadius: 12 },
  featureImage: { width: '100%', aspectRatio: 1.78 },
  featureFallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackMonogram: { fontFamily: typography.display, fontSize: 64, fontWeight: '700', opacity: 0.9 },
  featureHeading: { gap: spacing.sm },
  featureTitle: { fontFamily: typography.headline, fontSize: 25, lineHeight: 31 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaCopy: { flex: 1, minWidth: 0, gap: 2 },
  sourceMark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverageButton: { minHeight: minTouch, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.xs },
  alternateList: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm, paddingTop: spacing.sm },
  alternate: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTouch },
  list: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.xs },
  listItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  listPress: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: minTouch },
  listCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  listTitle: { fontFamily: typography.headline, fontSize: 17, lineHeight: 22 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  thumb: { width: 70, height: 54, borderRadius: 8 },
  thumbFallback: { width: 70, height: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listCoverage: { minHeight: minTouch, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: spacing.xs },
});
