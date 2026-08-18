<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import { LineChart, BarChart } from '$components/charts';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  let showCreateModal = $state(false);
  let selectedRuleType = $state<string>('round_up');
  let analyzing = $state(false);

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function fmtPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  const analysis = $derived(data.dashboard.analysis);
  const rules = $derived(data.dashboard.rules);
  const projected = $derived(data.dashboard.projected);
  const history = $derived(data.dashboard.history);

  const activeRules = $derived(rules.filter((r: any) => r.isActive === 1));

  // Dashboard summary values
  const totalSaved = $derived(history.totalSaved ?? 0);
  const projectedAnnualSavings = $derived(projected.monthlyEstimate * 12);
  const activeRuleCount = $derived(projected.activeRuleCount ?? 0);

  // Projected savings chart data
  const chartLabels = $derived(projected.projection.map((p: any) => p.month));
  const chartCumulative = $derived(projected.projection.map((p: any) => p.cumulative));

  // Savings history chart: group transfers by month
  const savingsHistoryByMonth = $derived(() => {
    const monthMap = new Map<string, number>();
    for (const transfer of history.transfers) {
      if (transfer.status !== 'completed') continue;
      const date = new Date(transfer.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + transfer.amount);
    }
    const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return {
      labels: sorted.map(([k]) => k),
      data: sorted.map(([, v]) => v),
    };
  });

  function getRuleIcon(ruleType: string): string {
    switch (ruleType) {
      case 'round_up':
        return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'percentage':
        return 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z';
      case 'fixed':
        return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
      case 'surplus':
        return 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';
      default:
        return 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1';
    }
  }

  function getRuleDescription(rule: any): string {
    switch (rule.ruleType) {
      case 'round_up':
        return `Round up purchases to nearest $${rule.roundUpTo || 1}`;
      case 'percentage':
        return `Save ${rule.amount || 0}% of every paycheck`;
      case 'fixed':
        return `Save ${fmt(rule.amount || 0)} per month`;
      case 'surplus':
        return `Save ${rule.amount || 50}% of monthly surplus`;
      default:
        return rule.name;
    }
  }

  function getRuleExample(rule: any): string {
    switch (rule.ruleType) {
      case 'round_up': {
        const roundTo = rule.roundUpTo || 1;
        if (roundTo === 1) return 'e.g., $4.50 coffee -> $5.00, save $0.50';
        if (roundTo === 5) return 'e.g., $4.50 coffee -> $5.00, save $0.50';
        return 'e.g., $4.50 coffee -> $10.00, save $5.50';
      }
      case 'percentage':
        return `e.g., $3,000 paycheck -> save ${fmt(3000 * ((rule.amount || 10) / 100))}`;
      case 'fixed':
        return `${fmt(rule.amount || 0)} automatically set aside each month`;
      case 'surplus':
        return `If you have $500 surplus, save ${fmt(500 * ((rule.amount || 50) / 100))}`;
      default:
        return '';
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'skipped':
        return 'bg-surface-500/20 text-surface-400';
      default:
        return 'bg-surface-500/20 text-surface-400';
    }
  }
</script>

