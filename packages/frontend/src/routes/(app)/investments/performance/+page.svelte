<script lang="ts">
  import { goto } from '$app/navigation';
  import { Card, Button } from '$components/ui';
  import { LineChart } from '$components/charts';
  import type { PageData } from './$types';

  let { data } = $props<{ data: PageData }>();

  const periods = ['1M', '3M', '6M', '1Y', 'YTD', 'ALL'] as const;

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function fmtPct(pct: number): string {
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }

  function gainLossColor(value: number): string {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-surface-400';
  }

  function selectPeriod(period: string) {
    goto(`/investments/performance?period=${period}`, { invalidateAll: true });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const chartLabels = $derived(data.performance.periodData.map((p: any) => formatDate(p.date)));
  const chartData = $derived(data.performance.periodData.map((p: any) => p.value));
  const hasData = $derived(data.performance.periodData.length > 1);

  // Flatten all holdings into a single sorted list for the security table
  const allHoldings = $derived(() => {
    const list: any[] = [];
    for (const group of data.holdings) {
      for (const h of group.holdings) {
        list.push(h);
      }
    }
    return list.sort((a, b) => Math.abs(b.gainLoss) - Math.abs(a.gainLoss));
  });

  // Compute benchmarks (approximate index returns for comparison)
  const benchmarks = $derived(() => {
    const periodMonths: Record<string, number> = {
      '1M': 1,
      '3M': 3,
      '6M': 6,
      '1Y': 12,
      YTD: 2,
      ALL: 60,
    };
    const months = periodMonths[data.period] ?? 12;

    // Historical average annual returns (approximations for display)
    const spAnnual = 10.5;
    const nasdaqAnnual = 13.0;
    const bondAnnual = 4.5;

    function annualToPeroid(annual: number, m: number) {
      return ((1 + annual / 100) ** (m / 12) - 1) * 100;
    }

    return [
      { name: 'S&P 500', annualReturn: spAnnual, periodReturn: annualToPeroid(spAnnual, months) },
      {
        name: 'NASDAQ',
        annualReturn: nasdaqAnnual,
        periodReturn: annualToPeroid(nasdaqAnnual, months),
      },
      {
        name: 'US Bonds',
        annualReturn: bondAnnual,
        periodReturn: annualToPeroid(bondAnnual, months),
      },
    ];
  });

  // Metrics
  const costBasis = $derived(data.summary.totalCostBasis);
  const currentValue = $derived(data.summary.totalValue);
  const totalReturn = $derived(data.performance.totalReturn);
  const totalReturnPct = $derived(data.performance.totalReturnPercent);

  // Top / worst performers
  const topPerformers = $derived(() => {
    return allHoldings()
      .filter((h: any) => h.gainLossPercent > 0)
      .slice(0, 3);
  });
  const worstPerformers = $derived(() => {
    return [...allHoldings()]
      .filter((h: any) => h.gainLossPercent < 0)
      .sort((a: any, b: any) => a.gainLossPercent - b.gainLossPercent)
      .slice(0, 3);
  });
</script>

<svelte:head>
  <title>Investment Performance - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/investments"
      class="text-surface-400 transition hover:text-white"
      aria-label="Back to investments"
    >
      <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
    </a>
    <div class="flex-1">
      <h2 class="text-2xl font-bold text-white">Portfolio Performance</h2>
      <p class="mt-1 text-sm text-surface-400">Detailed analysis of your investment returns</p>
    </div>
  </div>

  <!-- Period selector -->
  <div class="flex gap-1 rounded-lg bg-surface-800 p-1">
    {#each periods as period}
      <button
        class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition
					{data.period === period ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}"
        onclick={() => selectPeriod(period)}
      >
        {period}
      </button>
    {/each}
  </div>

  <!-- Performance metrics -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <p class="text-sm text-surface-400">Current Value</p>
      <p class="mt-1 text-2xl font-bold text-white">{fmt(currentValue)}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Cost Basis</p>
      <p class="mt-1 text-2xl font-bold text-surface-300">{fmt(costBasis)}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Total Return</p>
      <p class="mt-1 text-2xl font-bold {gainLossColor(totalReturn)}">
        {fmt(totalReturn)}
      </p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Return %</p>
      <p class="mt-1 text-2xl font-bold {gainLossColor(totalReturnPct)}">
        {fmtPct(totalReturnPct)}
      </p>
    </Card>
  </div>

  <!-- Performance chart -->
  <Card>
    <h3 class="mb-4 text-lg font-semibold text-white">Portfolio Value ({data.period})</h3>
    {#if hasData}
      <LineChart
        labels={chartLabels}
        datasets={[
          {
            label: 'Portfolio Value',
            data: chartData,
            borderColor: totalReturn >= 0 ? '#22c55e' : '#ef4444',
            fill: true,
            backgroundColor: totalReturn >= 0 ? '#22c55e20' : '#ef444420',
          },
        ]}
        height={320}
      />
    {:else}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <svg
          class="h-12 w-12 text-surface-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
        <p class="mt-3 text-sm text-surface-400">Not enough price history data for this period.</p>
        <p class="mt-1 text-xs text-surface-500">Data accumulates as prices are synced daily.</p>
      </div>
    {/if}
  </Card>

  <!-- Comparison Benchmarks -->
  <Card>
    <h3 class="mb-4 text-lg font-semibold text-white">Benchmark Comparison</h3>
    <p class="mb-4 text-xs text-surface-500">
      Approximate historical average returns for reference. Actual benchmark returns may vary.
    </p>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-surface-700">
            <th class="px-4 py-2 text-left text-surface-400">Benchmark</th>
            <th class="px-4 py-2 text-right text-surface-400">Avg Annual Return</th>
            <th class="px-4 py-2 text-right text-surface-400">{data.period} Est. Return</th>
            <th class="px-4 py-2 text-right text-surface-400">Your {data.period} Return</th>
            <th class="px-4 py-2 text-right text-surface-400">Difference</th>
          </tr>
        </thead>
        <tbody>
          {#each benchmarks() as benchmark}
            {@const diff = totalReturnPct - benchmark.periodReturn}
            <tr class="border-b border-surface-700/50">
              <td class="px-4 py-3 font-medium text-white">{benchmark.name}</td>
              <td class="px-4 py-3 text-right text-surface-300">{fmtPct(benchmark.annualReturn)}</td
              >
              <td class="px-4 py-3 text-right text-surface-300">{fmtPct(benchmark.periodReturn)}</td
              >
              <td class="px-4 py-3 text-right font-medium {gainLossColor(totalReturnPct)}"
                >{fmtPct(totalReturnPct)}</td
              >
              <td class="px-4 py-3 text-right font-medium {gainLossColor(diff)}">
                {fmtPct(diff)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>

  <!-- Top and Worst performers side by side -->
  {#if allHoldings().length > 0}
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Top performers -->
      <Card>
        <h3 class="mb-4 text-lg font-semibold text-white">
          <span class="mr-2">Top Performers</span>
        </h3>
        {#if topPerformers().length > 0}
          <div class="space-y-3">
            {#each topPerformers() as holding, i}
              <div class="flex items-center justify-between rounded-lg bg-surface-700/30 px-4 py-3">
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-xs font-bold text-green-400"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p class="font-medium text-white">
                      {holding.tickerSymbol || holding.securityName}
                    </p>
                    {#if holding.tickerSymbol}
                      <p class="text-xs text-surface-500">{holding.securityName}</p>
                    {/if}
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-medium text-green-400">{fmtPct(holding.gainLossPercent)}</p>
                  <p class="text-xs text-green-400/70">{fmt(holding.gainLoss)}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="py-4 text-center text-sm text-surface-400">No holdings with positive returns</p>
        {/if}
      </Card>

      <!-- Worst performers -->
      <Card>
        <h3 class="mb-4 text-lg font-semibold text-white">
          <span class="mr-2">Underperformers</span>
        </h3>
        {#if worstPerformers().length > 0}
          <div class="space-y-3">
            {#each worstPerformers() as holding, i}
              <div class="flex items-center justify-between rounded-lg bg-surface-700/30 px-4 py-3">
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-xs font-bold text-red-400"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p class="font-medium text-white">
                      {holding.tickerSymbol || holding.securityName}
                    </p>
                    {#if holding.tickerSymbol}
                      <p class="text-xs text-surface-500">{holding.securityName}</p>
                    {/if}
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-medium text-red-400">{fmtPct(holding.gainLossPercent)}</p>
                  <p class="text-xs text-red-400/70">{fmt(holding.gainLoss)}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="py-4 text-center text-sm text-surface-400">No holdings with negative returns</p>
        {/if}
      </Card>
    </div>
  {/if}

  <!-- Individual Security Performance Table -->
  {#if allHoldings().length > 0}
    <Card padding="none">
      <div class="border-b border-surface-700 px-6 py-4">
        <h3 class="text-lg font-semibold text-white">All Holdings Performance</h3>
        <p class="mt-1 text-xs text-surface-500">
          {allHoldings().length} securities sorted by absolute gain/loss
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-surface-700 text-xs text-surface-400">
              <th class="px-6 py-3 text-left">Symbol</th>
              <th class="px-4 py-3 text-left">Name</th>
              <th class="px-4 py-3 text-left">Type</th>
              <th class="px-4 py-3 text-right">Shares</th>
              <th class="px-4 py-3 text-right">Cost Basis</th>
              <th class="px-4 py-3 text-right">Current Value</th>
              <th class="px-4 py-3 text-right">Gain/Loss</th>
              <th class="px-4 py-3 text-right">Return %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-700/50">
            {#each allHoldings() as holding}
              <tr class="hover:bg-surface-700/30 transition">
                <td class="px-6 py-3 font-medium text-white">
                  {holding.tickerSymbol || '--'}
                </td>
                <td class="px-4 py-3 text-surface-300">
                  <span class="line-clamp-1 max-w-[200px]">{holding.securityName}</span>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full bg-surface-700 px-2 py-0.5 text-xs capitalize text-surface-300"
                  >
                    {holding.securityType || 'other'}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-surface-300">
                  {holding.quantity.toFixed(4)}
                </td>
                <td class="px-4 py-3 text-right text-surface-300">
                  {fmt(holding.costBasis)}
                </td>
                <td class="px-4 py-3 text-right font-medium text-white">
                  {fmt(holding.currentValue)}
                </td>
                <td class="px-4 py-3 text-right font-medium {gainLossColor(holding.gainLoss)}">
                  {fmt(holding.gainLoss)}
                </td>
                <td
                  class="px-4 py-3 text-right font-medium {gainLossColor(holding.gainLossPercent)}"
                >
                  {fmtPct(holding.gainLossPercent)}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t border-surface-600 bg-surface-700/30">
              <td class="px-6 py-3 font-semibold text-white" colspan="4">Total</td>
              <td class="px-4 py-3 text-right font-semibold text-surface-300">{fmt(costBasis)}</td>
              <td class="px-4 py-3 text-right font-semibold text-white">{fmt(currentValue)}</td>
              <td class="px-4 py-3 text-right font-semibold {gainLossColor(totalReturn)}"
                >{fmt(totalReturn)}</td
              >
              <td class="px-4 py-3 text-right font-semibold {gainLossColor(totalReturnPct)}"
                >{fmtPct(totalReturnPct)}</td
              >
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  {/if}
</div>
