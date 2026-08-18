import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { listTransactions, createTransaction } from '../../src/api/transactions';
import { listAccounts } from '../../src/api/accounts';
import { listCategories } from '../../src/api/categories';
import TransactionItem from '../../src/components/TransactionItem';
import { useAuthStore } from '../../src/stores/auth';
import type { Transaction, Account, Category } from '../../src/types';
import { getDateGroupLabel } from '../../src/utils/format';
import { useAppStore } from '../../src/stores/app';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../../src/utils/theme';

type GroupedItem = { type: 'header'; label: string } | { type: 'transaction'; data: Transaction };

export default function TransactionsScreen() {
  const { isAuthenticated } = useAuthStore();
  const { searchQuery, setSearchQuery, filterCategoryId } = useAppStore();
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') ?? null;
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const hasLoadedRef = useRef(false);
  const deferredSearch = useDeferredValue(localSearch.trim());

  // Add Transaction modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addAccountId, setAddAccountId] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('');
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
      Alert.alert('Link Accounts', 'Set EXPO_PUBLIC_WEB_URL to open account linking from mobile.');
      return;
    }

    void openUrl(`${webUrl}/accounts`, 'Link Accounts');
  }

  const fetchTransactions = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (!isAuthenticated) {
        setTransactions([]);
        setPage(1);
        setTotalPages(1);
        setTotal(0);
        return;
      }

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
    [filterCategoryId, isAuthenticated, searchQuery],
  );

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (deferredSearch !== searchQuery) {
        setSearchQuery(deferredSearch);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [deferredSearch, searchQuery, setSearchQuery]);

  useEffect(() => {
    let isActive = true;

    async function loadTransactions() {
      if (!isAuthenticated) {
        setTransactions([]);
        setPage(1);
        setTotalPages(1);
        setTotal(0);
        setLoading(false);
        setSearching(false);
        return;
      }

      if (hasLoadedRef.current) {
        setSearching(true);
      } else {
        setLoading(true);
      }

      await fetchTransactions(1, true);

      if (!isActive) {
        return;
      }

      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setLoading(false);
      }

      setSearching(false);
    }

    void loadTransactions();

    return () => {
      isActive = false;
    };
  }, [fetchTransactions, isAuthenticated]);

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
    const nextSearch = localSearch.trim();
    setLocalSearch(nextSearch);
    setSearchQuery(nextSearch);
  }

  function clearSearch() {
    setLocalSearch('');
    setSearchQuery('');
  }

  async function openAddModal() {
    setShowAddModal(true);
    setAddName('');
    setAddAmount('');
    setAddDate(new Date().toISOString().slice(0, 10));
    setAddAccountId('');
    setAddCategoryId('');
    try {
      const [accts, cats] = await Promise.all([
        listAccounts().catch(() => []),
        listCategories().catch(() => []),
      ]);
      setAccountsList(accts);
      setCategoriesList(cats);
      if (accts.length > 0) {
        setAddAccountId(accts[0].id);
      }
    } catch {
      // silently handle
    }
  }

  async function handleAddTransaction() {
    if (!addName.trim()) {
      Alert.alert('Validation', 'Please enter a description.');
      return;
    }
    const parsedAmount = parseFloat(addAmount);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    if (!addAccountId) {
      Alert.alert('Validation', 'Please select an account.');
      return;
    }
    if (!addDate || !/^\d{4}-\d{2}-\d{2}$/.test(addDate)) {
      Alert.alert('Validation', 'Please enter a valid date (YYYY-MM-DD).');
      return;
    }

    setAddLoading(true);
    try {
      await createTransaction({
        accountId: addAccountId,
        amount: parsedAmount,
        name: addName.trim(),
        date: addDate,
        categoryId: addCategoryId || undefined,
      });
      setShowAddModal(false);
      await fetchTransactions(1, true);
    } catch {
      Alert.alert('Error', 'Failed to create transaction. Please try again.');
    } finally {
      setAddLoading(false);
    }
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

  const selectedAccount = accountsList.find((a) => a.id === addAccountId);
  const selectedCategory = categoriesList.find((c) => c.id === addCategoryId);

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
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        {searching ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
          </View>
        ) : searchQuery || localSearch ? (
          <Pressable
            style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
            onPress={clearSearch}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Results count */}
      {(total > 0 || !!searchQuery || searching) && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {searching
              ? 'Updating results...'
              : total > 0
                ? `${total.toLocaleString()} transaction${total !== 1 ? 's' : ''}${
                    searchQuery ? ` for "${searchQuery}"` : ''
                  }`
                : `No matches for "${searchQuery}"`}
          </Text>
        </View>
      )}

      {/* Transaction list */}
      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No transactions</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try a different search term or clear the current search.'
              : 'Link a bank account or add transactions manually'}
          </Text>
          {searchQuery ? (
            <Pressable
              style={({ pressed }) => [
                styles.emptyPrimaryButton,
                pressed && styles.emptyPrimaryButtonPressed,
              ]}
              onPress={clearSearch}
            >
              <Text style={styles.emptyPrimaryButtonText}>Clear Search</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.emptyPrimaryButton,
                  pressed && styles.emptyPrimaryButtonPressed,
                ]}
                onPress={handleOpenAccounts}
              >
                <Text style={styles.emptyPrimaryButtonText}>Link Accounts on Web</Text>
              </Pressable>
              <Text style={styles.emptyFootnote}>
                Account linking is handled in the web app for now.
              </Text>
            </>
          )}
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
                <ActivityIndicator size="small" color={colors.primary[500]} />
              </View>
            ) : null
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={openAddModal}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Line
            x1={12}
            y1={5}
            x2={12}
            y2={19}
            stroke={colors.white}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Line
            x1={5}
            y1={12}
            x2={19}
            y2={12}
            stroke={colors.white}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            <Pressable onPress={handleAddTransaction} disabled={addLoading}>
              {addLoading ? (
                <ActivityIndicator size="small" color={colors.primary[400]} />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Description */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                value={addName}
                onChangeText={setAddName}
                placeholder="e.g., Coffee at Starbucks"
                placeholderTextColor={colors.surface[500]}
                autoFocus
              />
            </View>

            {/* Amount */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Amount</Text>
              <TextInput
                style={styles.modalInput}
                value={addAmount}
                onChangeText={setAddAmount}
                placeholder="0.00"
                placeholderTextColor={colors.surface[500]}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Date */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Date</Text>
              <TextInput
                style={styles.modalInput}
                value={addDate}
                onChangeText={setAddDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.surface[500]}
              />
            </View>

            {/* Account Picker */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Account</Text>
              <Pressable
                style={styles.modalPickerButton}
                onPress={() => setShowAccountPicker(!showAccountPicker)}
              >
                <Text
                  style={[
                    styles.modalPickerText,
                    !selectedAccount && styles.modalPickerPlaceholder,
                  ]}
                >
                  {selectedAccount?.name ?? 'Select an account'}
                </Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 9l6 6 6-6"
                    stroke={colors.surface[400]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              {showAccountPicker && (
                <View style={styles.pickerDropdown}>
                  {accountsList.map((acct) => (
                    <Pressable
                      key={acct.id}
                      style={[
                        styles.pickerOption,
                        acct.id === addAccountId && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setAddAccountId(acct.id);
                        setShowAccountPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          acct.id === addAccountId && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {acct.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Category Picker */}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Category (optional)</Text>
              <Pressable
                style={styles.modalPickerButton}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text
                  style={[
                    styles.modalPickerText,
                    !selectedCategory && styles.modalPickerPlaceholder,
                  ]}
                >
                  {selectedCategory?.name ?? 'Select a category'}
                </Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 9l6 6 6-6"
                    stroke={colors.surface[400]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              {showCategoryPicker && (
                <View style={styles.pickerDropdown}>
                  <Pressable
                    style={[styles.pickerOption, !addCategoryId && styles.pickerOptionSelected]}
                    onPress={() => {
                      setAddCategoryId('');
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        !addCategoryId && styles.pickerOptionTextSelected,
                      ]}
                    >
                      None
                    </Text>
                  </Pressable>
                  {categoriesList.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.pickerOption,
                        cat.id === addCategoryId && styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        setAddCategoryId(cat.id);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <View style={styles.pickerOptionRow}>
                        {cat.color && (
                          <View style={[styles.pickerOptionDot, { backgroundColor: cat.color }]} />
                        )}
                        <Text
                          style={[
                            styles.pickerOptionText,
                            cat.id === addCategoryId && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
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
  searchStatus: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: colors.surface[750],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surface[600] + '80',
  },
  clearButtonPressed: {
    backgroundColor: colors.surface[700],
  },
  clearButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[200],
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
    lineHeight: 20,
  },
  emptyPrimaryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
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
  emptyFootnote: {
    fontSize: fontSize.xs,
    color: colors.surface[500],
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
  },
  loadingMore: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[700] + '80',
    backgroundColor: colors.surface[800],
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  modalCancelText: {
    fontSize: fontSize.base,
    color: colors.surface[400],
  },
  modalSaveText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary[400],
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  modalField: {
    gap: spacing.sm,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.surface[400],
  },
  modalInput: {
    backgroundColor: colors.surface[800],
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.white,
  },
  modalPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface[800],
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalPickerText: {
    fontSize: fontSize.base,
    color: colors.white,
  },
  modalPickerPlaceholder: {
    color: colors.surface[500],
  },
  pickerDropdown: {
    backgroundColor: colors.surface[800],
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface[700] + '40',
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary[600] + '20',
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerOptionText: {
    fontSize: fontSize.sm,
    color: colors.surface[300],
  },
  pickerOptionTextSelected: {
    color: colors.primary[400],
    fontWeight: fontWeight.semibold,
  },
});