<svelte:head>
  <title>Smart Savings - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Smart Savings Autopilot</h2>
      <p class="mt-1 text-sm text-surface-400">
        Automated savings recommendations based on your spending patterns
      </p>
    </div>
    <div class="flex gap-3">
      <form
        method="POST"
        action="?/analyze"
        use:enhance={() => {
          analyzing = true;
          return async ({ update }) => {
            analyzing = false;
            await update();
            await invalidateAll();
          };
        }}
      >
        <Button type="submit" variant="secondary" loading={analyzing}>Refresh Analysis</Button>
      </form>
      <Button onclick={() => (showCreateModal = true)}>New Rule</Button>
    </div>
  </div>

  <!-- Dashboard Summary Cards -->
  <div class="grid gap-4 sm:grid-cols-3">
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
          <p class="text-sm text-surface-400">Total Saved</p>
          <p class="text-xl font-bold text-green-400">{fmt(totalSaved)}</p>
          <p class="text-xs text-surface-500">across all rules</p>
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
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Projected Annual Savings</p>
          <p class="text-xl font-bold text-primary-400">{fmt(projectedAnnualSavings)}</p>
          <p class="text-xs text-surface-500">{fmt(projected.monthlyEstimate)}/month</p>
        </div>
      </div>
    </Card>
    <Card>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
          <svg
            class="h-5 w-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm text-surface-400">Active Rules</p>
          <p class="text-xl font-bold text-white">{activeRuleCount}</p>
          <p class="text-xs text-surface-500">
            of {rules.length} total rule{rules.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </Card>
  </div>

  <!-- Analysis Summary Cards -->
  {#if analysis}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <p class="text-sm text-surface-400">Avg Monthly Income</p>
        <p class="mt-1 text-xl font-bold text-green-400">
          {fmt(analysis.averageMonthlyIncome)}
        </p>
      </Card>
      <Card>
        <p class="text-sm text-surface-400">Avg Monthly Expenses</p>
        <p class="mt-1 text-xl font-bold text-red-400">
          {fmt(analysis.averageMonthlyExpenses)}
        </p>
      </Card>
      <Card>
        <p class="text-sm text-surface-400">Avg Monthly Surplus</p>
        <p
          class="mt-1 text-xl font-bold {analysis.averageSurplus >= 0
            ? 'text-green-400'
            : 'text-red-400'}"
        >
          {fmt(analysis.averageSurplus)}
        </p>
      </Card>
      <Card>
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm text-surface-400">Savings Rate</p>
            <p class="mt-1 text-xl font-bold text-white">
              {fmtPct(analysis.currentSavingsRate)}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xs text-surface-500">Recommended</p>
            <p class="text-sm font-medium text-primary-400">
              {fmtPct(analysis.recommendedSavingsRate)}
            </p>
          </div>
        </div>
        <!-- Savings rate progress bar -->
        <div class="mt-3">
          <div class="h-2 w-full rounded-full bg-surface-700">
            <div
              class="h-2 rounded-full transition-all {analysis.currentSavingsRate >=
              analysis.recommendedSavingsRate
                ? 'bg-green-500'
                : 'bg-primary-500'}"
              style="width: {Math.min(
                (analysis.currentSavingsRate / analysis.recommendedSavingsRate) * 100,
                100,
              )}%"
            ></div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Savings Opportunity Callout -->
    {#if analysis.averageSurplus > 0}
      <Card>
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20"
          >
            <svg
              class="h-6 w-6 text-primary-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-white">
              You could safely save {fmt(Math.floor(analysis.averageSurplus * 0.5))} per month
            </p>
            <p class="mt-0.5 text-sm text-surface-400">
              Based on 50% of your average monthly surplus of {fmt(analysis.averageSurplus)}. This
              follows the 50/30/20 budgeting guideline — 50% needs, 30% wants, 20% savings.
            </p>
          </div>
          {#if activeRules.length === 0}
            <Button size="sm" onclick={() => (showCreateModal = true)}>Set Up Auto-Save</Button>
          {/if}
        </div>
      </Card>
    {/if}
  {:else}
    <!-- No analysis yet -->
    <Card>
      <div class="py-8 text-center">
        <svg
          class="mx-auto h-12 w-12 text-surface-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p class="mt-4 text-lg font-medium text-white">No spending analysis yet</p>
        <p class="mt-1 text-sm text-surface-400">
          Run an analysis to see personalized savings recommendations based on your transaction
          history.
        </p>
        <form
          method="POST"
          action="?/analyze"
          class="mt-4"
          use:enhance={() => {
            analyzing = true;
            return async ({ update }) => {
              analyzing = false;
              await update();
              await invalidateAll();
            };
          }}
        >
          <Button type="submit" loading={analyzing}>Analyze My Spending</Button>
        </form>
      </div>
    </Card>
  {/if}

  <!-- Active Savings Rules -->
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-white">Savings Rules</h3>
      <Button size="sm" variant="secondary" onclick={() => (showCreateModal = true)}>
        Add Rule
      </Button>
    </div>

    {#if rules.length > 0}
      <div class="grid gap-4 sm:grid-cols-2">
        {#each rules as rule (rule.id)}
          <Card>
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div
                  class="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg {rule.isActive ===
                  1
                    ? 'bg-primary-600/20'
                    : 'bg-surface-700'}"
                >
                  <svg
                    class="h-5 w-5 {rule.isActive === 1 ? 'text-primary-400' : 'text-surface-500'}"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d={getRuleIcon(rule.ruleType)}
                    />
                  </svg>
                </div>
                <div>
                  <p class="font-medium {rule.isActive === 1 ? 'text-white' : 'text-surface-500'}">
                    {rule.name}
                  </p>
                  <p class="mt-0.5 text-sm text-surface-400">
                    {getRuleDescription(rule)}
                  </p>
                  <p class="mt-1 text-xs text-surface-500 italic">
                    {getRuleExample(rule)}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Toggle switch -->
                <form
                  method="POST"
                  action="?/toggleRule"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update();
                      await invalidateAll();
                    };
                  }}
                >
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <input type="hidden" name="isActive" value={rule.isActive === 1 ? 0 : 1} />
                  <button
                    type="submit"
                    class="relative h-6 w-11 rounded-full transition {rule.isActive === 1
                      ? 'bg-primary-600'
                      : 'bg-surface-600'}"
                    aria-label="Toggle rule"
                  >
                    <span
                      class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {rule.isActive ===
                      1
                        ? 'translate-x-5'
                        : 'translate-x-0'}"
                    ></span>
                  </button>
                </form>

                <!-- Delete -->
                <form
                  method="POST"
                  action="?/deleteRule"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update();
                      await invalidateAll();
                    };
                  }}
                >
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <button
                    type="submit"
                    class="rounded p-1 text-surface-500 hover:bg-surface-700 hover:text-red-400"
                    aria-label="Delete rule"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <Card>
        <div class="py-6 text-center">
          <p class="text-sm text-surface-400">
            No savings rules yet. Create one to start automating your savings.
          </p>
        </div>
      </Card>
    {/if}
  </div>

  <!-- Projected Savings Chart -->
  {#if projected.projection.length > 0}
    <Card>
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Projected Savings</h3>
          <p class="text-sm text-surface-400">
            Estimated {fmt(projected.monthlyEstimate)}/month from {projected.activeRuleCount} active rule{projected.activeRuleCount !==
            1
              ? 's'
              : ''}
          </p>
        </div>
        {#if projected.projection.length > 0}
          <div class="text-right">
            <p class="text-sm text-surface-400">12-month total</p>
            <p class="text-xl font-bold text-green-400">
              {fmt(projected.projection[projected.projection.length - 1]?.cumulative || 0)}
            </p>
          </div>
        {/if}
      </div>
      <LineChart
        labels={chartLabels}
        datasets={[
          {
            label: 'Cumulative Savings',
            data: chartCumulative,
            borderColor: '#10b981',
            fill: true,
            backgroundColor: '#10b98120',
          },
        ]}
        height={300}
      />
    </Card>
  {/if}

  <!-- Monthly Savings Report -->
  {#if analysis}
    <Card>
      <div class="flex items-center gap-3 mb-4">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600/20 to-teal-600/20"
        >
          <svg
            class="h-5 w-5 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-white">Monthly Savings Report</h3>
          <p class="text-sm text-surface-400">How your money is working this month</p>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg bg-surface-800/50 p-4">
          <p class="text-xs font-medium uppercase text-surface-500">Subscriptions</p>
          <p class="mt-1 text-xl font-bold text-white">
            {fmt(analysis.averageMonthlyExpenses * 0.15)}
          </p>
          <p class="mt-1 text-xs text-surface-400">
            ~15% of your monthly spend goes to recurring subscriptions
          </p>
        </div>
        <div class="rounded-lg bg-surface-800/50 p-4">
          <p class="text-xs font-medium uppercase text-surface-500">Annual Projection</p>
          <p class="mt-1 text-xl font-bold text-emerald-400">
            {fmt(analysis.averageMonthlyExpenses * 12)}
          </p>
          <p class="mt-1 text-xs text-surface-400">Projected annual spend at current rate</p>
        </div>
        <div class="rounded-lg bg-surface-800/50 p-4">
          <p class="text-xs font-medium uppercase text-surface-500">Potential Annual Savings</p>
          <p class="mt-1 text-xl font-bold text-emerald-400">
            {fmt(
              (analysis.spendingReductions || []).reduce(
                (sum: number, r: any) => sum + (r.potentialSaving || 0),
                0,
              ) * 12,
            )}
          </p>
          <p class="mt-1 text-xs text-surface-400">If you act on all reduction opportunities</p>
        </div>
        <div class="rounded-lg bg-surface-800/50 p-4">
          <p class="text-xs font-medium uppercase text-surface-500">Target Savings Rate</p>
          <div class="mt-1 flex items-baseline gap-2">
            <p
              class="text-xl font-bold {analysis.currentSavingsRate >= 20
                ? 'text-emerald-400'
                : 'text-amber-400'}"
            >
              {fmtPct(analysis.currentSavingsRate)}
            </p>
            <span class="text-sm text-surface-400">/ 20% goal</span>
          </div>
          <div class="mt-2 h-1.5 w-full rounded-full bg-surface-700">
            <div
              class="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
              style="width: {Math.min((analysis.currentSavingsRate / 20) * 100, 100)}%"
            ></div>
          </div>
        </div>
      </div>
    </Card>
  {/if}

  <!-- Negotiation Suggestions -->
  {#if analysis}
    {@const highSpendCategories = (analysis.spendingReductions || []).filter(
      (r: any) => r.potentialSaving > 20,
    )}
    {#if highSpendCategories.length > 0}
      <Card>
        <div class="flex items-center gap-3 mb-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/20">
            <svg
              class="h-5 w-5 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">Negotiation Suggestions</h3>
            <p class="text-sm text-surface-400">Bills you might be able to negotiate down</p>
          </div>
        </div>
        <div class="space-y-3">
          {#each highSpendCategories as cat}
            <div class="flex items-center justify-between rounded-lg bg-surface-800/50 p-4">
              <div class="flex items-center gap-3">
                <div
                  class="h-3 w-3 rounded-full"
                  style="background-color: {cat.categoryColor}"
                ></div>
                <div>
                  <p class="text-sm font-medium text-white">{cat.categoryName}</p>
                  <p class="text-xs text-surface-400">
                    Your avg: {fmt(cat.monthlyAverage)}/mo. Typical: {fmt(cat.overallAverage)}/mo
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-bold text-emerald-400">Save {fmt(cat.potentialSaving)}/mo</p>
                <p class="text-xs text-surface-500">{fmt(cat.potentialSaving * 12)}/year</p>
              </div>
            </div>
          {/each}
        </div>
        <div class="mt-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3">
          <p class="text-sm text-emerald-400">
            Total potential savings:
            <span class="font-bold">
              {fmt(
                highSpendCategories.reduce((s: number, c: any) => s + c.potentialSaving, 0),
              )}/month
            </span>
            ({fmt(
              highSpendCategories.reduce((s: number, c: any) => s + c.potentialSaving, 0) * 12,
            )}/year)
          </p>
        </div>
      </Card>
    {/if}
  {/if}

  <!-- Spending Reduction Opportunities -->
  {#if analysis}
    {@const reductions = analysis.spendingReductions || []}
    {#if reductions.length > 0}
      <Card>
        <h3 class="mb-4 text-lg font-semibold text-white">Spending Reduction Opportunities</h3>
        <p class="mb-4 text-sm text-surface-400">
          These categories are above your average spend. Reducing them could increase your savings.
        </p>
        <div class="space-y-3">
          {#each reductions as category}
            <div class="flex items-center justify-between rounded-lg bg-surface-800/50 p-3">
              <div class="flex items-center gap-3">
                <div
                  class="h-3 w-3 rounded-full"
                  style="background-color: {category.categoryColor}"
                ></div>
                <div>
                  <p class="text-sm font-medium text-white">{category.categoryName}</p>
                  <p class="text-xs text-surface-500">
                    {fmt(category.monthlyAverage)}/mo avg vs {fmt(category.overallAverage)}/mo
                    overall
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-yellow-400">
                  {fmt(category.potentialSaving)}/mo
                </p>
                <p class="text-xs text-surface-500">potential savings</p>
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {/if}
  {/if}

  <!-- Savings History Chart -->
  {#if savingsHistoryByMonth().labels.length > 1}
    <Card>
      <h3 class="mb-4 text-lg font-semibold text-white">Monthly Savings History</h3>
      <BarChart
        labels={savingsHistoryByMonth().labels}
        datasets={[
          { label: 'Savings', data: savingsHistoryByMonth().data, backgroundColor: '#10b981' },
        ]}
        height={220}
      />
    </Card>
  {/if}

  <!-- Savings Transfer History -->
  <Card>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-white">Savings History</h3>
      {#if history.totalSaved > 0}
        <p class="text-sm text-surface-400">
          Total saved: <span class="font-medium text-green-400">{fmt(history.totalSaved)}</span>
        </p>
      {/if}
    </div>

    {#if history.transfers.length > 0}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-surface-700">
              <th class="px-4 py-2 text-left text-surface-400">Date</th>
              <th class="px-4 py-2 text-left text-surface-400">Rule</th>
              <th class="px-4 py-2 text-left text-surface-400">Trigger</th>
              <th class="px-4 py-2 text-right text-surface-400">Amount</th>
              <th class="px-4 py-2 text-right text-surface-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each history.transfers as transfer}
              <tr class="border-b border-surface-700/50">
                <td class="px-4 py-2 text-surface-300">
                  {new Date(transfer.createdAt).toLocaleDateString()}
                </td>
                <td class="px-4 py-2 text-white">{transfer.ruleName || 'Deleted rule'}</td>
                <td class="px-4 py-2 text-surface-400">
                  {transfer.calculatedFrom || '-'}
                </td>
                <td class="px-4 py-2 text-right font-medium text-green-400">
                  {fmt(transfer.amount)}
                </td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {getStatusBadgeClass(
                      transfer.status,
                    )}"
                  >
                    {transfer.status}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="py-6 text-center">
        <p class="text-sm text-surface-400">
          No savings transfers yet. Set up rules to start tracking automated savings.
        </p>
      </div>
    {/if}
  </Card>
</div>

<!-- Create Rule Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Create Savings Rule">
  <form
    method="POST"
    action="?/createRule"
    class="space-y-4"
    use:enhance={() => {
      return async ({ update }) => {
        showCreateModal = false;
        await update();
        await invalidateAll();
      };
    }}
  >
    <!-- Rule Type Selection -->
    <div>
      <label class="mb-2 block text-sm font-medium text-surface-300" for="ruleType">
        Rule Type
      </label>
      <div class="grid grid-cols-2 gap-2">
        {#each [{ value: 'round_up', label: 'Round Up', desc: 'Round purchases up' }, { value: 'percentage', label: 'Percentage', desc: '% of income' }, { value: 'fixed', label: 'Fixed Amount', desc: 'Set monthly amount' }, { value: 'surplus', label: 'Surplus', desc: '% of monthly surplus' }] as option}
          <button
            type="button"
            onclick={() => (selectedRuleType = option.value)}
            class="rounded-lg border p-3 text-left transition {selectedRuleType === option.value
              ? 'border-primary-500 bg-primary-600/10'
              : 'border-surface-700 bg-surface-800 hover:border-surface-600'}"
          >
            <p
              class="text-sm font-medium {selectedRuleType === option.value
                ? 'text-primary-400'
                : 'text-white'}"
            >
              {option.label}
            </p>
            <p class="text-xs text-surface-500">{option.desc}</p>
          </button>
        {/each}
      </div>
      <input type="hidden" name="ruleType" value={selectedRuleType} />
    </div>

    <!-- Rule Name -->
    <div>
      <label class="mb-1 block text-sm font-medium text-surface-300" for="ruleName"> Name </label>
      <input
        id="ruleName"
        name="name"
        type="text"
        required
        class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="e.g., Coffee fund round-up"
      />
    </div>

    <!-- Conditional fields based on rule type -->
    {#if selectedRuleType === 'round_up'}
      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="roundUpTo">
          Round up to nearest
        </label>
        <select
          id="roundUpTo"
          name="roundUpTo"
          class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="1">$1.00</option>
          <option value="5">$5.00</option>
          <option value="10">$10.00</option>
        </select>
        <p class="mt-1 text-xs text-surface-500">
          Example: $4.50 purchase rounded to $5.00 saves $0.50
        </p>
      </div>
    {:else if selectedRuleType === 'percentage'}
      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="amount">
          Percentage of income
        </label>
        <div class="relative">
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            max="100"
            step="1"
            value="10"
            required
            class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 pr-8 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500">%</span>
        </div>
        <p class="mt-1 text-xs text-surface-500">Save this percentage of every paycheck deposit</p>
      </div>
    {:else if selectedRuleType === 'fixed'}
      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="amount">
          Monthly amount
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            value="200"
            required
            class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <p class="mt-1 text-xs text-surface-500">A fixed amount automatically saved each month</p>
      </div>
    {:else if selectedRuleType === 'surplus'}
      <div>
        <label class="mb-1 block text-sm font-medium text-surface-300" for="amount">
          Percentage of surplus
        </label>
        <div class="relative">
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            max="100"
            step="1"
            value="50"
            required
            class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 pr-8 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500">%</span>
        </div>
        <p class="mt-1 text-xs text-surface-500">
          Save this percentage of your monthly income-minus-expenses surplus
        </p>
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-2">
      <Button variant="secondary" type="button" onclick={() => (showCreateModal = false)}>
        Cancel
      </Button>
      <Button type="submit">Create Rule</Button>
    </div>
  </form>
</Modal>
