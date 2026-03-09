import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import {
  listBudgets,
  getBudgetSummary,
  createBudget,
} from '../../src/api/budgets';
import { listCategories } from '../../src/api/categories';
import { getApiErrorMessage } from '../../src/api/client';
import BudgetCard from '../../src/components/BudgetCard';
import { hapticFeedback } from '../../src/native';
import type {
  Budget,
  BudgetSummary,
  BudgetPeriod,
  Category,
} from '../../src/types';
import { formatCurrencyCompact } from '../../src/utils/format';
import {
  colors,
  fontSize,
  fontWeight,
  borderRadius,
  spacing,
} from '../../src/utils/theme';

const CREATE_PERIOD_OPTIONS: Array<{
  value: BudgetPeriod;
  label: string;
  hint: string;
}> = [
  { value: 'weekly', label: 'Weekly', hint: 'Reset every 7 days' },
  { value: 'biweekly', label: 'Biweekly', hint: 'Reset every 2 weeks' },
  { value: 'monthly', label: 'Monthly', hint: 'Best for most spending plans' },
  { value: 'quarterly', label: 'Quarterly', hint: 'Useful for seasonal bills' },
  { value: 'annual', label: 'Annual', hint: 'For long-term spending targets' },
];

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function normalizeAmountInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, '');

  if (!sanitized) {
    return '';
  }

  const [whole, ...fractionParts] = sanitized.split('.');
  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole || '0'}.${fractionParts.join('').slice(0, 2)}`;
}

function getCategorySubtitle(
  category: Category,
  categories: Category[],
): string {
  if (category.parentId) {
    const parent = categories.find((item) => item.id === category.parentId);
    return parent ? `Part of ${parent.name}` : 'Selected subcategory';
  }

  const childCount = categories.filter(
    (item) => item.parentId === category.id,
  ).length;

  if (childCount === 0) {
    return 'Track this category total';
  }

  return `${childCount} subcategor${childCount === 1 ? 'y' : 'ies'} included`;
}

export default function BudgetsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('monthly');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const sortedCategories = sortCategories(categories);
  const selectedCategory =
    sortedCategories.find((category) => category.id === categoryId) ?? null;
  const topLevelCategories = sortedCategories.filter(
    (category) => !category.parentId,
  );
  const existingBudget =
    budgets.find(
      (budget) => budget.categoryId === categoryId && budget.period === period,
    ) ?? null;

  const fetchBudgets = useCallback(async () => {
    try {
      const [budgetList, budgetSummary] = await Promise.all([
        listBudgets().catch(() => []),
        getBudgetSummary().catch(() => null),
      ]);

      setBudgets(budgetList);
      setSummary(budgetSummary);
    } catch {
      setBudgets([]);
      setSummary(null);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);

    try {
      const categoryList = await listCategories().catch(() => []);
      setCategories(categoryList);
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchBudgets(), fetchCategories()]).finally(() =>
      setLoading(false),
    );
  }, [fetchBudgets, fetchCategories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBudgets(), fetchCategories()]);
    setRefreshing(false);
  }, [fetchBudgets, fetchCategories]);

  function resetCreateForm() {
    setCategoryId('');
    setAmount('');
    setPeriod('monthly');
    setCreateError('');
    setShowCategoryPicker(false);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    resetCreateForm();
  }

  async function handleSelectCategory(category: Category) {
    setCategoryId(category.id);
    setCreateError('');
    setShowCategoryPicker(false);
    await hapticFeedback('light');
  }

  async function handleCreate() {
    setCreateError('');

    if (!categoryId.trim()) {
      setCreateError('Select a category to budget.');
      return;
    }

    if (existingBudget) {
      setCreateError(
        `A ${period} budget already exists for ${selectedCategory?.name ?? 'this category'}.`,
      );
      return;
    }

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setCreateError('Enter a valid amount greater than zero.');
      return;
    }

    setCreating(true);

    try {
      await createBudget({
        categoryId: categoryId.trim(),
        amount: amountNum,
        period,
      });
      await hapticFeedback('medium');
      closeCreateModal();
      await fetchBudgets();
    } catch (error) {
      setCreateError(getApiErrorMessage(error, 'Failed to create budget'));
    } finally {
      setCreating(false);
    }
  }

  const onTrackCount = budgets.filter((budget) => budget.percentUsed < 80).length;
  const nearLimitCount = budgets.filter(
    (budget) => budget.percentUsed >= 80 && budget.percentUsed < 100,
  ).length;
  const overBudgetCount = budgets.filter((budget) => budget.percentUsed >= 100).length;

  function getChildCategories(parentId: string): Category[] {
    return sortedCategories.filter((category) => category.parentId === parentId);
  }

  function getOverallProgressColor(): string {
    if (!summary) return colors.primary[500];
    if (summary.percentUsed >= 100) return colors.danger[500];
    if (summary.percentUsed >= 80) return colors.accent[500];
    return colors.primary[500];
  }

  function renderCategoryOption(category: Category, indentLevel: 0 | 1 = 0) {
    const isSelected = category.id === selectedCategory?.id;

    return (
      <Pressable
        key={category.id}
        style={({ pressed }) => [
          styles.categoryOption,
          indentLevel === 1 && styles.categoryOptionChild,
          isSelected && styles.categoryOptionSelected,
          pressed && styles.categoryOptionPressed,
        ]}
        onPress={() => {
          void handleSelectCategory(category);
        }}
      >
        <View
          style={[
            styles.categorySwatch,
            { backgroundColor: category.color ?? colors.surface[500] },
          ]}
        />
        <View style={styles.categoryOptionCopy}>
          <Text style={styles.categoryOptionTitle}>{category.name}</Text>
          <Text style={styles.categoryOptionSubtitle}>
            {getCategorySubtitle(category, sortedCategories)}
          </Text>
        </View>
        <View
          style={[
            styles.categorySelectionIndicator,
            isSelected && styles.categorySelectionIndicatorActive,
          ]}
        />
      </Pressable>
    );
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
                <Text style={styles.statOnTrack}>{onTrackCount} on track</Text>
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

        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
          ]}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>Create Budget</Text>
        </Pressable>

        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEyebrow}>Start with one focused category</Text>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first budget by picking a category and setting a limit.
              Parent categories cover all subcategories automatically.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyActionButton,
                pressed && styles.emptyActionButtonPressed,
              ]}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.emptyActionButtonText}>
                Create Your First Budget
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.budgetList}>
            {budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeCreateModal} />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Budget</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a category, set a limit, and pick how often it resets.
                </Text>
              </View>

              {createError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{createError}</Text>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Category</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.categoryTrigger,
                    pressed && styles.categoryTriggerPressed,
                  ]}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <View style={styles.categoryTriggerContent}>
                    {selectedCategory ? (
                      <>
                        <View
                          style={[
                            styles.categorySwatch,
                            {
                              backgroundColor:
                                selectedCategory.color ?? colors.surface[500],
                            },
                          ]}
                        />
                        <View style={styles.categoryTriggerCopy}>
                          <Text style={styles.categoryTriggerLabel}>
                            {selectedCategory.name}
                          </Text>
                          <Text style={styles.categoryTriggerHint}>
                            {getCategorySubtitle(selectedCategory, sortedCategories)}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.categoryTriggerCopy}>
                        <Text style={styles.categoryTriggerPlaceholder}>
                          {categoriesLoading
                            ? 'Loading categories...'
                            : 'Choose a category'}
                        </Text>
                        <Text style={styles.categoryTriggerHint}>
                          Pick a broad category or a subcategory.
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.categoryTriggerAction}>Browse</Text>
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Amount</Text>
                <View style={styles.amountField}>
                  <Text style={styles.amountPrefix}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(nextValue) => {
                      setAmount(normalizeAmountInput(nextValue));
                      setCreateError('');
                    }}
                    placeholder="500.00"
                    placeholderTextColor={colors.surface[500]}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Period</Text>
                <View style={styles.periodGrid}>
                  {CREATE_PERIOD_OPTIONS.map((option) => {
                    const isSelected = option.value === period;

                    return (
                      <Pressable
                        key={option.value}
                        style={({ pressed }) => [
                          styles.periodChip,
                          isSelected && styles.periodChipSelected,
                          pressed && styles.periodChipPressed,
                        ]}
                        onPress={() => {
                          setPeriod(option.value);
                          setCreateError('');
                        }}
                      >
                        <Text
                          style={[
                            styles.periodChipLabel,
                            isSelected && styles.periodChipLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.periodChipHint,
                            isSelected && styles.periodChipHintSelected,
                          ]}
                        >
                          {option.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {existingBudget ? (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    You already have a {period} budget for{' '}
                    {selectedCategory?.name ?? 'this category'}. Update the
                    existing budget instead of creating a duplicate.
                  </Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                  onPress={closeCreateModal}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (creating || categoriesLoading || !!existingBudget) &&
                      styles.primaryButtonDisabled,
                    pressed &&
                      !(creating || categoriesLoading || !!existingBudget) &&
                      styles.primaryButtonPressed,
                  ]}
                  onPress={() => {
                    void handleCreate();
                  }}
                  disabled={creating || categoriesLoading || !!existingBudget}
                >
                  <Text style={styles.primaryButtonText}>
                    {creating ? 'Creating...' : 'Create Budget'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCategoryPicker(false)}
          />
          <View style={styles.pickerContent}>
            <View style={styles.modalHandle} />
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderCopy}>
                <Text style={styles.modalTitle}>Choose Category</Text>
                <Text style={styles.modalSubtitle}>
                  Pick a parent category for broad coverage or a subcategory for
                  tighter control.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.pickerDoneButton,
                  pressed && styles.pickerDoneButtonPressed,
                ]}
                onPress={() => setShowCategoryPicker(false)}
              >
                <Text style={styles.pickerDoneButtonText}>Done</Text>
              </Pressable>
            </View>

            {categoriesLoading ? (
              <View style={styles.pickerLoadingState}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text style={styles.pickerLoadingText}>Loading categories...</Text>
              </View>
            ) : topLevelCategories.length === 0 ? (
              <View style={styles.pickerEmptyState}>
                <Text style={styles.pickerEmptyTitle}>No categories available</Text>
                <Text style={styles.pickerEmptySubtitle}>
                  Pull to refresh the budgets screen and try again.
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.pickerList}
                showsVerticalScrollIndicator={false}
              >
                {topLevelCategories.map((category) => (
                  <View key={category.id} style={styles.pickerSection}>
                    {renderCategoryOption(category)}
                    {getChildCategories(category.id).map((childCategory) =>
                      renderCategoryOption(childCategory, 1),
                    )}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
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
    flexWrap: 'wrap',
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
  budgetList: {
    gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
  },
  emptyEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[400],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
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
    maxWidth: 320,
  },
  emptyActionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  emptyActionButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  emptyActionButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: colors.surface[800],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  modalBody: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface[600],
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalHeader: {
    gap: spacing.xs,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
    lineHeight: 20,
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
    lineHeight: 20,
  },
  noticeBox: {
    backgroundColor: colors.accent[500] + '12',
    borderWidth: 1,
    borderColor: colors.accent[500] + '30',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  noticeText: {
    fontSize: fontSize.sm,
    color: colors.accent[400],
    lineHeight: 20,
  },
  formGroup: {
    gap: spacing.sm,
  },
  formLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[300],
  },
  categoryTrigger: {
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  categoryTriggerPressed: {
    backgroundColor: colors.surface[700],
  },
  categoryTriggerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryTriggerCopy: {
    flex: 1,
    gap: 2,
  },
  categoryTriggerLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  categoryTriggerHint: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
  },
  categoryTriggerPlaceholder: {
    fontSize: fontSize.base,
    color: colors.surface[500],
  },
  categoryTriggerAction: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[400],
  },
  categorySwatch: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
  },
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
  },
  amountPrefix: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.surface[300],
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.white,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  periodChip: {
    minWidth: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  periodChipSelected: {
    borderColor: colors.primary[500] + '99',
    backgroundColor: colors.primary[600] + '14',
  },
  periodChipPressed: {
    backgroundColor: colors.surface[700],
  },
  periodChipLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  periodChipLabelSelected: {
    color: colors.primary[300],
  },
  periodChipHint: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    lineHeight: 16,
  },
  periodChipHintSelected: {
    color: colors.primary[200],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    paddingVertical: spacing.md,
    backgroundColor: colors.surface[750],
  },
  secondaryButtonPressed: {
    backgroundColor: colors.surface[700],
  },
  secondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.surface[200],
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[600],
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surface[600],
  },
  primaryButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  primaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  pickerContent: {
    maxHeight: '82%',
    backgroundColor: colors.surface[800],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  pickerHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pickerHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  pickerDoneButton: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
  },
  pickerDoneButtonPressed: {
    backgroundColor: colors.surface[700],
  },
  pickerDoneButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary[300],
  },
  pickerLoadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  pickerLoadingText: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
  },
  pickerEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.sm,
  },
  pickerEmptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  pickerEmptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
    textAlign: 'center',
    lineHeight: 20,
  },
  pickerList: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  pickerSection: {
    gap: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  categoryOptionChild: {
    marginLeft: spacing.lg,
  },
  categoryOptionSelected: {
    borderColor: colors.primary[500] + '90',
    backgroundColor: colors.primary[600] + '16',
  },
  categoryOptionPressed: {
    backgroundColor: colors.surface[700],
  },
  categoryOptionCopy: {
    flex: 1,
  },
  categoryOptionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  categoryOptionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    marginTop: 2,
  },
  categorySelectionIndicator: {
    width: 14,
    height: 14,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.surface[500],
  },
  categorySelectionIndicatorActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
});
