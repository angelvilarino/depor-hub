import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { NewsSourceT, NewsStoryT } from '@/data/schemas';
import { HOME_HEADLINES, sourceName, topHeadlines } from '@/features/news/logic';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

/**
 * Titulares opcionales de la Home: como máximo cinco, sin repetidos y con enlace a la
 * pestaña Noticias. Si no hay historias el bloque no se pinta (404 = sin titulares).
 */
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
  const headlines = topHeadlines(stories, HOME_HEADLINES);
  if (headlines.length === 0) return null;

  const open = async (url: string) => {
    const ok = await openExternal(url);
    if (!ok) Alert.alert(t('home.openError'));
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date(iso));

  return (
    <Card>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
          {t('home.headlines')}
        </Text>
        {onSeeAll ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('home.seeAllHeadlines')}
            onPress={onSeeAll}
            style={styles.seeAll}
          >
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
              {t('home.seeAllHeadlines')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {headlines.map((story) => {
        const name = sourceName(story, sources);
        return (
          <Pressable
            key={story.id}
            accessibilityRole="link"
            accessibilityLabel={t('home.openHeadline', {
              title: story.title,
              source: name,
            })}
            onPress={() => void open(story.url)}
            style={styles.item}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
              {story.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t('home.headlineMeta', {
                source: name,
                date: formatDate(story.publishedAt),
              })}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  seeAll: { minHeight: minTouch, justifyContent: 'center' },
  item: {
    gap: 2,
    minHeight: minTouch,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
});
