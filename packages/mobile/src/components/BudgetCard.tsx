import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Budget } from '../types';
import { formatCurrency } from '../utils/format';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../utils/theme';

interface BudgetCardProps {
  budget: Budget;
  onPress?: (budget: Budget) => void;
}

function getProgressColor(percentUsed: number): string {
  if (percentUsed >= 100) return colors.danger[500];
  if (percentUsed >= 80) return colors.accent[500];
  return colors.primary[500];
}

function getStatusLabel(percentUsed: number): { label: string; color: string } {
  if (percentUsed >= 100)
    return { label: 'Over Budget', color: colors.danger[400] };
  if (percentUsed >= 80)
    return { label: 'Near Limit', color: colors.accent[400] };
  if (percentUsed >= 50)
    return { label: 'On Track', color: colors.primary[400] };
  return { label: 'Under Budget', color: colors.primary[400] };
}

function getCategoryInitial(name: string | null): string {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export default function BudgetCard({ budget, onPress }: BudgetCardProps) {
  const progressWidth = Math.min(budget.percentUsed, 100);
  const progressColor = getProgressColor(budget.percentUsed);
  const status = getStatusLabel(budget.percentUsed);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress?.(budget)}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: (budget.categoryColor ?? '#64748b') + '25',
              },
            ]}
          >
            <Text
              style={[
                styles.iconText,
                { color: budget.categoryColor ?? '#64748b' },
              ]}
            >
              {getCategoryInitial(budget.categoryName)}
            </Text>
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {budget.categoryName ?? 'Unknown Category'}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: status.color + '18', borderColor: status.color + '30' },
                ]}
              >
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.period}>{budget.period}</Text>
          </View>
        </View>
      </View>

      {/* Amounts */}
      <View style={styles.amountRow}>
        <View style={styles.spentRow}>
          <Text style={styles.spentAmount}>{formatCurrency(budget.spent)}</Text>
          <Text style={styles.spentOf}> of {formatCurrency(budget.amount)}</Text>
        </View>
        <Text
          style={[
            styles.remaining,
            { color: budget.remaining >= 0 ? colors.primary[400] : colors.danger[400] },
          ]}
        >
          {budget.remaining >= 0
            ? `${formatCurrency(budget.remaining)} left`
            : `${formatCurrency(Math.abs(budget.remaining))} over`}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressWidth}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.percentText, { color: progressColor }]}>
          {budget.percentUsed.toFixed(0)}% used
        </Text>
        {budget.percentUsed >= 100 && (
          <Text style={styles.overText}>
            Over by {formatCurrency(budget.spent - budget.amount)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '50',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surface[750],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  statusBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
  },
  period: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    marginTop: 2,
    textTransform: 'capitalize',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  spentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spentAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  spentOf: {
    fontSize: fontSize.sm,
    color: colors.surface[500],
  },
  remaining: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surface[700] + '99',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  overText: {
    fontSize: fontSize.xs,
    color: colors.danger[400],
  },
});
