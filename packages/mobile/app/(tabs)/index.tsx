import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getNetWorth, listAccounts } from '../../src/api/accounts';
import { listTransactions } from '../../src/api/transactions';
import { listBudgets, getBudgetSummary } from '../../src/api/budgets';
import client from '../../src/api/client';
import { useAuthStore } from '../../src/stores/auth';
import type {
  NetWorth,
  Account,
  Transaction,
  Budget,
  BudgetSummary,
  HealthScore,
} from '../../src/types';
import AccountCard from '../../src/components/AccountCard';
import TransactionItem from '../../src/components/TransactionItem';
import HealthScoreCircle from '../../src/components/HealthScoreCircle';
import {
  formatCurrency,
  formatCurrencyCompact,
} from '../../src/utils/format';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [monthlySpending, setMonthlySpending] = useState(0);

  async function openUrl(url: string, title: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(title, 'Unable to open that link on this device.');
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(title, 'Unable to open that link right now.');
    }
  }

  function handleOpenAccounts() {
    if (!webUrl) {
      Alert.alert(
        'Link Accounts',
        'Set EXPO_PUBLIC_WEB_URL to open account linking from mobile.',
      );
      return;
    }

    void openUrl(`${webUrl}/accounts`, 'Link Accounts');
  }

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setNetWorth(null);
      setAccounts([]);
      setRecentTransactions([]);
      setBudgets([]);
      setBudgetSummary(null);
      setHealthScore(null);
      setMonthlySpending(0);
      return;
    }

    try {
      const [nw, accts, txResult, budgetList, summary] = await Promise.all([
        getNetWorth().catch(() => null),
        listAccounts().catch(() => []),
        listTransactions({ limit: 5 }).catch(() => ({ data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } })),
        listBudgets().catch(() => []),
        getBudgetSummary().catch(() => null),
      ]);

      setNetWorth(nw);
      setAccounts(accts);
      setRecentTransactions(txResult.data);
      setBudgets(budgetList);
      setBudgetSummary(summary);

      // Fetch health score separately (optional endpoint)
      try {
        const { data: score } = await client.get<HealthScore>('/financial-health/score');
        setHealthScore(score);
      } catch {
        // Health score not available
      }

      // Calculate monthly spending from budget summary or default
      if (summary) {
        setMonthlySpending(summary.totalSpent);
      }
    } catch {
      // Silently handle errors on dashboard
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    fetchData().finally(() => setLoading(false));
  }, [fetchData, isAuthenticated]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  const hasData =
    (netWorth?.accountCount ?? 0) > 0 ||
    recentTransactions.length > 0 ||
    budgets.length > 0;

  return (
    <ScrollView
      style={styles.screen}
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
      {/* ── Summary Cards ──────────────────────────────────────────────── */}

      {/* Net Worth Hero */}
      <View style={styles.netWorthCard}>
        <View style={styles.netWorthBadge}>
          <Text style={styles.netWorthBadgeText}>$</Text>
        </View>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text
          style={[
            styles.netWorthValue,
            (netWorth?.netWorth ?? 0) < 0 && styles.netWorthNegative,
          ]}
        >
          {formatCurrency(netWorth?.netWorth ?? 0)}
        </Text>
        <View style={styles.netWorthMeta}>
          <Text style={styles.netWorthMetaText}>
            {netWorth?.accountCount ?? 0} account
            {(netWorth?.accountCount ?? 0) !== 1 ? 's' : ''}
          </Text>
          {(netWorth?.assets ?? 0) > 0 && (
            <Text style={styles.netWorthAssetsText}>
              {formatCurrency(netWorth?.assets ?? 0)} assets
            </Text>
          )}
        </View>
      </View>

      {/* Spending + Budget Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCardBlue}>
          <Text style={styles.summaryLabel}>Monthly Spending</Text>
          <Text style={styles.summaryValue}>
            {formatCurrencyCompact(monthlySpending)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Budget Remaining</Text>
          {budgetSummary ? (
            <>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      budgetSummary.totalRemaining >= 0
                        ? colors.primary[400]
                        : colors.danger[400],
                  },
                ]}
              >
                {formatCurrencyCompact(budgetSummary.totalRemaining)}
              </Text>
              <View style={styles.miniProgressTrack}>
                <View
                  style={[
                    styles.miniProgressFill,
                    {
                      width: `${Math.min(budgetSummary.percentUsed, 100)}%`,
                      backgroundColor:
                        budgetSummary.percentUsed >= 100
                          ? colors.danger[500]
                          : budgetSummary.percentUsed >= 80
                          ? colors.accent[500]
                          : colors.primary[500],
                    },
                  ]}
                />
              </View>
              <Text style={styles.miniProgressLabel}>
                {budgetSummary.percentUsed.toFixed(0)}% of{' '}
                {formatCurrencyCompact(budgetSummary.totalBudgeted)}
              </Text>
            </>
          ) : (
            <Text style={styles.summaryValueMuted}>--</Text>
          )}
        </View>
      </View>

      {/* ── Health Score ────────────────────────────────────────────────── */}
      {healthScore && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Health</Text>
          <View style={styles.healthCard}>
            <HealthScoreCircle score={healthScore.overallScore} size={120} />
          </View>
        </View>
      )}

      {/* ── Budget Progress ────────────────────────────────────────────── */}
      {budgets.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Progress</Text>
            <Pressable onPress={() => router.push('/(tabs)/budgets')}>
              <Text style={styles.sectionLink}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.budgetProgressList}>
            {budgets.slice(0, 3).map((budget) => {
              const pct = Math.min(budget.percentUsed, 100);
              const barColor =
                budget.percentUsed >= 100
                  ? colors.danger[500]
                  : budget.percentUsed >= 80
                  ? colors.accent[500]
                  : colors.primary[500];
              return (
                <View key={budget.id} style={styles.budgetProgressItem}>
                  <View style={styles.budgetProgressHeader}>
                    <Text style={styles.budgetProgressName}>
                      {budget.categoryName ?? 'Unknown'}
                    </Text>
                    <Text style={styles.budgetProgressAmount}>
                      {formatCurrencyCompact(budget.spent)} /{' '}
                      {formatCurrencyCompact(budget.amount)}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Account Balances ───────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accounts</Text>
          <View style={styles.accountList}>
            {accounts
              .filter((a) => !a.isHidden)
              .slice(0, 4)
              .map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
          </View>
        </View>
      )}

      {/* ── Recent Transactions ────────────────────────────────────────── */}
      {recentTransactions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.sectionLink}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.transactionList}>
            {recentTransactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))}
          </View>
        </View>
      )}

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {!hasData && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>$</Text>
          </View>
          <Text style={styles.emptyEyebrow}>Set up your money view</Text>
          <Text style={styles.emptyTitle}>Welcome to FinanceOwl</Text>
          <Text style={styles.emptySubtitle}>
            Get started by linking your bank accounts. We will automatically
            track your spending, net worth, and budget progress.
          </Text>
          <View style={styles.emptyActionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.emptyPrimaryButton,
                pressed && styles.emptyPrimaryButtonPressed,
              ]}
              onPress={handleOpenAccounts}
            >
              <Text style={styles.emptyPrimaryButtonText}>
                Link Accounts on Web
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.emptySecondaryButton,
                pressed && styles.emptySecondaryButtonPressed,
              ]}
              onPress={() => router.push('/(tabs)/budgets')}
            >
              <Text style={styles.emptySecondaryButtonText}>
                Create a Budget
              </Text>
            </Pressable>
          </View>
          <Text style={styles.emptyFootnote}>
            Account linking is handled in the web app for now.
          </Text>
        </View>
      )}
    </ScrollView>
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
    gap: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface[900],
  },

  // Net Worth
  netWorthCard: {
    backgroundColor: colors.primary[950],
    borderRadius: borderRadius['2xl'],
    borderWidth: 1,
    borderColor: colors.primary[800] + '60',
    padding: spacing['2xl'],
  },
  netWorthBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  netWorthBadgeText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary[400],
  },
  netWorthLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[300] + 'CC',
  },
  netWorthValue: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  netWorthNegative: {
    color: colors.danger[400],
  },
  netWorthMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  netWorthMetaText: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
  },
  netWorthAssetsText: {
    fontSize: fontSize.sm,
    color: colors.primary[400],
  },

  // Summary row
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
  summaryCardBlue: {
    flex: 1,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#1e3a5f80',
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
  summaryValueMuted: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.surface[500],
    marginTop: spacing.xs,
  },
  miniProgressTrack: {
    height: 5,
    backgroundColor: colors.surface[700],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  miniProgressLabel: {
    fontSize: 10,
    color: colors.surface[500],
    marginTop: 3,
  },

  // Sections
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  sectionLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[400],
  },

  // Health
  healthCard: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing['2xl'],
    alignItems: 'center',
  },

  // Budget progress
  budgetProgressList: {
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  budgetProgressItem: {
    gap: spacing.sm,
  },
  budgetProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetProgressName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
  budgetProgressAmount: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surface[700] + '99',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  // Account list
  accountList: {
    gap: spacing.sm,
  },

  // Transaction list
  transactionList: {
    gap: spacing.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing['2xl'],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.primary[500] + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  emptyIconText: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.primary[400] + '99',
  },
  emptyEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[400],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
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
  emptyActionRow: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  emptyPrimaryButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyPrimaryButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  emptyPrimaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  emptySecondaryButton: {
    backgroundColor: colors.surface[750],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptySecondaryButtonPressed: {
    backgroundColor: colors.surface[700],
  },
  emptySecondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.surface[200],
  },
  emptyFootnote: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
    maxWidth: 280,
  },
});
