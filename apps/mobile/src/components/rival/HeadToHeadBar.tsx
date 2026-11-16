import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HeadToHeadT } from '@/data/schemas';
import { motion, radius, spacing, text } from '@/theme/tokens';
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
  const poster = colors.poster.outcome;
  // D-02: sobre el cartel, las etiquetas G/E/P van en una pastilla clara con
  // texto oscuro (≥4,5:1); el color semántico no se usa como texto sobre azul.
  const barColors: Record<Result, string> = isPoster
    ? { W: poster.winText, D: poster.drawText, L: poster.lossText }
    : { W: colors.win, D: colors.draw, L: colors.loss };
  const labelBackground: Record<Result, string | undefined> = isPoster
    ? { W: poster.winBackground, D: poster.drawBackground, L: poster.lossBackground }
    : { W: undefined, D: undefined, L: undefined };
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
          <View
            key={result}
            style={
              labelBackground[result]
                ? [styles.label, { backgroundColor: labelBackground[result] }]
                : null
            }
          >
            <Text style={{ color: barColors[result], ...text.caption, fontWeight: '700' }}>
              {t(`calendar.outcome.${result}`)} {counts[index]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={{ color: muted, ...text.caption }}>
        {t('home.rival.headToHeadScope', { source: head.source })} · {head.played} {t('home.rival.matchesShort')}
      </Text>
      <Text style={{ color: textColor, ...text.body, fontWeight: '700' }}>
        {t('home.rival.goalsRecord', { goalsFor: head.goalsFor, goalsAgainst: head.goalsAgainst })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  bar: { height: 10, flexDirection: 'row', overflow: 'hidden', borderRadius: radius.pill },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
});
