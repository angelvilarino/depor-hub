import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { NewsItemT } from '@/data/schemas';
import { HOME_HEADLINES, topHeadlines } from '@/features/news/logic';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openExternal } from '@/utils/openExternal';

/**
 * Titulares opcionales de la Home: como máximo cinco, sin repetidos y con enlace a la
 * pestaña Noticias. Si no hay noticias el bloque no se pinta (404 = sin titulares).
 */
export function HeadlinesBlock({
  items,
  onSeeAll,
}: {
  items: NewsItemT[];
  onSeeAll?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const headlines = topHeadlines(items, HOME_HEADLINES);
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
      {headlines.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="link"
          accessibilityLabel={t('home.openHeadline', {
            title: item.title,
            source: item.sourceName,
          })}
          onPress={() => void open(item.url)}
          style={styles.item}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {t('home.headlineMeta', {
              source: item.sourceName,
              date: formatDate(item.publishedAt),
            })}
          </Text>
        </Pressable>
      ))}
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
