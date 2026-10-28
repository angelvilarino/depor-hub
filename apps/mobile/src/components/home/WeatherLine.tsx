import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { weatherKey, type Weather } from '@/features/home/weather';
import { useTheme } from '@/theme/useTheme';

/**
 * Línea de tiempo en la sede, solo con hora confirmada y coordenadas fiables.
 * Lleva la atribución de Open-Meteo (licencia CC BY 4.0).
 */
export function WeatherLine({ weather }: { weather: Weather }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const parts = [
    `${weather.temperatureC}°`,
    t(`home.weather.${weatherKey(weather.code)}`),
    weather.precipitationProbability !== null
      ? t('home.weather.precipitation', { n: weather.precipitationProbability })
      : null,
    weather.windKmh !== null ? t('home.weather.wind', { n: weather.windKmh }) : null,
  ].filter(Boolean);

  return (
    <View accessible accessibilityLabel={parts.join('. ')} style={styles.box}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
        {parts.join(' · ')}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('home.weather.attribution')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 1 },
});
