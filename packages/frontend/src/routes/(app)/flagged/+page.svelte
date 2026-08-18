<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showFlagModal = $state(false);
  let resolvingFlag = $state<any>(null);
  let resolveComment = $state('');
  let activeTab = $state<'mine' | 'household'>('mine');
  let statusFilter = $state<'all' | 'open' | 'resolved'>('all');

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showFlagModal = false;
      resolvingFlag = null;
      resolveComment = '';
    }
  });

  function fmt(amount: number | null): string {
    if (amount === null || amount === undefined) return '--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function fmtDate(date: string | null): string {
    if (!date) return '--';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function timeAgo(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return fmtDate(date);
  }

  const rawFlags = $derived(activeTab === 'household' ? data.householdFlags : data.flags);

  const displayedFlags = $derived(
    statusFilter === 'all' ? rawFlags : rawFlags.filter((f: any) => f.status === statusFilter),
  );

  const openFlags = $derived(rawFlags.filter((f: any) => f.status === 'open'));
  const resolvedFlags = $derived(rawFlags.filter((f: any) => f.status === 'resolved'));

  // Group displayed flags by status
  const openDisplayed = $derived(displayedFlags.filter((f: any) => f.status === 'open'));
  const resolvedDisplayed = $derived(displayedFlags.filter((f: any) => f.status === 'resolved'));
</script>

<svelte:head>
  <title>Flagged Transactions - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Flagged Transactions</h2>
      <p class="mt-1 text-sm text-surface-400">
        Track and resolve suspicious or noteworthy transactions
      </p>
    </div>
    <Button onclick={() => (showFlagModal = true)}>
      <svg
        class="mr-1.5 h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
      Flag Transaction
    </Button>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="flex items-center gap-3 rounded-lg bg-red-900/50 p-4 text-sm text-red-300">
      <svg
        class="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {form.error}
    </div>
  {/if}

  <!-- Tabs -->
  {#if data.householdId}
    <div class="flex gap-1 rounded-lg bg-surface-800 p-1">
      <button
        class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition {activeTab === 'mine'
          ? 'bg-surface-700 text-white shadow-sm'
          : 'text-surface-400 hover:text-white'}"
        onclick={() => (activeTab = 'mine')}
      >
        My Flags
        {#if data.flags.length > 0}
          <span class="ml-1.5 rounded-full bg-surface-600 px-1.5 py-0.5 text-xs"
            >{data.flags.length}</span
          >
        {/if}
      </button>
      <button
        class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition {activeTab === 'household'
          ? 'bg-surface-700 text-white shadow-sm'
          : 'text-surface-400 hover:text-white'}"
        onclick={() => (activeTab = 'household')}
      >
        Household Flags
        {#if data.householdFlags.length > 0}
          <span class="ml-1.5 rounded-full bg-surface-600 px-1.5 py-0.5 text-xs"
            >{data.householdFlags.length}</span
          >
        {/if}
      </button>
    </div>
  {/if}

  <!-- Summary + Filter row -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="grid flex-1 gap-4 grid-cols-2">
      <Card padding="sm">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/15">
            <svg
              class="h-5 w-5 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p class="text-xs text-surface-400">Open</p>
            <p class="text-lg font-bold text-yellow-400">{openFlags.length}</p>
          </div>
        </div>
      </Card>
      <Card padding="sm">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/15">
            <svg
              class="h-5 w-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p class="text-xs text-surface-400">Resolved</p>
            <p class="text-lg font-bold text-green-400">{resolvedFlags.length}</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Status filter -->
    <div class="flex gap-1 rounded-lg bg-surface-800 p-1">
      {#each [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }] as filter}
        <button
          class="rounded-md px-3 py-1.5 text-xs font-medium transition {statusFilter ===
          filter.value
            ? 'bg-surface-700 text-white shadow-sm'
            : 'text-surface-400 hover:text-white'}"
          onclick={() => (statusFilter = filter.value as any)}
        >
          {filter.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Open Flags -->
  {#if openDisplayed.length > 0}
    <div>
      <h3
        class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-400"
      >
        <span class="h-2 w-2 rounded-full bg-yellow-400"></span>
        Open ({openDisplayed.length})
      </h3>
      <div class="space-y-3">
        {#each openDisplayed as flag}
          <Card>
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-medium text-white">
                    {flag.transactionName ?? 'Unknown Transaction'}
                  </p>
                  <span
                    class="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400 border border-yellow-500/25"
                  >
                    Open
                  </span>
                </div>
                <div
                  class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-400"
                >
                  <span class="font-medium">{fmt(flag.transactionAmount)}</span>
                  <span>{fmtDate(flag.transactionDate)}</span>
                  {#if flag.transactionCategory}
                    <span class="rounded bg-surface-700 px-1.5 py-0.5 text-xs"
                      >{flag.transactionCategory}</span
                    >
                  {/if}
                </div>
                {#if flag.reason}
                  <div class="mt-2.5 flex items-start gap-2 rounded-lg bg-surface-700/50 px-3 py-2">
                    <svg
                      class="mt-0.5 h-4 w-4 flex-shrink-0 text-surface-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <p class="text-sm text-surface-300">{flag.reason}</p>
                  </div>
                {/if}
                <p class="mt-2 text-xs text-surface-500">
                  Flagged by <span class="text-surface-400">{flag.flaggedByName ?? 'Unknown'}</span>
                  {timeAgo(flag.createdAt)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  resolvingFlag = flag;
                  resolveComment = '';
                }}
              >
                Resolve
              </Button>
            </div>
          </Card>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Resolved Flags -->
  {#if resolvedDisplayed.length > 0}
    <div>
      <h3
        class="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-surface-400"
      >
        <span class="h-2 w-2 rounded-full bg-green-400"></span>
        Resolved ({resolvedDisplayed.length})
      </h3>
      <div class="space-y-2">
        {#each resolvedDisplayed as flag}
          <Card>
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-medium text-surface-300">
                    {flag.transactionName ?? 'Unknown Transaction'}
                  </p>
                  <span
                    class="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400"
                  >
                    Resolved
                  </span>
                </div>
                <div
                  class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500"
                >
                  <span>{fmt(flag.transactionAmount)}</span>
                  <span>{fmtDate(flag.transactionDate)}</span>
                </div>
                {#if flag.reason}
                  <p class="mt-2 text-sm text-surface-400">
                    Reason: {flag.reason}
                  </p>
                {/if}
                {#if flag.resolveComment}
                  <div class="mt-2 flex items-start gap-2 rounded-lg bg-green-900/15 px-3 py-2">
                    <svg
                      class="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500/50"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
                    </svg>
                    <p class="text-sm text-green-300/80">{flag.resolveComment}</p>
                  </div>
                {/if}
                <div class="mt-2 flex items-center gap-4 text-xs text-surface-500">
                  <span>Flagged by {flag.flaggedByName ?? 'Unknown'}</span>
                  <span>Resolved {timeAgo(flag.resolvedAt)}</span>
                </div>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Empty state -->
  {#if displayedFlags.length === 0}
    <Card>
      <div class="flex flex-col items-center justify-center py-12 text-center">
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
              d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            />
          </svg>
        </div>
        {#if statusFilter !== 'all'}
          <p class="mt-4 text-lg text-surface-300">No {statusFilter} flags</p>
          <p class="mt-1 text-sm text-surface-500">
            {statusFilter === 'open'
              ? 'All flags have been resolved. Great job!'
              : 'No flags have been resolved yet.'}
          </p>
          <Button variant="ghost" size="sm" class="mt-3" onclick={() => (statusFilter = 'all')}>
            Show all flags
          </Button>
        {:else}
          <p class="mt-4 text-lg text-surface-300">No flagged transactions</p>
          <p class="mt-1 text-sm text-surface-500">
            Flag a transaction to bring it to your{data.householdId ? " or your household's" : ''} attention.
          </p>
          <Button size="sm" class="mt-4" onclick={() => (showFlagModal = true)}>
            Flag a Transaction
          </Button>
        {/if}
      </div>
    </Card>
  {/if}
</div>

<!-- Flag Transaction Modal -->
<Modal open={showFlagModal} onclose={() => (showFlagModal = false)} title="Flag a Transaction">
  <form
    method="POST"
    action="?/flag"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="flagTransactionId" class="block text-sm font-medium text-surface-300">
        Transaction
      </label>
      {#if data.transactions.length > 0}
        <select
          id="flagTransactionId"
          name="transactionId"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Select a transaction...</option>
          {#each data.transactions as tx}
            <option value={tx.id}>
              {tx.merchantName || tx.name} - {fmt(tx.amount)} ({fmtDate(tx.date)})
            </option>
          {/each}
        </select>
      {:else}
        <input
          id="flagTransactionId"
          name="transactionId"
          type="text"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Enter transaction ID"
        />
      {/if}
    </div>

    <div>
      <label for="flagReason" class="block text-sm font-medium text-surface-300">
        Reason <span class="text-surface-500">(optional)</span>
      </label>
      <textarea
        id="flagReason"
        name="reason"
        rows="3"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Why are you flagging this transaction?"></textarea>
      <p class="mt-1.5 text-xs text-surface-500">
        Provide context so others know why this transaction was flagged.
      </p>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showFlagModal = false)}>Cancel</Button>
      <Button type="submit">
        <svg
          class="mr-1.5 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
          />
        </svg>
        Flag
      </Button>
    </div>
  </form>
</Modal>

<!-- Resolve Flag Modal -->
<Modal open={resolvingFlag !== null} onclose={() => (resolvingFlag = null)} title="Resolve Flag">
  {#if resolvingFlag}
    <div class="space-y-4">
      <!-- Flag summary -->
      <div class="rounded-lg border border-surface-700 bg-surface-900/50 p-4">
        <p class="font-medium text-white">
          {resolvingFlag.transactionName ?? 'Unknown Transaction'}
        </p>
        <div class="mt-1 flex items-center gap-3 text-sm text-surface-400">
          <span>{fmt(resolvingFlag.transactionAmount)}</span>
          <span>{fmtDate(resolvingFlag.transactionDate)}</span>
        </div>
        {#if resolvingFlag.reason}
          <p class="mt-2 text-sm text-surface-300">
            Reason: {resolvingFlag.reason}
          </p>
        {/if}
      </div>

      <form
        method="POST"
        action="?/resolve"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
          };
        }}
        class="space-y-4"
      >
        <input type="hidden" name="id" value={resolvingFlag.id} />
        <div>
          <label for="resolveComment" class="block text-sm font-medium text-surface-300">
            Resolution Comment <span class="text-surface-500">(optional)</span>
          </label>
          <textarea
            id="resolveComment"
            name="comment"
            rows="3"
            bind:value={resolveComment}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Add a note about how this was resolved..."></textarea>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onclick={() => (resolvingFlag = null)}>
            Cancel
          </Button>
          <Button type="submit">
            <svg
              class="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark Resolved
          </Button>
        </div>
      </form>
    </div>
  {/if}
</Modal>
