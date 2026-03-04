import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  listBudgets,
  getBudgetSummary,
  createBudget,
} from '../../src/api/budgets';
import BudgetCard from '../../src/components/BudgetCard';
import type { Budget, BudgetSummary, BudgetPeriod } from '../../src/types';
import { formatCurrency, formatCurrencyCompact } from '../../src/utils/format';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [budgetList, budgetSummary] = await Promise.all([
        listBudgets(),
        getBudgetSummary().catch(() => null),
      ]);
      setBudgets(budgetList);
      setSummary(budgetSummary);
    } catch {
      // Handle silently
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  async function handleCreate() {
    setCreateError('');
    if (!categoryId.trim()) {
      setCreateError('Category ID is required');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCreateError('Enter a valid amount');
      return;
    }

    setCreating(true);
    try {
      await createBudget({
        categoryId: categoryId.trim(),
        amount: amountNum,
        period,
      });
      setShowCreateModal(false);
      setCategoryId('');
      setAmount('');
      setPeriod('monthly');
      await fetchData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setCreateError(error.response?.data?.message ?? 'Failed to create budget');
    } finally {
      setCreating(false);
    }
  }

  const onTrackCount = budgets.filter((b) => b.percentUsed < 80).length;
  const nearLimitCount = budgets.filter(
    (b) => b.percentUsed >= 80 && b.percentUsed < 100,
  ).length;
  const overBudgetCount = budgets.filter((b) => b.percentUsed >= 100).length;

  function getOverallProgressColor(): string {
    if (!summary) return colors.primary[500];
    if (summary.percentUsed >= 100) return colors.danger[500];
    if (summary.percentUsed >= 80) return colors.accent[500];
    return colors.primary[500];
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Summary strip */}
        {summary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Budget</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyCompact(summary.totalBudgeted)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Spent</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyCompact(summary.totalSpent)}
              </Text>
            </View>
          </View>
        )}

        {summary && (
          <View style={styles.overallCard}>
            <View style={styles.overallHeader}>
              <Text style={styles.overallLabel}>Overall Progress</Text>
              <Text
                style={[
                  styles.overallPercent,
                  { color: getOverallProgressColor() },
                ]}
              >
                {summary.percentUsed.toFixed(0)}% used
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(summary.percentUsed, 100)}%`,
                    backgroundColor: getOverallProgressColor(),
                  },
                ]}
              />
            </View>
            <View style={styles.overallStats}>
              {onTrackCount > 0 && (
                <Text style={styles.statOnTrack}>
                  {onTrackCount} on track
                </Text>
              )}
              {nearLimitCount > 0 && (
                <Text style={styles.statNearLimit}>
                  {nearLimitCount} near limit
                </Text>
              )}
              {overBudgetCount > 0 && (
                <Text style={styles.statOverBudget}>
                  {overBudgetCount} over budget
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Create button */}
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
          ]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Create Budget</Text>
        </Pressable>

        {/* Budget cards */}
        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptySubtitle}>
              Create budgets to track your spending by category and stay on top
              of your finances.
            </Text>
          </View>
        ) : (
          <View style={styles.budgetList}>
            {budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Budget Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreateModal(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Create Budget</Text>

            {createError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category ID</Text>
              <TextInput
                style={styles.formInput}
                value={categoryId}
                onChangeText={setCategoryId}
                placeholder="Enter category ID"
                placeholderTextColor={colors.surface[500]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Amount</Text>
              <TextInput
                style={styles.formInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="500.00"
                placeholderTextColor={colors.surface[500]}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Period</Text>
              <View style={styles.periodRow}>
                {(['monthly', 'quarterly', 'yearly'] as BudgetPeriod[]).map(
                  (p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.periodChip,
                        period === p && styles.periodChipActive,
                      ]}
                      onPress={() => setPeriod(p)}
                    >
                      <Text
                        style={[
                          styles.periodChipText,
                          period === p && styles.periodChipTextActive,
                        ]}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCreateButton,
                  pressed && styles.modalCreateButtonPressed,
                  creating && styles.modalCreateButtonDisabled,
                ]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalCreateText}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface[900],
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing.lg,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.surface[400],
  },
  summaryValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },

  // Overall card
  overallCard: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overallLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[400],
  },
  overallPercent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
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
  overallStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statOnTrack: {
    fontSize: fontSize.xs,
    color: colors.primary[400],
  },
  statNearLimit: {
    fontSize: fontSize.xs,
    color: colors.accent[400],
  },
  statOverBudget: {
    fontSize: fontSize.xs,
    color: colors.danger[400],
  },

  // Create button
  createButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  createButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  createButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },

  // Budget list
  budgetList: {
    gap: spacing.md,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 300,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: colors.surface[800],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    paddingBottom: spacing['5xl'],
    gap: spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface[600],
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  errorBox: {
    backgroundColor: colors.danger[500] + '15',
    borderWidth: 1,
    borderColor: colors.danger[500] + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.danger[400],
  },
  formGroup: {
    gap: spacing.sm,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[300],
  },
  formInput: {
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.white,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodChip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    backgroundColor: colors.surface[750],
    alignItems: 'center',
  },
  periodChipActive: {
    borderColor: colors.primary[500] + '60',
    backgroundColor: colors.primary[600] + '20',
  },
  periodChipText: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
  },
  periodChipTextActive: {
    color: colors.primary[400],
    fontWeight: fontWeight.semibold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface[600],
  },
  modalCancelText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.surface[400],
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  modalCreateButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  modalCreateButtonDisabled: {
    opacity: 0.7,
  },
  modalCreateText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
