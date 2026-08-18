<script lang="ts">
  import { Card } from '$components/ui';

  // Current loan inputs
  let currentBalance = $state(280000);
  let currentRate = $state(7.0);
  let currentMonthlyPayment = $state(1863);
  let currentRemainingMonths = $state(300);

  // New loan inputs
  let newRate = $state(5.5);
  let newTermYears = $state(30);
  let closingCosts = $state(5000);

  // Calculations
  let newMonthlyRate = $derived(newRate / 100 / 12);
  let newTotalPayments = $derived(newTermYears * 12);

  let newMonthlyPayment = $derived.by(() => {
    if (newMonthlyRate === 0) return currentBalance / newTotalPayments;
    return (
      (currentBalance * (newMonthlyRate * Math.pow(1 + newMonthlyRate, newTotalPayments))) /
      (Math.pow(1 + newMonthlyRate, newTotalPayments) - 1)
    );
  });

  let monthlySavings = $derived(currentMonthlyPayment - newMonthlyPayment);
  let breakEvenMonths = $derived(
    monthlySavings > 0 ? Math.ceil(closingCosts / monthlySavings) : null,
  );
  let totalCostCurrent = $derived(currentMonthlyPayment * currentRemainingMonths);
  let totalCostNew = $derived(newMonthlyPayment * newTotalPayments + closingCosts);
  let totalSavingsOverLife = $derived(totalCostCurrent - totalCostNew);

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function fmtMonths(months: number | null): string {
    if (months === null) return 'N/A';
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return remaining > 0 ? `${years}yr ${remaining}mo` : `${years} year${years !== 1 ? 's' : ''}`;
  }
</script>

