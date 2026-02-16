import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Account } from '../types';
import { formatCurrency } from '../utils/format';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../utils/theme';

interface AccountCardProps {
  account: Account;
  onPress?: (account: Account) => void;
}

const typeLabels: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  investment: 'Investment',
  loan: 'Loan',
  mortgage: 'Mortgage',
  other: 'Other',
};

const typeColors: Record<string, string> = {
  checking: colors.primary[500],
  savings: '#06b6d4',
  credit_card: '#f97316',
  investment: '#8b5cf6',
  loan: colors.danger[500],
  mortgage: colors.danger[400],
  other: colors.surface[500],
};

function getTypeIcon(type: string): string {
  switch (type) {
    case 'checking':
      return 'C';
    case 'savings':
      return 'S';
    case 'credit_card':
      return 'CC';
    case 'investment':
      return 'I';
    case 'loan':
      return 'L';
    case 'mortgage':
      return 'M';
    default:
      return 'O';
  }
}

export default function AccountCard({ account, onPress }: AccountCardProps) {
  const accentColor = typeColors[account.type] ?? colors.surface[500];
  const isLiability = ['credit_card', 'loan', 'mortgage'].includes(account.type);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress?.(account)}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: accentColor + '20' }]}>
          <Text style={[styles.iconText, { color: accentColor }]}>
            {getTypeIcon(account.type)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={styles.meta}>
            {typeLabels[account.type] ?? 'Account'}
            {account.institutionName ? ` - ${account.institutionName}` : ''}
          </Text>
        </View>
        <Text
          style={[
            styles.balance,
            { color: isLiability ? colors.danger[400] : colors.white },
          ]}
        >
          {formatCurrency(account.currentBalance)}
        </Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surface[750],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    marginTop: 2,
  },
  balance: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
});
