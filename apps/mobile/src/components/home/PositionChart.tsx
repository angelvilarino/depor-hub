import { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { PositionPointT, SeasonFormMatchT } from '@/data/schemas';
import { positionChartIndex } from '@/features/home/logic';
import { motion, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/useReducedMotion';
import { useTheme } from '@/theme/useTheme';

type Props = {
  points: PositionPointT[];
  matches: SeasonFormMatchT[];
  selectedMatchday: number | null;
  onSelectMatchday: (matchday: number) => void;
};

/** Gráfico táctil accesible: arrastre y acciones de anterior/siguiente jornada. */
export function PositionChart(props: Props) {
  if (props.points.length < 2) return null;
  return <PositionChartBody {...props} />;
}

function PositionChartBody({ points, matches, selectedMatchday, onSelectMatchday }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const paper = colors.paper;
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const chartWidth = Math.max(180, Math.min(width - 64, 520));
  const chartHeight = 136;
  const padding = 22;
  const best = Math.min(...points.map((point) => point.position));
  const worst = Math.max(...points.map((point) => point.position));
  const span = Math.max(1, worst - best);
  const x = (index: number) => padding + (index / (points.length - 1)) * (chartWidth - padding * 2);
  const y = (position: number) => padding + ((position - best) / span) * (chartHeight - padding * 2);
  const coords = points.map((point, index) => `${x(index)},${y(point.position)}`).join(' ');
  const selectedIndex = Math.max(0, points.findIndex((point) => point.matchday === selectedMatchday));
  const selected = points[selectedIndex] ?? points[points.length - 1]!;
  const match = matches.find((item) => item.matchday === selected.matchday);
  const outcome = match ? t(`calendar.outcomeLong.${match.result}`) : null;
  const opponent = match?.opponent.shortName ?? match?.opponent.name ?? null;
  const detail = t('home.seasonCard.chartPoint', {
    matchday: selected.matchday,
    opponent: opponent ?? '—',
    result: outcome ?? '—',
    position: selected.position,
    points: selected.points,
  });
  const guidePosition = x(selectedIndex);

  const animatedGuide = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ translateX: reduceMotion ? guidePosition : withTiming(guidePosition, { duration: motion.fast }) }],
  }), [guidePosition, reduceMotion]);

  const selectAt = useCallback((localX: number) => {
    const index = positionChartIndex(localX, chartWidth, points.length, padding);
    const target = points[index];
    if (target) onSelectMatchday(target.matchday);
  }, [chartWidth, onSelectMatchday, points]);
  const gesture = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => runOnJS(selectAt)(event.x))
    .onUpdate((event) => runOnJS(selectAt)(event.x)), [selectAt]);

  const moveSelection = (direction: -1 | 1) => {
    const index = Math.max(0, Math.min(points.length - 1, selectedIndex + direction));
    const target = points[index];
    if (target) onSelectMatchday(target.matchday);
  };

  const bestDay = points.find((point) => point.position === best)?.matchday;
  const worstDay = [...points].reverse().find((point) => point.position === worst)?.matchday;
  const label = t('home.seasonCard.evolutionA11y', {
    points: points.map((point) => `${point.matchday}: ${point.position}º`).join(', '),
  });
  const date = match
    ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${match.date}T12:00:00Z`))
    : null;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: points[0]!.matchday, max: points[points.length - 1]!.matchday, now: selected.matchday }}
      accessibilityActions={[
        { name: 'increment', label: t('home.seasonCard.chartIncrement') },
        { name: 'decrement', label: t('home.seasonCard.chartDecrement') },
      ]}
      onAccessibilityAction={(event) => moveSelection(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ gap: spacing.xs }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Animated.Text
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={typography.displayMaxFontSizeMultiplier}
            style={{ color: paper.text, fontFamily: typography.headline, fontSize: 16 }}
          >
            {detail}
          </Animated.Text>
          {date ? <Animated.Text style={{ color: paper.muted, fontSize: 12 }}>{date} · {match?.home ? t('home.local') : t('home.away')}</Animated.Text> : null}
        </View>
        {match ? (
          <PressMatchResult result={match.result} label={outcome ?? ''} />
        ) : null}
      </View>
      <GestureDetector gesture={gesture}>
        <View style={{ width: chartWidth, height: chartHeight }}>
          <Svg width={chartWidth} height={chartHeight}>
            {[best, worst].map((position, index) => (
              <Line key={`${position}-${index}`} x1={padding} y1={y(position)} x2={chartWidth - padding} y2={y(position)} stroke={colors.paper.border} strokeWidth={1} />
            ))}
            <SvgText x={1} y={y(best) + 4} fill={paper.muted} fontSize={10}>{best}º</SvgText>
            <SvgText x={1} y={y(worst) + 4} fill={paper.muted} fontSize={10}>{worst}º</SvgText>
            <Polyline points={coords} fill="none" stroke={paper.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((point, index) => (
              <Circle key={point.matchday} cx={x(index)} cy={y(point.position)} r={index === selectedIndex ? 6 : 3} fill={paper.accent} />
            ))}
            {bestDay != null ? <SvgText x={x(points.findIndex((point) => point.matchday === bestDay))} y={y(best) - 8} fill={paper.text} fontSize={10}>{t('home.seasonCard.best')}</SvgText> : null}
            {worstDay != null ? <SvgText x={x(points.findIndex((point) => point.matchday === worstDay))} y={y(worst) + 14} fill={paper.text} fontSize={10}>{t('home.seasonCard.worst')}</SvgText> : null}
          </Svg>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: padding, bottom: padding, width: 1, backgroundColor: paper.accent }, animatedGuide]} />
        </View>
      </GestureDetector>
    </View>
  );
}

function PressMatchResult({ result, label }: { result: 'W' | 'D' | 'L'; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tone = result === 'W' ? colors.win : result === 'L' ? colors.loss : colors.draw;
  return (
    <View accessible accessibilityLabel={label} style={{ width: 42, minHeight: 42, borderWidth: 2, borderColor: tone, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Text style={{ color: tone, fontWeight: '900' }}>{t(`calendar.outcome.${result}`)}</Animated.Text>
    </View>
  );
}