<svelte:head>
  <title>Refinance Calculator - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <a
      aria-label="Back to calculators"
      href="/calculators"
      class="text-surface-400 hover:text-white transition"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h2 class="text-2xl font-bold text-white">Refinance Calculator</h2>
  </div>

  <!-- Input forms - side by side -->
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- Current Loan -->
    <Card>
      <h3 class="text-lg font-semibold text-white mb-4">
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400 mr-2"
          >A</span
        >
        Current Loan
      </h3>
      <div class="space-y-4">
        <div>
          <label for="currentBalance" class="block text-sm font-medium text-surface-300"
            >Remaining Balance</label
          >
          <input
            id="currentBalance"
            type="number"
            bind:value={currentBalance}
            min="0"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="currentRate" class="block text-sm font-medium text-surface-300"
            >Current Rate (%)</label
          >
          <input
            id="currentRate"
            type="number"
            bind:value={currentRate}
            min="0"
            step="0.125"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="currentMonthly" class="block text-sm font-medium text-surface-300"
            >Monthly Payment</label
          >
          <input
            id="currentMonthly"
            type="number"
            bind:value={currentMonthlyPayment}
            min="0"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="currentRemaining" class="block text-sm font-medium text-surface-300"
            >Remaining Months</label
          >
          <input
            id="currentRemaining"
            type="number"
            bind:value={currentRemainingMonths}
            min="1"
            max="600"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
    </Card>

    <!-- New Loan -->
    <Card>
      <h3 class="text-lg font-semibold text-white mb-4">
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs font-bold text-green-400 mr-2"
          >B</span
        >
        New Loan (Refinance)
      </h3>
      <div class="space-y-4">
        <div>
          <label for="newRate" class="block text-sm font-medium text-surface-300"
            >New Rate (%)</label
          >
          <input
            id="newRate"
            type="number"
            bind:value={newRate}
            min="0"
            step="0.125"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="newTerm" class="block text-sm font-medium text-surface-300"
            >New Loan Term</label
          >
          <div class="mt-1 flex gap-2">
            {#each [10, 15, 20, 30] as term}
              <button
                class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition {newTermYears ===
                term
                  ? 'border-primary-500 bg-primary-600/20 text-primary-400'
                  : 'border-surface-600 bg-surface-700 text-surface-300 hover:border-surface-500'}"
                onclick={() => (newTermYears = term)}
              >
                {term} yr
              </button>
            {/each}
          </div>
        </div>
        <div>
          <label for="closingCosts" class="block text-sm font-medium text-surface-300"
            >Closing Costs</label
          >
          <input
            id="closingCosts"
            type="number"
            bind:value={closingCosts}
            min="0"
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
    </Card>
  </div>

  <!-- Results comparison -->
  <Card>
    <h3 class="text-lg font-semibold text-white mb-4">Comparison</h3>
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg bg-surface-900 p-4 text-center">
        <p class="text-sm text-surface-400">Current Payment</p>
        <p class="mt-1 text-2xl font-bold text-white">{fmt(currentMonthlyPayment)}</p>
      </div>
      <div class="rounded-lg bg-surface-900 p-4 text-center">
        <p class="text-sm text-surface-400">New Payment</p>
        <p class="mt-1 text-2xl font-bold text-green-400">{fmt(newMonthlyPayment)}</p>
      </div>
      <div class="rounded-lg bg-surface-900 p-4 text-center">
        <p class="text-sm text-surface-400">Monthly Savings</p>
        <p class="mt-1 text-2xl font-bold {monthlySavings > 0 ? 'text-green-400' : 'text-red-400'}">
          {monthlySavings > 0 ? '+' : ''}{fmt(monthlySavings)}
        </p>
      </div>
    </div>
  </Card>

  <!-- Break-even and total savings -->
  <div class="grid gap-4 sm:grid-cols-2">
    <Card>
      <div class="text-center py-4">
        <p class="text-sm text-surface-400">Break-Even Point</p>
        {#if breakEvenMonths !== null}
          <p class="mt-2 text-3xl font-bold text-primary-400">{fmtMonths(breakEvenMonths)}</p>
          <p class="mt-1 text-xs text-surface-500">
            You'll recover closing costs of {fmt(closingCosts)} in {breakEvenMonths} months
          </p>
        {:else}
          <p class="mt-2 text-xl font-bold text-red-400">No break-even</p>
          <p class="mt-1 text-xs text-surface-500">
            The new payment is higher or equal; refinancing does not save money monthly.
          </p>
        {/if}
      </div>
    </Card>

    <Card>
      <div class="text-center py-4">
        <p class="text-sm text-surface-400">Lifetime Savings</p>
        <p
          class="mt-2 text-3xl font-bold {totalSavingsOverLife > 0
            ? 'text-green-400'
            : 'text-red-400'}"
        >
          {totalSavingsOverLife > 0 ? '+' : ''}{fmt(totalSavingsOverLife)}
        </p>
        <div class="mt-3 flex justify-center gap-6 text-xs text-surface-500">
          <span>Current total: {fmt(totalCostCurrent)}</span>
          <span>New total: {fmt(totalCostNew)}</span>
        </div>
      </div>
    </Card>
  </div>

  <!-- Visual comparison bar -->
  <Card>
    <h3 class="text-lg font-semibold text-white mb-4">Total Cost Comparison</h3>
    {@const maxCost = Math.max(totalCostCurrent, totalCostNew)}
    <div class="space-y-3">
      <div>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span class="text-surface-300">Current Loan</span>
          <span class="font-medium text-white">{fmt(totalCostCurrent)}</span>
        </div>
        <div class="h-4 overflow-hidden rounded-full bg-surface-700">
          <div
            class="h-full rounded-full bg-red-500/70 transition-all"
            style="width: {maxCost > 0 ? (totalCostCurrent / maxCost) * 100 : 0}%"
          ></div>
        </div>
      </div>
      <div>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span class="text-surface-300">Refinanced Loan</span>
          <span class="font-medium text-white">{fmt(totalCostNew)}</span>
        </div>
        <div class="h-4 overflow-hidden rounded-full bg-surface-700">
          <div
            class="h-full rounded-full bg-green-500/70 transition-all"
            style="width: {maxCost > 0 ? (totalCostNew / maxCost) * 100 : 0}%"
          ></div>
        </div>
      </div>
    </div>
  </Card>
</div>
