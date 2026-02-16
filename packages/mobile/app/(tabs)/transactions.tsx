import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { listTransactions, updateTransaction } from '../../src/api/transactions';
import TransactionItem from '../../src/components/TransactionItem';
import type { Transaction, PaginatedResponse } from '../../src/types';
import { getDateGroupLabel } from '../../src/utils/format';
import { useAppStore } from '../../src/stores/app';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

type GroupedItem =
  | { type: 'header'; label: string }
  | { type: 'transaction'; data: Transaction };

export default function TransactionsScreen() {
  const { searchQuery, setSearchQuery, filterCategoryId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const fetchTransactions = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      try {
        const result = await listTransactions({
          page: pageNum,
          limit: 20,
          search: searchQuery || undefined,
          categoryId: filterCategoryId || undefined,
        });
        if (reset) {
          setTransactions(result.data);
        } else {
          setTransactions((prev) => [...prev, ...result.data]);
        }
        setPage(result.meta.page);
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      } catch {
        // Handle error silently
      }
    },
    [searchQuery, filterCategoryId],
  );

  useEffect(() => {
    setLoading(true);
    fetchTransactions(1, true).finally(() => setLoading(false));
  }, [fetchTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions(1, true);
    setRefreshing(false);
  }, [fetchTransactions]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    await fetchTransactions(page + 1);
    setLoadingMore(false);
  }, [loadingMore, page, totalPages, fetchTransactions]);

  function handleSearch() {
    setSearchQuery(localSearch);
  }

  // Group transactions by date
  const groupedItems: GroupedItem[] = [];
  let lastLabel = '';
  for (const tx of transactions) {
    const label = getDateGroupLabel(tx.date);
    if (label !== lastLabel) {
      groupedItems.push({ type: 'header', label });
      lastLabel = label;
    }
    groupedItems.push({ type: 'transaction', data: tx });
  }

  function renderItem({ item }: { item: GroupedItem }) {
    if (item.type === 'header') {
      return (
        <View style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{item.label}</Text>
          <View style={styles.groupDivider} />
        </View>
      );
    }
    return <TransactionItem transaction={item.data} />;
  }

  function keyExtractor(item: GroupedItem, index: number): string {
    if (item.type === 'header') return `header-${item.label}-${index}`;
    return item.data.id;
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
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            style={styles.searchInput}
            value={localSearch}
            onChangeText={setLocalSearch}
            placeholder="Search transactions..."
            placeholderTextColor={colors.surface[500]}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.searchButtonPressed,
          ]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {/* Results count */}
      {total > 0 && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {total.toLocaleString()} transaction
            {total !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No transactions</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try a different search term'
              : 'Link a bank account or add transactions manually'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
              colors={[colors.primary[500]]}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary[500]}
                />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface[900],
  },
  searchContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface[800],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[700] + '50',
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInput: {
    backgroundColor: colors.surface[750],
    borderWidth: 1,
    borderColor: colors.surface[600] + '50',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  searchButton: {
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  searchButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.white,
  },
  countRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countText: {
    fontSize: fontSize.xs,
    color: colors.surface[400],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  separator: {
    height: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  groupLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.surface[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupDivider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surface[700] + '80',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
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
  },
  loadingMore: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
});
