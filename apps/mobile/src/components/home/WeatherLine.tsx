import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type { TFunction } from 'i18next';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { weatherKey, type Weather, type WeatherHour } from '@/features/home/weather';
import { motion, minTouch, radius, spacing, typography, type PaperTokens } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

function weatherIcon(code: number, color: string) {
  const kind = weatherKey(code);
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34" fill="none" accessibilityElementsHidden>
      {kind === 'clear' ? (
        <>
          <Circle cx={17} cy={17} r={6} stroke={color} strokeWidth={2.5} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <Line
              key={angle}
              x1={17}
              y1={3}
              x2={17}
              y2={7}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              rotation={angle}
              origin="17,17"
            />
          ))}
        </>
      ) : (
        <>
          <Path
            d="M8 23.5h17.2a4.8 4.8 0 0 0 .4-9.6A8.4 8.4 0 0 0 9.5 12a6 6 0 0 0-1.5 11.5Z"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {['rain', 'showers', 'drizzle', 'storm', 'snow'].includes(kind) ? (
            <>
              <Path d="m12 26-1 3M19 26l-1 3M26 26l-1 3" stroke={color} strokeWidth={2} strokeLinecap="round" />
              {kind === 'storm' ? <Path d="m19 16-3 5h4l-3 5" stroke={color} strokeWidth={2} strokeLinejoin="round" /> : null}
            </>
          ) : null}
        </>
      )}
    </Svg>
  );
}

function ageLabel(capturedAt: number, now: number, t: TFunction) {
  const elapsed = Math.max(0, now - capturedAt);
  if (elapsed < 60_000) return t('data.ago_now');
  if (elapsed < 3_600_000) return t('data.ago_minutes', { n: Math.floor(elapsed / 60_000) });
  if (elapsed < 86_400_000) return t('data.ago_hours', { n: Math.floor(elapsed / 3_600_000) });
  return t('data.ago_days', { n: Math.floor(elapsed / 86_400_000) });
}

function HourItem({ hour, paper, t }: { hour: WeatherHour; paper: PaperTokens; t: TFunction }) {
  const time = hour.hour.split('T')[1]?.slice(0, 2) ?? '--';
  return (
    <View accessible accessibilityLabel={`${t('home.weather.hour')}, ${time}:00, ${hour.temperatureC}°, ${hour.precipitationProbability ?? '—'}%`} style={styles.hour}>
      <Text style={[styles.hourTime, { color: paper.muted }]}>{time}:00</Text>
      <Text style={[styles.hourTemp, { color: paper.text }]}>{hour.temperatureC}°</Text>
      <Text style={[styles.hourRain, { color: paper.muted }]}>{hour.precipitationProbability === null ? '—' : `${hour.precipitationProbability}%`}</Text>
    </View>
  );
}

/** Talón de entrada meteorológico dentro del cartel; los datos siguen siendo opcionales. */
export function WeatherLine({
  weather,
  capturedAt = 0,
  offline = false,
  now,
}: {
  weather: Weather;
  capturedAt?: number;
  offline?: boolean;
  now?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [float] = useState(() => new Animated.Value(0));
  const currentTime = now ?? 0;
  const kind = weatherKey(weather.code);
  const rain = weather.precipitationProbability;

  useEffect(() => {
    float.stopAnimation();
    float.setValue(0);
    if (reducedMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: motion.slow, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: motion.slow, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [float, kind, reducedMotion]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const label = [
    t(`home.weather.${kind}`),
    t('home.weather.temperature', { n: weather.temperatureC }),
    rain === null ? null : t('home.weather.precipitation', { n: rain }),
    weather.windKmh === null ? null : t('home.weather.wind', { n: weather.windKmh }),
  ].filter(Boolean).join('. ');

  return (
    <View style={[styles.ticket, { backgroundColor: paper.background, borderColor: paper.border }]}>
      <View pointerEvents="none" style={[styles.notch, styles.notchLeft, { backgroundColor: paper.background }]} />
      <View pointerEvents="none" style={[styles.notch, styles.notchRight, { backgroundColor: paper.background }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('home.weather.expandHint')}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.ticketMain}
      >
        <Animated.View style={{ transform: [{ translateY }] }}>{weatherIcon(weather.code, paper.accent)}</Animated.View>
        <View style={styles.weatherMain}>
          <Text style={[styles.temperature, { color: paper.text }]} maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}>
            {weather.temperatureC}°
          </Text>
          <Text style={[styles.condition, { color: paper.muted }]}>{t(`home.weather.${kind}`)}</Text>
        </View>
        <View style={styles.weatherMetrics}>
          {rain !== null ? (
            <View style={styles.rainMetric}>
              <View style={styles.rainLabel}>
                <Text style={{ color: paper.muted, fontSize: 12 }}>{t('home.weather.rain')}</Text>
                <Text style={{ color: paper.text, fontSize: 12, fontWeight: '700' }}>{rain}%</Text>
              </View>
              <View style={[styles.rainTrack, { backgroundColor: paper.border }]}>
                <View style={[styles.rainFill, { width: `${Math.max(0, Math.min(100, rain))}%` as DimensionValue, backgroundColor: paper.accent }]} />
              </View>
            </View>
          ) : null}
          {weather.windKmh !== null ? (
            <Text style={{ color: paper.muted, fontSize: 12 }}>{t('home.weather.wind', { n: weather.windKmh })}</Text>
          ) : null}
        </View>
      </Pressable>

      {expanded && weather.nearby && weather.nearby.length > 0 ? (
        <View style={[styles.hours, { borderTopColor: paper.border }]}>
          {weather.nearby.map((hour) => <HourItem key={hour.hour} hour={hour} paper={paper} t={t} />)}
        </View>
      ) : null}
      <View style={styles.attributionRow}>
        <Text style={{ color: paper.muted, fontSize: 11 }}>{t('home.weather.attribution')}</Text>
        {offline && capturedAt > 0 && now !== undefined ? (
          <Text style={{ color: paper.muted, fontSize: 11 }}>
            {t('home.weather.cached', { ago: ageLabel(capturedAt, currentTime, t) })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { borderWidth: StyleSheet.hairlineWidth, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm, overflow: 'hidden' },
  notch: { position: 'absolute', zIndex: 1, top: '50%', width: 16, height: 16, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  notchLeft: { left: -9 },
  notchRight: { right: -9 },
  ticketMain: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weatherMain: { minWidth: 76, gap: 0 },
  temperature: { fontFamily: typography.display, fontSize: 36, lineHeight: 38 },
  condition: { fontSize: 11 },
  weatherMetrics: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  rainMetric: { gap: 3 },
  rainLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  rainTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  rainFill: { height: '100%', borderRadius: radius.pill },
  attributionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  hours: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hour: { minWidth: 54, alignItems: 'center', gap: 2 },
  hourTime: { fontSize: 11 },
  hourTemp: { fontFamily: typography.display, fontSize: 20 },
  hourRain: { fontSize: 11 },
});
