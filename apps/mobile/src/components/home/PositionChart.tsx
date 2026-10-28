import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { PositionPointT } from '@/data/schemas';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Evolución de la posición por jornada. La posición 1 queda arriba. Se dibuja con
 * `react-native-svg` (sin animación) y lleva una etiqueta textual para lectores.
 */
export function PositionChart({ points }: { points: PositionPointT[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  if (points.length < 2) return null;

  const chartWidth = Math.max(180, Math.min(width - 64, 520));
  const chartHeight = 120;
  const padding = 18;
  const best = Math.min(...points.map((p) => p.position));
  const worst = Math.max(...points.map((p) => p.position));
  const span = Math.max(1, worst - best);
  const x = (index: number) => padding + (index / (points.length - 1)) * (chartWidth - padding * 2);
  const y = (position: number) =>
    padding + ((position - best) / span) * (chartHeight - padding * 2);

  const coords = points.map((point, index) => `${x(index)},${y(point.position)}`).join(' ');
  const label = t('home.seasonCard.evolutionA11y', {
    points: points.map((point) => `${point.matchday}: ${point.position}º`).join(', '),
  });

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ marginVertical: spacing.xs }}
    >
      <Svg width={chartWidth} height={chartHeight}>
        <Line
          x1={padding}
          y1={y(best)}
          x2={chartWidth - padding}
          y2={y(best)}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Line
          x1={padding}
          y1={y(worst)}
          x2={chartWidth - padding}
          y2={y(worst)}
          stroke={colors.border}
          strokeWidth={1}
        />
        <SvgText x={2} y={y(best) + 4} fill={colors.textMuted} fontSize={10}>
          {best}º
        </SvgText>
        <SvgText x={2} y={y(worst) + 4} fill={colors.textMuted} fontSize={10}>
          {worst}º
        </SvgText>
        <Polyline
          points={coords}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <Circle
            key={`${point.matchday}-${index}`}
            cx={x(index)}
            cy={y(point.position)}
            r={3.5}
            fill={colors.primary}
          />
        ))}
      </Svg>
    </View>
  );
}
