import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import type { CategorySpending } from '../types';
import { formatCurrencyCompact } from '../utils/format';
import { colors, fontSize, fontWeight, spacing } from '../utils/theme';

interface SpendingChartProps {
  data: CategorySpending[];
  height?: number;
}

const CHART_COLORS = [
  colors.primary[500],
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
];

export default function SpendingChart({
  data,
  height = 200,
}: SpendingChartProps) {
  if (!data.length) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No spending data</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.xl * 2;
  const chartWidth = Math.max(screenWidth, 200);
  const chartHeight = height - 40;
  const maxAmount = Math.max(...data.map((d) => d.amount));
  const barCount = Math.min(data.length, 8);
  const barWidth = Math.max(
    (chartWidth - (barCount - 1) * 6) / barCount - 4,
    12,
  );
  const barSpacing = (chartWidth - barCount * barWidth) / (barCount + 1);

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={height}>
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <Line
            key={pct}
            x1={0}
            y1={chartHeight * (1 - pct)}
            x2={chartWidth}
            y2={chartHeight * (1 - pct)}
            stroke={colors.surface[700]}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Bars */}
        {data.slice(0, barCount).map((item, i) => {
          const barHeight =
            maxAmount > 0 ? (item.amount / maxAmount) * (chartHeight - 20) : 0;
          const x = barSpacing + i * (barWidth + barSpacing);
          const y = chartHeight - barHeight;
          const barColor = item.categoryColor || CHART_COLORS[i % CHART_COLORS.length];

          return (
            <React.Fragment key={item.categoryId}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={barColor}
                opacity={0.85}
              />
              {/* Category label below */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 4}
                fontSize={9}
                fill={colors.surface[500]}
                textAnchor="middle"
              >
                {item.categoryName.length > 6
                  ? item.categoryName.slice(0, 5) + '...'
                  : item.categoryName}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {data.slice(0, 4).map((item, i) => (
          <View key={item.categoryId} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    item.categoryColor || CHART_COLORS[i % CHART_COLORS.length],
                },
              ]}
            />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {item.categoryName}
            </Text>
            <Text style={styles.legendValue}>
              {formatCurrencyCompact(item.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.surface[500],
    textAlign: 'center',
    marginTop: 40,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: colors.surface[400],
    maxWidth: 60,
  },
  legendValue: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.surface[300],
    fontVariant: ['tabular-nums'],
  },
});
