import { useEffect, useMemo, useState } from 'react';
import { Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  countdownParts,
  showsSeconds,
  type CountdownParts,
} from '@/features/home/logic';
import { useCountdown } from '@/features/home/useCountdown';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

function units(parts: CountdownParts, withSeconds: boolean, t: TFunction): string[] {
  const out: string[] = [];
  if (parts.days > 0) out.push(t('home.countdown.days', { n: parts.days }));
  if (parts.days > 0 || parts.hours > 0) {
    out.push(t('home.countdown.hours', { n: parts.hours }));
  }
  out.push(t('home.countdown.minutes', { n: parts.minutes }));
  if (withSeconds) out.push(t('home.countdown.seconds', { n: parts.seconds }));
  return out;
}

/**
 * Cuenta atrás aislada: solo este componente se vuelve a pintar cada segundo.
 * La etiqueta accesible se actualiza como mucho una vez por minuto para no
 * interrumpir al lector de pantalla; el texto visible sí cambia cada segundo.
 */
export function Countdown({ targetMs }: { targetMs: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const parts = useCountdown(targetMs, true);
  const withSeconds = showsSeconds(targetMs, parts.nowMs);
  const [pulse] = useState(() => new Animated.Value(1));
  const seconds = parts.seconds;

  const labelMinute = Math.floor(parts.nowMs / 60_000);
  const label = useMemo(() => {
    const snapshot = countdownParts(targetMs, labelMinute * 60_000);
    return t(
      withSeconds ? 'home.countdown.labelWithSeconds' : 'home.countdown.label',
      {
        days: snapshot.days,
        hours: snapshot.hours,
        minutes: snapshot.minutes,
        seconds: snapshot.seconds,
      },
    );
  }, [labelMinute, t, targetMs, withSeconds]);

  useEffect(() => {
    if (reducedMotion || !withSeconds) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(0.7);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [pulse, reducedMotion, seconds, withSeconds]);

  if (parts.expired) return null;

  return (
    <Animated.Text
      accessibilityLabel={label}
      accessibilityLiveRegion="none"
      style={{
        color: colors.primary,
        fontSize: 18,
        fontWeight: '700',
        opacity: pulse,
      }}
    >
      {units(parts, withSeconds, t).join(' ')}
    </Animated.Text>
  );
}
