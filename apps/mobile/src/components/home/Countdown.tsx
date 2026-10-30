import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { countdownParts, type CountdownParts } from '@/features/home/logic';
import { useCountdown } from '@/features/home/useCountdown';
import { motion, radius, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

type Unit = { key: string; value: number; label: string };

function units(parts: CountdownParts, t: TFunction): Unit[] {
  return [
    { key: 'days', value: parts.days, label: t('home.countdown.units.days') },
    { key: 'hours', value: parts.hours, label: t('home.countdown.units.hours') },
    { key: 'minutes', value: parts.minutes, label: t('home.countdown.units.minutes') },
    { key: 'seconds', value: parts.seconds, label: t('home.countdown.units.seconds') },
  ];
}

function UnitBox({ unit, reducedMotion, urgent }: { unit: Unit; reducedMotion: boolean; urgent: boolean }) {
  const { colors } = useTheme();
  const [transition] = useState(() => new Animated.Value(1));
  const previous = useRef(unit.value);

  useEffect(() => {
    if (unit.value === previous.current) return;
    previous.current = unit.value;
    if (reducedMotion) {
      transition.setValue(1);
      return;
    }
    transition.setValue(0);
    Animated.timing(transition, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
  }, [reducedMotion, transition, unit.value]);

  return (
    <View style={[styles.unitBox, { backgroundColor: colors.poster.text, borderColor: urgent ? colors.poster.accent : 'transparent' }]}>
      <Animated.Text
        maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}
        style={{
          color: colors.primary,
          fontFamily: typography.numeric,
          fontSize: 30,
          lineHeight: 34,
          opacity: transition,
          transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
        }}
      >
        {String(unit.value).padStart(2, '0')}
      </Animated.Text>
      <Text style={{ color: colors.textMuted, fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' }}>
        {unit.label}
      </Text>
    </View>
  );
}

/** Solo este componente repinta cada segundo; el resto de Home no depende del tic. */
export function Countdown({ targetMs, onExpire }: { targetMs: number; onExpire?: () => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const parts = useCountdown(targetMs, true);
  const expiredNotified = useRef(false);
  const labelMinute = Math.floor(parts.nowMs / 60_000);
  const label = useMemo(() => {
    const snapshot = countdownParts(targetMs, labelMinute * 60_000);
    return t('home.countdown.labelWithSeconds', {
      days: snapshot.days,
      hours: snapshot.hours,
      minutes: snapshot.minutes,
      seconds: snapshot.seconds,
    });
  }, [labelMinute, t, targetMs]);

  useEffect(() => {
    if (parts.expired && !expiredNotified.current) {
      expiredNotified.current = true;
      onExpire?.();
    }
    if (!parts.expired && expiredNotified.current) expiredNotified.current = false;
  }, [onExpire, parts.expired]);

  if (parts.expired) return null;
  const displayUnits = units(parts, t);
  const urgent = targetMs - parts.nowMs < 3_600_000;

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={label}
      accessibilityLiveRegion="none"
      style={styles.countdown}
    >
      {displayUnits.map((unit) => (
        <UnitBox key={unit.key} unit={unit} reducedMotion={reducedMotion} urgent={urgent} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  countdown: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  unitBox: { flex: 1, minWidth: 0, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 2, paddingVertical: spacing.xs, gap: 1 },
});
