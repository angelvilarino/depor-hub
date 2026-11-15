import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Error capturado por Expo Router; solo se usa para el diagnóstico local. */
  error?: Error;
  /** Reintenta montar la pantalla que falló. */
  retry?: () => void;
};

/**
 * ErrorBoundary de ruta (F3-02): un render que lanza muestra una salida y dos
 * formas de recuperarse (reintentar o volver al inicio), no una pantalla en blanco.
 */
export function RouteErrorBoundary({ error, retry }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (__DEV__ && error) console.warn('[route] render error', error);

  return (
    <Screen>
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {t('routeError.title')}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>{t('routeError.message')}</Text>
        {retry ? <Button label={t('routeError.retry')} onPress={retry} /> : null}
        <Button
          variant="secondary"
          label={t('routeError.home')}
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center' },
});
