<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  // --- State ---
  let analyzing = $state(false);
  let analysisResults = $state<any[]>([]);
  let showScriptModal = $state(false);
  let showResultModal = $state(false);
  let showStartModal = $state(false);
  let currentScript = $state<any>(null);
  let selectedNegotiation = $state<any>(null);
  let selectedBill = $state<any>(null);
  let copiedScript = $state(false);

  // --- Derived data ---
  const negotiations = $derived(data.negotiations ?? []);
  const summary = $derived(data.summary);
  const expiring = $derived(data.expiring ?? []);

  const pendingCount = $derived(
    negotiations.filter((n: any) => n.status === 'pending' || n.status === 'in_progress').length,
  );

  const successfulNegotiations = $derived(
    negotiations
      .filter((n: any) => n.status === 'success')
      .sort(
        (a: any, b: any) =>
          new Date(b.negotiationDate ?? b.createdAt).getTime() -
          new Date(a.negotiationDate ?? a.createdAt).getTime(),
      ),
  );

  // --- Helpers ---
  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function statusBadge(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400';
      case 'success':
        return 'bg-green-500/20 text-green-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'skipped':
        return 'bg-surface-500/20 text-surface-400';
      default:
        return 'bg-surface-500/20 text-surface-400';
    }
  }

  function categoryBadge(category: string): string {
    switch (category) {
      case 'internet':
        return 'bg-blue-500/20 text-blue-400';
      case 'cable':
        return 'bg-indigo-500/20 text-indigo-400';
      case 'phone':
        return 'bg-green-500/20 text-green-400';
      case 'insurance':
        return 'bg-purple-500/20 text-purple-400';
      case 'streaming':
        return 'bg-pink-500/20 text-pink-400';
      case 'utilities':
        return 'bg-orange-500/20 text-orange-400';
      default:
        return 'bg-surface-500/20 text-surface-400';
    }
  }

  function categoryIcon(category: string): string {
    switch (category) {
      case 'internet':
        return 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z';
      case 'cable':
        return 'M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z';
      case 'phone':
        return 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3';
      case 'insurance':
        return 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z';
      case 'streaming':
        return 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z';
      case 'utilities':
        return 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z';
      default:
        return 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z';
    }
  }

  function daysUntil(dateStr: string): number {
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function openStartModal(bill: any): void {
    selectedBill = bill;
    showStartModal = true;
  }

  function openResultModal(negotiation: any): void {
    selectedNegotiation = negotiation;
    showResultModal = true;
  }

  async function copyScriptToClipboard(): Promise<void> {
    if (!currentScript) return;
    const s = currentScript.script;
    const text = [
      '=== NEGOTIATION SCRIPT ===',
      '',
      'OPENING:',
      s.opening,
      '',
      'KEY LEVERAGE POINTS:',
      ...s.leveragePoints.map((p: string, i: number) => `${i + 1}. ${p}`),
      '',
      'SPECIFIC ASK:',
      s.specificAsk,
      '',
      'IF THEY REFUSE:',
      ...s.ifRefused.map((p: string, i: number) => `${i + 1}. ${p}`),
      '',
      'ESCALATION:',
      s.escalation,
      '',
      'FINAL MOVE:',
      s.finalMove,
      '',
      '=== CONTACT INFO ===',
      `Retention: ${currentScript.contactInfo.retentionPhone}`,
      `Best time: ${currentScript.contactInfo.bestTimeToCall}`,
      '',
      '=== TIPS ===',
      ...currentScript.tips.map((t: string, i: number) => `${i + 1}. ${t}`),
    ].join('\n');

    await navigator.clipboard.writeText(text);
    copiedScript = true;
    setTimeout(() => (copiedScript = false), 2000);
  }

  // Update script from form action result
  $effect(() => {
    if (form?.success && form?.script) {
      currentScript = form.script;
      showScriptModal = true;
    }
  });

  // Update analysis from form action result
  $effect(() => {
    if (form?.success && form?.analysis) {
      analysisResults = form.analysis;
    }
  });
</script>

<svelte:head>
  <title>Bill Negotiation - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Bill Negotiation</h2>
      <p class="mt-1 text-sm text-surface-400">
        Reduce your bills with guided negotiation scripts and provider-specific tips
      </p>
    </div>
    <a href="/bills" class="text-sm text-primary-400 hover:text-primary-300"> Bills Calendar </a>
  </div>

  <!-- Summary Cards -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
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
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Annual Savings</p>
          <p class="text-xl font-bold text-green-400">{fmt(summary.totalAnnualSavings)}</p>
          <p class="text-xs text-surface-500">{fmt(summary.totalMonthlySavings)}/month</p>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-600/20">
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
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Pending</p>
          <p class="text-xl font-bold text-white">{pendingCount}</p>
          <p class="text-xs text-surface-500">
            negotiation{pendingCount !== 1 ? 's' : ''} in progress
          </p>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
          <svg
            class="h-5 w-5 text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Success Rate</p>
          <p class="text-xl font-bold text-white">{summary.successRate}%</p>
          <p class="text-xs text-surface-500">
            {summary.successfulNegotiations} of {summary.totalNegotiations} attempts
          </p>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg {expiring.length > 0
            ? 'bg-red-600/20'
            : 'bg-surface-700'}"
        >
          <svg
            class="h-5 w-5 {expiring.length > 0 ? 'text-red-400' : 'text-surface-400'}"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Expiring Rates</p>
          <p class="text-xl font-bold {expiring.length > 0 ? 'text-red-400' : 'text-white'}">
            {expiring.length}
          </p>
          <p class="text-xs text-surface-500">within next 90 days</p>
        </div>
      </div>
    </Card>
  </div>

  <!-- Expiring Rates Alert -->
  {#if expiring.length > 0}
    <Card class="border border-red-500/30">
      <div class="mb-3 flex items-center gap-2">
        <svg
          class="h-5 w-5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h3 class="font-semibold text-red-400">Promotional Rates Expiring Soon</h3>
      </div>
      <div class="space-y-2">
        {#each expiring as neg}
          <div class="flex items-center justify-between rounded-lg bg-surface-900/50 px-4 py-3">
            <div>
              <p class="font-medium text-white">{neg.billName}</p>
              <p class="text-sm text-surface-400">
                {neg.provider} - Expires {formatDate(neg.expirationDate)}
                <span class="text-red-400">
                  ({daysUntil(neg.expirationDate)} days left)
                </span>
              </p>
            </div>
            <div class="flex items-center gap-3">
              <p class="text-sm text-surface-300">
                {fmt(neg.negotiatedAmount ?? neg.currentAmount)}/mo
              </p>
              <form
                method="POST"
                action="?/getScript"
                use:enhance={() => {
                  return async ({ update }) => {
                    await update();
                  };
                }}
              >
                <input type="hidden" name="provider" value={neg.provider} />
                <input type="hidden" name="category" value={neg.category} />
                <input
                  type="hidden"
                  name="currentAmount"
                  value={neg.negotiatedAmount ?? neg.currentAmount}
                />
                <input
                  type="hidden"
                  name="targetAmount"
                  value={neg.negotiatedAmount ?? neg.currentAmount}
                />
                <Button type="submit" size="sm" variant="danger">Re-negotiate</Button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

  <!-- Bill Analysis Section -->
  <Card>
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-white">Bill Analysis</h3>
        <p class="text-sm text-surface-400">
          Scan your recurring bills to find negotiation opportunities
        </p>
      </div>
      <form
        method="POST"
        action="?/analyze"
        use:enhance={() => {
          analyzing = true;
          return async ({ update }) => {
            analyzing = false;
            await update();
          };
        }}
      >
        <Button type="submit" loading={analyzing}>Analyze My Bills</Button>
      </form>
    </div>

    {#if analysisResults.length > 0}
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each analysisResults as bill}
          <div class="rounded-lg border border-surface-700 bg-surface-900/50 p-4">
            <div class="mb-3 flex items-start justify-between">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-700">
                  <svg
                    class="h-4 w-4 text-surface-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d={categoryIcon(bill.category)}
                    />
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-white">{bill.billName}</p>
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {categoryBadge(
                      bill.category,
                    )}"
                  >
                    {bill.category}
                  </span>
                </div>
              </div>
            </div>

            <div class="mb-3 space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-surface-400">Current</span>
                <span class="font-medium text-white">{fmt(bill.currentAmount)}/mo</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-surface-400">Est. savings</span>
                <span class="font-medium text-green-400">
                  {fmt(bill.estimatedSavingsMin)} - {fmt(bill.estimatedSavingsMax)}/mo
                </span>
              </div>
              {#if bill.hasProviderInfo}
                <p class="text-xs text-primary-400">Provider script available</p>
              {/if}
            </div>

            <Button size="sm" class="w-full" onclick={() => openStartModal(bill)}>
              Start Negotiation
            </Button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="py-6 text-center">
        <svg
          class="mx-auto h-12 w-12 text-surface-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <p class="mt-3 text-surface-300">
          Click "Analyze My Bills" to scan your recurring transactions for negotiation opportunities
        </p>
      </div>
    {/if}
  </Card>

  <!-- Active Negotiations -->
  <Card>
    <h3 class="mb-4 text-lg font-semibold text-white">Negotiations</h3>

    {#if negotiations.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-surface-700">
              <th class="px-4 py-2 text-left text-surface-400">Bill</th>
              <th class="px-4 py-2 text-left text-surface-400">Category</th>
              <th class="px-4 py-2 text-right text-surface-400">Current</th>
              <th class="px-4 py-2 text-right text-surface-400">Target</th>
              <th class="px-4 py-2 text-right text-surface-400">Result</th>
              <th class="px-4 py-2 text-center text-surface-400">Status</th>
              <th class="px-4 py-2 text-right text-surface-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each negotiations as neg}
              <tr class="border-b border-surface-700/50">
                <td class="px-4 py-3">
                  <p class="font-medium text-white">{neg.billName}</p>
                  <p class="text-xs text-surface-500">{neg.provider}</p>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {categoryBadge(
                      neg.category,
                    )}"
                  >
                    {neg.category}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-surface-300">
                  {fmt(neg.currentAmount)}
                </td>
                <td class="px-4 py-3 text-right text-surface-300">
                  {fmt(neg.targetAmount)}
                </td>
                <td class="px-4 py-3 text-right">
                  {#if neg.negotiatedAmount}
                    <span class="font-medium text-green-400">
                      {fmt(neg.negotiatedAmount)}
                    </span>
                  {:else}
                    <span class="text-surface-500">-</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusBadge(
                      neg.status,
                    )}"
                  >
                    {neg.status.replace('_', ' ')}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <form
                      method="POST"
                      action="?/getScript"
                      use:enhance={() => {
                        return async ({ update }) => {
                          await update();
                        };
                      }}
                    >
                      <input type="hidden" name="provider" value={neg.provider} />
                      <input type="hidden" name="category" value={neg.category} />
                      <input type="hidden" name="currentAmount" value={neg.currentAmount} />
                      <input type="hidden" name="targetAmount" value={neg.targetAmount} />
                      <Button type="submit" size="sm" variant="ghost">Script</Button>
                    </form>
                    {#if neg.status !== 'success' && neg.status !== 'failed' && neg.status !== 'skipped'}
                      <Button size="sm" variant="secondary" onclick={() => openResultModal(neg)}>
                        Update
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="py-6 text-center">
        <p class="text-sm text-surface-400">
          No negotiations yet. Analyze your bills to find opportunities.
        </p>
      </div>
    {/if}
  </Card>

  <!-- Savings History -->
  {#if successfulNegotiations.length > 0}
    <Card>
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-white">Savings History</h3>
        <p class="text-sm text-surface-400">
          Total: <span class="font-medium text-green-400"
            >{fmt(summary.totalAnnualSavings)}/year</span
          >
        </p>
      </div>

      <!-- Savings by category -->
      {#if summary.byCategory.length > 0}
        <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each summary.byCategory as cat}
            <div class="rounded-lg bg-surface-900/50 p-3">
              <div class="flex items-center justify-between">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {categoryBadge(
                    cat.category,
                  )}"
                >
                  {cat.category}
                </span>
                <span class="text-xs text-surface-500">
                  {cat.count} negotiation{cat.count !== 1 ? 's' : ''}
                </span>
              </div>
              <p class="mt-2 text-lg font-bold text-green-400">
                {fmt(cat.annualSavings)}/yr
              </p>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Timeline -->
      <div class="space-y-3">
        {#each successfulNegotiations as neg}
          <div class="flex items-center justify-between rounded-lg bg-surface-900/50 px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-green-600/20">
                <svg
                  class="h-4 w-4 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p class="font-medium text-white">{neg.billName}</p>
                <p class="text-xs text-surface-500">
                  {formatDate(neg.negotiationDate ?? neg.createdAt)}
                  {#if neg.expirationDate}
                    - Rate expires {formatDate(neg.expirationDate)}
                  {/if}
                </p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-sm">
                <span class="text-surface-500 line-through">{fmt(neg.currentAmount)}</span>
                <span class="ml-1 font-medium text-green-400">{fmt(neg.negotiatedAmount)}</span>
              </p>
              <p class="text-xs text-green-400">Saving {fmt(neg.annualSavings ?? 0)}/yr</p>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>

<!-- Start Negotiation Modal -->
<Modal open={showStartModal} onclose={() => (showStartModal = false)} title="Start Negotiation">
  {#if selectedBill}
    <form
      method="POST"
      action="?/startNegotiation"
      class="space-y-4"
      use:enhance={() => {
        return async ({ update }) => {
          showStartModal = false;
          await update();
          await invalidateAll();
        };
      }}
    >
      <input type="hidden" name="billName" value={selectedBill.billName} />
      <input type="hidden" name="provider" value={selectedBill.provider} />
      <input type="hidden" name="category" value={selectedBill.category} />

      <div class="rounded-lg bg-surface-900/50 p-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700">
            <svg
              class="h-5 w-5 text-surface-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d={categoryIcon(selectedBill.category)}
              />
            </svg>
          </div>
          <div>
            <p class="font-medium text-white">{selectedBill.billName}</p>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {categoryBadge(
                selectedBill.category,
              )}"
            >
              {selectedBill.category}
            </span>
          </div>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="currentAmount">
          Current Monthly Amount
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
          <input
            id="currentAmount"
            name="currentAmount"
            type="number"
            step="0.01"
            required
            value={selectedBill.currentAmount}
            class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="targetAmount">
          Target Monthly Amount
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
          <input
            id="targetAmount"
            name="targetAmount"
            type="number"
            step="0.01"
            required
            value={Math.round(
              (selectedBill.currentAmount - selectedBill.estimatedSavingsMax) * 100,
            ) / 100}
            class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <p class="mt-1 text-xs text-surface-500">
          Estimated savings: {fmt(selectedBill.estimatedSavingsMin)} - {fmt(
            selectedBill.estimatedSavingsMax,
          )}/mo
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="notes">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows="2"
          class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Any details about your situation..."></textarea>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onclick={() => (showStartModal = false)}>
          Cancel
        </Button>
        <Button type="submit">Start Negotiation</Button>
      </div>
    </form>
  {/if}
</Modal>

<!-- Update Result Modal -->
<Modal
  open={showResultModal}
  onclose={() => (showResultModal = false)}
  title="Record Negotiation Result"
>
  {#if selectedNegotiation}
    <form
      method="POST"
      action="?/updateResult"
      class="space-y-4"
      use:enhance={() => {
        return async ({ update }) => {
          showResultModal = false;
          await update();
          await invalidateAll();
        };
      }}
    >
      <input type="hidden" name="negotiationId" value={selectedNegotiation.id} />

      <div class="rounded-lg bg-surface-900/50 p-3">
        <p class="font-medium text-white">{selectedNegotiation.billName}</p>
        <p class="text-sm text-surface-400">
          Current: {fmt(selectedNegotiation.currentAmount)}/mo | Target: {fmt(
            selectedNegotiation.targetAmount,
          )}/mo
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="resultStatus">
          Result
        </label>
        <select
          id="resultStatus"
          name="status"
          required
          class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="in_progress">In Progress</option>
          <option value="success">Success - Got a Discount</option>
          <option value="failed">Failed - No Discount</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="negotiatedAmount">
          New Monthly Amount (if successful)
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
          <input
            id="negotiatedAmount"
            name="negotiatedAmount"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Leave blank if not successful"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="expirationDate">
          Promotional Rate Expires On (optional)
        </label>
        <input
          id="expirationDate"
          name="expirationDate"
          type="date"
          class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <p class="mt-1 text-xs text-surface-500">
          We will remind you before the promotional rate expires
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="resultNotes">
          Notes
        </label>
        <textarea
          id="resultNotes"
          name="notes"
          rows="2"
          class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Agent name, reference number, details..."></textarea>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onclick={() => (showResultModal = false)}>
          Cancel
        </Button>
        <Button type="submit">Save Result</Button>
      </div>
    </form>
  {/if}
</Modal>

<!-- Negotiation Script Modal -->
<Modal
  open={showScriptModal}
  onclose={() => {
    showScriptModal = false;
    currentScript = null;
  }}
  title="Negotiation Script"
>
  {#if currentScript}
    <div class="max-h-[70vh] space-y-5 overflow-y-auto">
      <!-- Provider & Contact Info -->
      <div class="rounded-lg bg-surface-900/50 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-semibold text-white">{currentScript.provider}</h4>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {categoryBadge(
                currentScript.category,
              )}"
            >
              {currentScript.category}
            </span>
          </div>
          <Button size="sm" variant="secondary" onclick={copyScriptToClipboard}>
            {#if copiedScript}
              Copied!
            {:else}
              Copy Script
            {/if}
          </Button>
        </div>

        <div class="mt-3 space-y-1 text-sm">
          <p class="text-surface-400">
            <span class="text-surface-300">Retention:</span>
            <span class="font-medium text-primary-400"
              >{currentScript.contactInfo.retentionPhone}</span
            >
          </p>
          <p class="text-surface-400">
            <span class="text-surface-300">Best time:</span>
            {currentScript.contactInfo.bestTimeToCall}
          </p>
        </div>
      </div>

      <!-- Step 1: Opening -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
            >1</span
          >
          <h4 class="font-semibold text-white">Opening</h4>
        </div>
        <p class="rounded-lg bg-surface-900/50 p-3 text-sm italic text-surface-300">
          {currentScript.script.opening}
        </p>
      </div>

      <!-- Step 2: Leverage Points -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
            >2</span
          >
          <h4 class="font-semibold text-white">Key Leverage Points</h4>
        </div>
        <div class="space-y-2">
          {#each currentScript.script.leveragePoints as point, i}
            <div class="rounded-lg bg-surface-900/50 p-3">
              <p class="text-sm text-surface-300">
                <span class="mr-1 font-medium text-primary-400">{i + 1}.</span>
                {point}
              </p>
            </div>
          {/each}
        </div>
      </div>

      <!-- Step 3: Specific Ask -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white"
            >3</span
          >
          <h4 class="font-semibold text-white">The Ask</h4>
        </div>
        <p class="rounded-lg bg-green-500/10 p-3 text-sm font-medium text-green-400">
          {currentScript.script.specificAsk}
        </p>
      </div>

      <!-- Step 4: If Refused -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-600 text-xs font-bold text-white"
            >4</span
          >
          <h4 class="font-semibold text-white">If They Refuse</h4>
        </div>
        <div class="space-y-2">
          {#each currentScript.script.ifRefused as step, i}
            <p class="rounded-lg bg-surface-900/50 p-3 text-sm italic text-surface-300">
              <span class="mr-1 not-italic text-yellow-400">{i + 1}.</span>
              {step}
            </p>
          {/each}
        </div>
      </div>

      <!-- Step 5: Escalation -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white"
            >5</span
          >
          <h4 class="font-semibold text-white">Escalation</h4>
        </div>
        <p class="rounded-lg bg-surface-900/50 p-3 text-sm italic text-surface-300">
          {currentScript.script.escalation}
        </p>
      </div>

      <!-- Step 6: Final Move -->
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white"
            >6</span
          >
          <h4 class="font-semibold text-white">Final Move</h4>
        </div>
        <p class="rounded-lg bg-red-500/10 p-3 text-sm italic text-red-300">
          {currentScript.script.finalMove}
        </p>
      </div>

      <!-- Competitor Pricing -->
      {#if currentScript.competitorPricing?.length > 0}
        <div>
          <h4 class="mb-2 font-semibold text-white">Competitor Pricing (for leverage)</h4>
          <div class="space-y-2">
            {#each currentScript.competitorPricing as comp}
              <div class="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2">
                <div>
                  <p class="text-sm font-medium text-white">{comp.competitor}</p>
                  <p class="text-xs text-surface-500">{comp.details}</p>
                </div>
                <p class="text-sm font-medium text-primary-400">{comp.price}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Tips -->
      {#if currentScript.tips?.length > 0}
        <div>
          <h4 class="mb-2 font-semibold text-white">Provider Tips</h4>
          <div class="space-y-2">
            {#each currentScript.tips as tip, i}
              <div class="flex gap-2 rounded-lg bg-surface-900/50 p-3">
                <span class="mt-0.5 flex-shrink-0 text-xs font-bold text-primary-400">{i + 1}.</span
                >
                <p class="text-sm text-surface-300">{tip}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</Modal>
