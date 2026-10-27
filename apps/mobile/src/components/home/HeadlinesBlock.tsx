import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/Screen';
import type { NewsItemT } from '@/data/schemas';
import { minTouch, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Titulares opcionales: si no hay noticias el bloque no se pinta (404 = sin titulares). */
export function HeadlinesBlock({ items }: { items: NewsItemT[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  if (items.length === 0) return null;

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('home.openError'));
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date(iso));

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        {t('home.headlines')}
      </Text>
      {items.map((item) => (
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
  item: {
    gap: 2,
    minHeight: minTouch,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
});
