import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Transaction, AccountType } from '../types';
import { formatCurrency, formatDate, getMerchantInitials, getHashColor } from '../utils/format';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../utils/theme';

interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
}

function isIncome(tx: Transaction): boolean {
  const debtTypes: AccountType[] = ['credit_card', 'loan', 'mortgage'];
  const amount = debtTypes.includes(tx.accountType ?? 'checking') ? -tx.amount : tx.amount;
  return amount < 0;
}

function getDisplayAmount(tx: Transaction): string {
  const debtTypes: AccountType[] = ['credit_card', 'loan', 'mortgage'];
  const amount = debtTypes.includes(tx.accountType ?? 'checking') ? -tx.amount : tx.amount;
  return formatCurrency(amount);
}

export default function TransactionItem({ transaction, onPress }: TransactionItemProps) {
  const displayName = transaction.merchantName || transaction.name;
  const initials = getMerchantInitials(displayName);
  const avatarColor = getHashColor(displayName);
  const income = isIncome(transaction);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress?.(transaction)}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor + '30' }]}>
        <Text style={[styles.avatarText, { color: avatarColor }]}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {transaction.pending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{formatDate(transaction.date)}</Text>
          {transaction.categoryName && (
            <>
              <Text style={styles.metaDivider}>|</Text>
              {transaction.categoryColor && (
                <View
                  style={[styles.categoryDot, { backgroundColor: transaction.categoryColor }]}
                />
              )}
              <Text
                style={[
                  styles.meta,
                  transaction.categoryColor ? { color: transaction.categoryColor } : undefined,
                ]}
              >
                {transaction.categoryName}
              </Text>
            </>
          )}
          {!transaction.categoryName && (
            <>
              <Text style={styles.metaDivider}>|</Text>
              <Text style={styles.metaItalic}>Uncategorized</Text>
            </>
          )}
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, income ? styles.amountIncome : styles.amountExpense]}>
          {income ? '+' : ''}
          {getDisplayAmount(transaction)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.surface[700] + '50',
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surface[750],
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.white,
    flexShrink: 1,
  },
  pendingBadge: {
    backgroundColor: colors.accent[500] + '18',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent[500] + '30',
  },
  pendingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.accent[400],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
  },
  metaDivider: {
    fontSize: fontSize.xs,
    color: colors.surface[600],
  },
  metaItalic: {
    fontSize: fontSize.xs,
    color: colors.surface[600],
    fontStyle: 'italic',
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  amountIncome: {
    color: colors.primary[400],
  },
  amountExpense: {
    color: colors.surface[200],
  },
});
