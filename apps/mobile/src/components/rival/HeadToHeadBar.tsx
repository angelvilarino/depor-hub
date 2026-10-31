import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HeadToHeadT } from '@/data/schemas';
import { motion, radius, spacing } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

type Result = 'W' | 'D' | 'L';

const ORDER: Result[] = ['W', 'D', 'L'];

export function HeadToHeadBar({ head, variant = 'paper' }: { head: HeadToHeadT | null; variant?: 'paper' | 'poster' }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const counts = useMemo(() => head ? [head.won, head.drawn, head.lost] : [0, 0, 0], [head]);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const fractions = counts.map((value) => total > 0 ? value / total : 0);
  const accessibleLabel = head
    ? t('home.rival.headToHeadA11y', { played: head.played, won: head.won, drawn: head.drawn, lost: head.lost, goalsFor: head.goalsFor, goalsAgainst: head.goalsAgainst })
    : '';

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: motion.standard, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [head, progress, reducedMotion]);

  if (!head) return null;
  const isPoster = variant === 'poster';
  const barColors: Record<Result, string> = isPoster
    ? { W: colors.poster.outcome.winText, D: colors.poster.outcome.drawText, L: colors.poster.outcome.lossText }
    : { W: colors.win, D: colors.draw, L: colors.loss };
  const textColor = isPoster ? colors.poster.text : paper.text;
  const muted = isPoster ? colors.poster.muted : paper.muted;

  return (
    <View accessible accessibilityLabel={accessibleLabel} style={styles.container}>
      <View style={[styles.bar, { backgroundColor: isPoster ? colors.poster.muted : paper.border }]}>
        {ORDER.map((result, index) => (
          <Animated.View
            key={result}
            style={{
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${fractions[index]! * 100}%`] }),
              height: '100%',
              backgroundColor: barColors[result],
            }}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {ORDER.map((result, index) => (
          <Text key={result} style={{ color: barColors[result], fontSize: 12, fontWeight: '700' }}>
            {t(`calendar.outcome.${result}`)} {counts[index]}
          </Text>
        ))}
      </View>
      <Text style={{ color: muted, fontSize: 11 }}>
        {t('home.rival.headToHeadScope', { source: head.source })} · {head.played} {t('home.rival.matchesShort')}
      </Text>
      <Text style={{ color: textColor, fontSize: 14, fontWeight: '700' }}>
        {t('home.rival.goalsRecord', { goalsFor: head.goalsFor, goalsAgainst: head.goalsAgainst })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  bar: { height: 10, flexDirection: 'row', overflow: 'hidden', borderRadius: radius.pill },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
});
