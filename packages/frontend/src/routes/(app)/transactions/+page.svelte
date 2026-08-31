<script lang="ts">
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { untrack } from 'svelte';
  import { Card, Button, Modal } from '$components/ui';
  import { getBudgetCategoryTree } from '$lib/utils/budgets';
  import {
    buildTransactionSearchParams,
    formatTransactionDate,
    getMerchantColor,
    getMerchantInitials,
    getTransactionDateGroupLabel,
    isIncomeTransaction,
  } from '$lib/utils/transactions';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showCreateModal = $state(false);
  let showDetailModal = $state(false);
  let selectedTransaction = $state<any>(null);
  let showFilters = $state(false);
  let autoSearchPending = $state(false);

  // Filter state
  let searchInput = $state($page.url.searchParams.get('search') || '');
  let filterAccountId = $state($page.url.searchParams.get('accountId') || '');
  let filterCategoryId = $state($page.url.searchParams.get('categoryId') || '');
  let filterStartDate = $state($page.url.searchParams.get('startDate') || '');
  let filterEndDate = $state($page.url.searchParams.get('endDate') || '');

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showCreateModal = false;
      showDetailModal = false;
    }
  });

  function formatAmount(amount: number, type: string): string {
    const val = ['credit_card', 'loan', 'mortgage'].includes(type) ? -amount : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(val);
  }

  // Group transactions by date label
  const groupedTransactions = $derived.by(() => {
    const groups: Array<{ label: string; transactions: any[] }> = [];
    let currentLabel = '';
    for (const tx of data.transactions.data) {
      const label = getTransactionDateGroupLabel(tx.date);
      if (label !== currentLabel) {
        groups.push({ label, transactions: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].transactions.push(tx);
    }
    return groups;
  });

  function getAppliedFilters() {
    return {
      accountId: $page.url.searchParams.get('accountId') || '',
      categoryId: $page.url.searchParams.get('categoryId') || '',
      startDate: $page.url.searchParams.get('startDate') || '',
      endDate: $page.url.searchParams.get('endDate') || '',
    };
  }

  function buildTransactionsHref(filters: {
    search?: string;
    accountId?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    page?: string | number | null;
  }) {
    const params = buildTransactionSearchParams(filters);
    const query = params.toString();
    return query ? `/transactions?${query}` : '/transactions';
  }

  function navigateToTransactions(
    filters: {
      search?: string;
      accountId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      page?: string | number | null;
    },
    { replaceState = false } = {},
  ) {
    const href = buildTransactionsHref(filters);
    const currentHref = `${$page.url.pathname}${$page.url.search}`;
    autoSearchPending = false;
    if (href === currentHref) return;
    void goto(href, {
      keepFocus: true,
      noScroll: true,
      replaceState,
    });
  }

  function applySearchImmediately() {
    navigateToTransactions(
      {
        ...getAppliedFilters(),
        search: searchInput,
        page: undefined,
      },
      { replaceState: true },
    );
  }

  function applyFilters() {
    navigateToTransactions({
      search: searchInput,
      accountId: filterAccountId,
      categoryId: filterCategoryId,
      startDate: filterStartDate,
      endDate: filterEndDate,
      page: undefined,
    });
  }

  function clearFilters() {
    searchInput = '';
    filterAccountId = '';
    filterCategoryId = '';
    filterStartDate = '';
    filterEndDate = '';
    showFilters = false;
    navigateToTransactions({});
  }

  function goToPage(pageNum: number) {
    navigateToTransactions({
      search: $page.url.searchParams.get('search') || '',
      accountId: $page.url.searchParams.get('accountId') || '',
      categoryId: $page.url.searchParams.get('categoryId') || '',
      startDate: $page.url.searchParams.get('startDate') || '',
      endDate: $page.url.searchParams.get('endDate') || '',
      page: pageNum,
    });
  }

  function openDetail(tx: any) {
    selectedTransaction = tx;
    showDetailModal = true;
  }

  const hasActiveFilters = $derived(
    !!filterAccountId || !!filterCategoryId || !!filterStartDate || !!filterEndDate,
  );
  const hasSearchQuery = $derived(!!searchInput.trim());
  const activeFilterCount = $derived(
    [filterAccountId, filterCategoryId, filterStartDate, filterEndDate].filter(Boolean).length,
  );
  const hasPendingFilterChanges = $derived(
    filterAccountId !== ($page.url.searchParams.get('accountId') || '') ||
      filterCategoryId !== ($page.url.searchParams.get('categoryId') || '') ||
      filterStartDate !== ($page.url.searchParams.get('startDate') || '') ||
      filterEndDate !== ($page.url.searchParams.get('endDate') || ''),
  );

  $effect(() => {
    const nextSearch = $page.url.searchParams.get('search') || '';
    const nextAccountId = $page.url.searchParams.get('accountId') || '';
    const nextCategoryId = $page.url.searchParams.get('categoryId') || '';
    const nextStartDate = $page.url.searchParams.get('startDate') || '';
    const nextEndDate = $page.url.searchParams.get('endDate') || '';

    if (untrack(() => searchInput) !== nextSearch) searchInput = nextSearch;
    if (untrack(() => filterAccountId) !== nextAccountId) filterAccountId = nextAccountId;
    if (untrack(() => filterCategoryId) !== nextCategoryId) filterCategoryId = nextCategoryId;
    if (untrack(() => filterStartDate) !== nextStartDate) filterStartDate = nextStartDate;
    if (untrack(() => filterEndDate) !== nextEndDate) filterEndDate = nextEndDate;
  });

  $effect(() => {
    if (!browser) return;

    const currentSearch = ($page.url.searchParams.get('search') || '').trim();
    const nextSearch = searchInput.trim();

    if (nextSearch === currentSearch) {
      autoSearchPending = false;
      return;
    }

    autoSearchPending = true;
    const appliedFilters = getAppliedFilters();
    const timeout = window.setTimeout(() => {
      navigateToTransactions(
        {
          ...appliedFilters,
          search: searchInput,
          page: undefined,
        },
        { replaceState: true },
      );
    }, 250);

    return () => {
      autoSearchPending = false;
      window.clearTimeout(timeout);
    };
  });
</script>

<svelte:head>
  <title>Transactions - Finance Owl</title>
</svelte:head>

<div class="page-enter space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-3xl font-bold tracking-tight text-white">Transactions</h2>
      <p class="mt-1 text-sm text-surface-400">
        {#if data.transactions.meta.total > 0}
          {data.transactions.meta.total.toLocaleString()} transaction{data.transactions.meta
            .total !== 1
            ? 's'
            : ''}
        {:else}
          Track your income and expenses
        {/if}
      </p>
    </div>
    <Button onclick={() => (showCreateModal = true)}>
      <svg
        class="mr-1.5 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      Add Transaction
    </Button>
  </div>

  <!-- Search & Filters -->
  <div class="rounded-xl border border-surface-700/50 bg-surface-800 p-4">
    <div class="space-y-3">
      <!-- Search bar -->
      <div class="flex flex-col gap-2 sm:flex-row">
        <div class="relative flex-1">
          <svg
            class="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            name="search"
            bind:value={searchInput}
            aria-describedby="transactions-search-status"
            enterkeyhint="search"
            placeholder="Search by name, merchant, or amount…"
            autocomplete="off"
            spellcheck="false"
            class="w-full rounded-lg border border-surface-600/50 bg-surface-750 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-surface-500 transition-colors focus:border-primary-500/50 focus:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            onkeydown={(e) => e.key === 'Enter' && applySearchImmediately()}
          />
        </div>
        {#if hasActiveFilters || hasSearchQuery}
          <Button variant="ghost" onclick={clearFilters}>Clear</Button>
        {/if}
        <Button
          variant="secondary"
          aria-label={showFilters ? 'Hide filters' : 'Show filters'}
          aria-pressed={showFilters}
          onclick={() => (showFilters = !showFilters)}
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          {#if activeFilterCount}
            <span
              class="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white"
            >
              {activeFilterCount}
            </span>
          {/if}
        </Button>
      </div>
      <div
        id="transactions-search-status"
        class="flex flex-col gap-1 text-xs text-surface-500 sm:flex-row sm:items-center sm:justify-between"
        aria-live="polite"
      >
        <p>
          Search updates as you type. Account, category, and date filters apply when you tap Apply
          Filters.
        </p>
        <p class="text-surface-400">
          {#if autoSearchPending || $navigating}
            Updating…
          {:else if hasSearchQuery}
            Showing results for “{searchInput.trim()}”
          {:else}
            Showing all transactions
          {/if}
        </p>
      </div>

      <!-- Filter panel -->
      {#if showFilters}
        <div class="grid gap-3 border-t border-surface-700/50 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label for="filterAccount" class="mb-1.5 block text-xs font-medium text-surface-400"
              >Account</label
            >
            <select
              id="filterAccount"
              bind:value={filterAccountId}
              class="w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-sm text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            >
              <option value="">All accounts</option>
              {#each data.accounts as account}
                <option value={account.id}>{account.name}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="filterCategory" class="mb-1.5 block text-xs font-medium text-surface-400"
              >Category</label
            >
            <select
              id="filterCategory"
              bind:value={filterCategoryId}
              class="w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-sm text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            >
              <option value="">All categories</option>
              {#each getBudgetCategoryTree(data.categories) as parent}
                <option value={parent.id}>{parent.name}</option>
                {#each parent.children as child}
                  <option value={child.id}>&nbsp;&nbsp;{child.name}</option>
                {/each}
              {/each}
            </select>
          </div>
          <div>
            <label for="filterStartDate" class="mb-1.5 block text-xs font-medium text-surface-400"
              >From</label
            >
            <input
              id="filterStartDate"
              type="date"
              bind:value={filterStartDate}
              class="w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-sm text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            />
          </div>
          <div>
            <label for="filterEndDate" class="mb-1.5 block text-xs font-medium text-surface-400"
              >To</label
            >
            <input
              id="filterEndDate"
              type="date"
              bind:value={filterEndDate}
              class="w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-sm text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            />
          </div>
        </div>
        <div class="flex gap-2">
          <Button size="sm" onclick={applyFilters} disabled={!hasPendingFilterChanges}
            >Apply Filters</Button
          >
          {#if hasActiveFilters || hasSearchQuery}
            <Button size="sm" variant="ghost" onclick={clearFilters}>Clear All</Button>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div
      class="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/50 p-3 text-sm text-red-300"
    >
      <svg
        class="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      {form.error}
    </div>
  {/if}

  <!-- Transaction list -->
  {#if data.transactions.data.length === 0}
    <div
      class="relative overflow-hidden rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850"
    >
      <div
        class="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-primary-500/3"
      ></div>
      <div class="relative flex flex-col items-center justify-center py-16 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-700/50">
          <svg
            class="h-8 w-8 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <p class="mt-5 text-lg font-semibold text-white">No transactions yet</p>
        <p class="mt-1.5 max-w-sm text-sm text-surface-400">
          Link a bank account or add transactions manually to get started.
        </p>
      </div>
    </div>
  {:else}
    <!-- Grouped transaction list -->
    <div class="stagger-children space-y-2">
      {#each groupedTransactions as group}
        <!-- Date group header -->
        <div class="sticky top-0 z-10 flex items-center gap-3 py-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-surface-500"
            >{group.label}</span
          >
          <div class="h-px flex-1 bg-surface-700/50"></div>
          <span class="text-xs text-surface-600">{group.transactions.length}</span>
        </div>

        <!-- Transaction rows as cards -->
        <div class="space-y-1.5">
          {#each group.transactions as tx, txIdx}
            <button
              class="group w-full rounded-xl border border-surface-700/30 bg-surface-800 px-4 py-3 text-left transition-all duration-200
								hover:border-surface-600/50 hover:bg-surface-750 hover:shadow-md hover:shadow-black/10
								{txIdx % 2 === 1 ? 'bg-surface-800/70' : ''}"
              onclick={() => openDetail(tx)}
            >
              <div class="flex items-center gap-3">
                <!-- Merchant avatar -->
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white/90 shadow-sm transition-transform duration-200 group-hover:scale-105"
                  style="background: linear-gradient(135deg, {getMerchantColor(
                    tx.merchantName || tx.name,
                  )}88, {getMerchantColor(tx.merchantName || tx.name)}44)"
                >
                  {getMerchantInitials(tx.merchantName || tx.name)}
                </div>

                <!-- Description -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="truncate font-medium text-white">
                      {tx.merchantName || tx.name}
                    </p>
                    {#if tx.pending}
                      <span
                        class="inline-flex items-center rounded-md bg-accent-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent-400 ring-1 ring-inset ring-accent-500/20"
                      >
                        Pending
                      </span>
                    {/if}
                    {#if tx.splitTransactionId}
                      <span
                        class="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/20"
                      >
                        Split
                      </span>
                    {/if}
                  </div>
                  <div class="mt-0.5 flex items-center gap-2 text-xs text-surface-500">
                    <span>{formatTransactionDate(tx.date)}</span>
                    {#if tx.categoryName}
                      <span class="text-surface-600">|</span>
                      <span class="inline-flex items-center gap-1">
                        {#if tx.categoryColor}
                          <span
                            class="inline-block h-1.5 w-1.5 rounded-full"
                            style="background-color: {tx.categoryColor}"
                          ></span>
                        {/if}
                        <span style="color: {tx.categoryColor || 'inherit'}">{tx.categoryName}</span
                        >
                      </span>
                    {:else}
                      <span class="text-surface-600">|</span>
                      <span class="italic text-surface-600">Uncategorized</span>
                    {/if}
                    {#if tx.accountName}
                      <span class="hidden text-surface-600 sm:inline">|</span>
                      <span class="hidden sm:inline">{tx.accountName}</span>
                    {/if}
                  </div>
                </div>

                <!-- Amount -->
                <div class="shrink-0 text-right">
                  <span
                    class="text-sm font-semibold tabular-nums {isIncomeTransaction(
                      tx.amount,
                      tx.accountType,
                    )
                      ? 'text-primary-400'
                      : 'text-surface-200'}"
                  >
                    {#if isIncomeTransaction(tx.amount, tx.accountType)}
                      <span class="mr-0.5 text-xs text-primary-400/60">+</span>
                    {/if}
                    {formatAmount(tx.amount, tx.accountType || 'checking')}
                  </span>
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if data.transactions.meta.totalPages > 1}
      <div
        class="flex items-center justify-between rounded-xl border border-surface-700/30 bg-surface-800/50 px-4 py-3"
      >
        <p class="text-sm text-surface-400">
          <span class="font-medium text-surface-300"
            >{(data.transactions.meta.page - 1) * data.transactions.meta.limit + 1}</span
          >
          -
          <span class="font-medium text-surface-300"
            >{Math.min(
              data.transactions.meta.page * data.transactions.meta.limit,
              data.transactions.meta.total,
            )}</span
          >
          <span class="mx-1">of</span>
          <span class="font-medium text-surface-300"
            >{data.transactions.meta.total.toLocaleString()}</span
          >
        </p>
        <div class="flex items-center gap-1">
          <button
            aria-label="Previous page"
            class="rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-1.5 text-sm text-surface-300 transition-colors hover:bg-surface-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={data.transactions.meta.page <= 1}
            onclick={() => goToPage(data.transactions.meta.page - 1)}
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="px-3 text-sm text-surface-400">
            Page <span class="font-medium text-white">{data.transactions.meta.page}</span> of {data
              .transactions.meta.totalPages}
          </span>
          <button
            aria-label="Next page"
            class="rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-1.5 text-sm text-surface-300 transition-colors hover:bg-surface-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={data.transactions.meta.page >= data.transactions.meta.totalPages}
            onclick={() => goToPage(data.transactions.meta.page + 1)}
          >
            <svg
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Create Transaction Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Add Transaction">
  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="txAccount" class="block text-sm font-medium text-surface-300">Account</label>
      <select
        id="txAccount"
        name="accountId"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
      >
        {#each data.accounts as account}
          <option value={account.id}>{account.name}</option>
        {/each}
      </select>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="txAmount" class="block text-sm font-medium text-surface-300">Amount</label>
        <div class="relative mt-1">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">$</span>
          <input
            id="txAmount"
            name="amount"
            type="number"
            step="0.01"
            required
            class="block w-full rounded-lg border border-surface-600/50 bg-surface-750 py-2.5 pl-7 pr-3 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label for="txDate" class="block text-sm font-medium text-surface-300">Date</label>
        <input
          id="txDate"
          name="date"
          type="date"
          required
          value={new Date().toISOString().split('T')[0]}
          class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
        />
      </div>
    </div>

    <div>
      <label for="txName" class="block text-sm font-medium text-surface-300">Description</label>
      <input
        id="txName"
        name="name"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
        placeholder="e.g., Grocery Store"
      />
    </div>

    <div>
      <label for="txMerchant" class="block text-sm font-medium text-surface-300"
        >Merchant (optional)</label
      >
      <input
        id="txMerchant"
        name="merchantName"
        type="text"
        class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
        placeholder="e.g., Whole Foods"
      />
    </div>

    <div>
      <label for="txCategory" class="block text-sm font-medium text-surface-300"
        >Category (optional)</label
      >
      <select
        id="txCategory"
        name="categoryId"
        class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
      >
        <option value="">Auto-categorize</option>
        {#each getBudgetCategoryTree(data.categories) as parent}
          <option value={parent.id}>{parent.name}</option>
          {#each parent.children as child}
            <option value={child.id}>&nbsp;&nbsp;{child.name}</option>
          {/each}
        {/each}
      </select>
    </div>

    <div>
      <label for="txNotes" class="block text-sm font-medium text-surface-300"
        >Notes (optional)</label
      >
      <textarea
        id="txNotes"
        name="notes"
        rows="2"
        class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
        placeholder="Add a note..."></textarea>
    </div>

    <div class="flex justify-end gap-3 border-t border-surface-700/50 pt-4">
      <Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>Cancel</Button
      >
      <Button type="submit">Add Transaction</Button>
    </div>
  </form>
</Modal>

<!-- Transaction Detail Modal -->
<Modal open={showDetailModal} onclose={() => (showDetailModal = false)} title="Transaction Details">
  {#if selectedTransaction}
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-start gap-3">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white/90"
          style="background: linear-gradient(135deg, {getMerchantColor(
            selectedTransaction.merchantName || selectedTransaction.name,
          )}88, {getMerchantColor(selectedTransaction.merchantName || selectedTransaction.name)}44)"
        >
          {getMerchantInitials(selectedTransaction.merchantName || selectedTransaction.name)}
        </div>
        <div class="flex-1">
          <p class="text-lg font-semibold text-white">
            {selectedTransaction.merchantName || selectedTransaction.name}
          </p>
          {#if selectedTransaction.merchantName && selectedTransaction.merchantName !== selectedTransaction.name}
            <p class="text-sm text-surface-400">{selectedTransaction.name}</p>
          {/if}
        </div>
        <p
          class="text-xl font-bold tabular-nums {isIncomeTransaction(
            selectedTransaction.amount,
            selectedTransaction.accountType,
          )
            ? 'text-primary-400'
            : 'text-white'}"
        >
          {formatAmount(selectedTransaction.amount, selectedTransaction.accountType || 'checking')}
        </p>
      </div>

      <div
        class="grid grid-cols-2 gap-4 rounded-xl border border-surface-700/30 bg-surface-750/50 p-4"
      >
        <div>
          <p class="text-xs font-medium text-surface-500">Date</p>
          <p class="mt-0.5 text-sm text-white">{formatTransactionDate(selectedTransaction.date)}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-surface-500">Account</p>
          <p class="mt-0.5 text-sm text-white">{selectedTransaction.accountName}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-surface-500">Status</p>
          <p class="mt-0.5 text-sm">
            {#if selectedTransaction.pending}
              <span class="inline-flex items-center gap-1 text-accent-400">
                <span class="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse"></span>
                Pending
              </span>
            {:else}
              <span class="text-primary-400">Cleared</span>
            {/if}
          </p>
        </div>
        <div>
          <p class="text-xs font-medium text-surface-500">Source</p>
          <p class="mt-0.5 text-sm capitalize text-white">
            {selectedTransaction.categorizationSource || 'None'}
          </p>
        </div>
      </div>

      <!-- Category selector -->
      <form method="POST" action="?/updateCategory" use:enhance>
        <input type="hidden" name="id" value={selectedTransaction.id} />
        <label for="detailCategory" class="block text-sm font-medium text-surface-300"
          >Category</label
        >
        <div class="mt-1 flex gap-2">
          <select
            id="detailCategory"
            name="categoryId"
            class="flex-1 rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            value={selectedTransaction.categoryId || ''}
          >
            <option value="">Uncategorized</option>
            {#each getBudgetCategoryTree(data.categories) as parent}
              <option value={parent.id}>{parent.name}</option>
              {#each parent.children as child}
                <option value={child.id}>&nbsp;&nbsp;{child.name}</option>
              {/each}
            {/each}
          </select>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>

      <!-- Notes -->
      <form method="POST" action="?/updateNotes" use:enhance>
        <input type="hidden" name="id" value={selectedTransaction.id} />
        <label for="detailNotes" class="block text-sm font-medium text-surface-300">Notes</label>
        <div class="mt-1 flex gap-2">
          <textarea
            id="detailNotes"
            name="notes"
            rows="2"
            class="flex-1 rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            value={selectedTransaction.notes || ''}
            placeholder="Add a note..."></textarea>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>

      <!-- Delete (manual only) -->
      {#if selectedTransaction.isManual}
        <form
          method="POST"
          action="?/delete"
          use:enhance
          class="border-t border-surface-700/50 pt-3"
        >
          <input type="hidden" name="id" value={selectedTransaction.id} />
          <Button type="submit" variant="danger" size="sm">Delete Transaction</Button>
        </form>
      {/if}
    </div>
  {/if}
</Modal>
