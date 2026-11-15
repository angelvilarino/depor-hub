import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Fallback de Expo Router para una ruta que no existe (F3-02).
 * Sustituye la pantalla en blanco por una salida clara: volver al inicio.
 */
export default function NotFound() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.center}>
        <Ionicons name="compass-outline" size={44} color={colors.textMuted} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {t('notFound.title')}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>{t('notFound.message')}</Text>
        <Button label={t('notFound.home')} onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center' },
});
