<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import { DonutChart, LineChart } from '$components/charts';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let activeTab = $state<'holdings' | 'allocation' | 'performance'>('holdings');
	let syncing = $state(false);

	$effect(() => {
		if (form?.success) {
			syncing = false;
			invalidateAll();
		}
		if (form?.error) {
			syncing = false;
		}
	});

	const periods = ['1M', '3M', '6M', '1Y', 'YTD', 'ALL'] as const;

	function selectPeriod(period: string) {
		goto(`/investments?period=${period}`, { invalidateAll: true });
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
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

	const allocationColors: Record<string, string> = {
		equity: '#3b82f6',
		etf: '#8b5cf6',
		'mutual fund': '#06b6d4',
		bond: '#22c55e',
		cash: '#f59e0b',
		other: '#71717a'
	};

	function getAllocationColor(type: string): string {
		return allocationColors[type] ?? '#71717a';
	}

	const allocationLabels = $derived(data.allocation.map((a: any) => a.type));
	const allocationData = $derived(data.allocation.map((a: any) => a.value));
	const allocationChartColors = $derived(
		data.allocation.map((a: any) => getAllocationColor(a.type))
	);

	const hasHoldings = $derived(data.summary.holdingCount > 0);

	// Performance chart data
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const perfChartLabels = $derived(
		data.performance.periodData.map((p: any) => formatDate(p.date))
	);
	const perfChartData = $derived(data.performance.periodData.map((p: any) => p.value));
	const hasPerfData = $derived(data.performance.periodData.length > 1);

	// Day change calculation (approximate from last two data points)
	const dayChange = $derived(() => {
		const points = data.performance.periodData;
		if (points.length < 2) return { amount: 0, percent: 0 };
		const current = points[points.length - 1]?.value ?? 0;
		const previous = points[points.length - 2]?.value ?? 0;
		const change = current - previous;
		const pct = previous > 0 ? (change / previous) * 100 : 0;
		return { amount: change, percent: pct };
	});
</script>

<svelte:head>
	<title>Investments - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Investments</h2>
			<p class="mt-1 text-sm text-surface-400">Track your portfolio performance and allocation</p>
		</div>
		<div class="flex gap-2">
			<a href="/investments/fees">
				<Button variant="secondary">
					<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Fee Analyzer
				</Button>
			</a>
			<a href="/investments/performance">
				<Button variant="secondary">
					<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					Detailed Performance
				</Button>
			</a>
			<form
				method="POST"
				action="?/sync"
				use:enhance={() => {
					syncing = true;
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<Button type="submit" loading={syncing}>
					<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Sync from Plaid
				</Button>
			</form>
		</div>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Portfolio summary cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
					<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Total Value</p>
					<p class="text-2xl font-bold text-white">{fmt(data.summary.totalValue)}</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700">
					<svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Day Change</p>
					<p class="text-2xl font-bold {gainLossColor(dayChange().amount)}">{fmt(dayChange().amount)}</p>
					<p class="text-xs {gainLossColor(dayChange().percent)}">{fmtPct(dayChange().percent)}</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {data.summary.totalGainLoss >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}">
					<svg class="h-5 w-5 {data.summary.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						{#if data.summary.totalGainLoss >= 0}
							<path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
						{/if}
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Total Gain/Loss</p>
					<p class="text-2xl font-bold {gainLossColor(data.summary.totalGainLoss)}">
						{fmt(data.summary.totalGainLoss)}
					</p>
					<p class="text-xs {gainLossColor(data.summary.totalGainLossPercent)}">
						{fmtPct(data.summary.totalGainLossPercent)}
					</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
					<svg class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Holdings</p>
					<p class="text-2xl font-bold text-white">{data.summary.holdingCount}</p>
					<p class="text-xs text-surface-500">across {data.holdings.length || 0} account{data.holdings.length !== 1 ? 's' : ''}</p>
				</div>
			</div>
		</Card>
	</div>

	{#if !hasHoldings}
		<!-- Empty state -->
		<Card>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<svg
					class="h-16 w-16 text-surface-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No investment holdings</p>
				<p class="mt-1 text-sm text-surface-500">
					<a href="/accounts" class="text-primary-400 hover:text-primary-300"
						>Link an investment account</a
					> to start tracking your portfolio.
				</p>
			</div>
		</Card>
	{:else}
		<!-- Tab navigation -->
		<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
			<button
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition
					{activeTab === 'holdings'
					? 'bg-surface-700 text-white'
					: 'text-surface-400 hover:text-white'}"
				onclick={() => (activeTab = 'holdings')}
			>
				Holdings
			</button>
			<button
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition
					{activeTab === 'performance'
					? 'bg-surface-700 text-white'
					: 'text-surface-400 hover:text-white'}"
				onclick={() => (activeTab = 'performance')}
			>
				Performance
			</button>
			<button
				class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition
					{activeTab === 'allocation'
					? 'bg-surface-700 text-white'
					: 'text-surface-400 hover:text-white'}"
				onclick={() => (activeTab = 'allocation')}
			>
				Allocation
			</button>
		</div>

		<!-- Holdings tab -->
		{#if activeTab === 'holdings'}
			{#each data.holdings as accountGroup}
				<Card padding="none">
					<div class="border-b border-surface-700 px-6 py-4">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-semibold text-white">{accountGroup.accountName}</h3>
								{#if accountGroup.institutionName}
									<p class="text-xs text-surface-500">{accountGroup.institutionName}</p>
								{/if}
							</div>
							<div class="text-right">
								<p class="font-semibold text-white">{fmt(accountGroup.totalValue)}</p>
								<p class="text-xs {gainLossColor(accountGroup.totalGainLoss)}">
									{fmt(accountGroup.totalGainLoss)} ({fmtPct(accountGroup.totalGainLossPercent)})
								</p>
							</div>
						</div>
					</div>

					<!-- Holdings table -->
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b border-surface-700 text-xs text-surface-400">
									<th class="px-6 py-3 text-left">Symbol / Name</th>
									<th class="px-4 py-3 text-right">Shares</th>
									<th class="px-4 py-3 text-right">Cost Basis</th>
									<th class="px-4 py-3 text-right">Current Value</th>
									<th class="px-4 py-3 text-right">Gain/Loss</th>
									<th class="px-4 py-3 text-right">%</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-700/50">
								{#each accountGroup.holdings as holding}
									<tr class="hover:bg-surface-700/30 transition">
										<td class="px-6 py-3">
											<p class="font-medium text-white">
												{holding.tickerSymbol || '--'}
											</p>
											<p class="text-xs text-surface-500">{holding.securityName}</p>
										</td>
										<td class="px-4 py-3 text-right text-sm text-surface-300">
											{holding.quantity.toFixed(4)}
										</td>
										<td class="px-4 py-3 text-right text-sm text-surface-300">
											{fmt(holding.costBasis)}
										</td>
										<td class="px-4 py-3 text-right text-sm font-medium text-white">
											{fmt(holding.currentValue)}
										</td>
										<td class="px-4 py-3 text-right text-sm font-medium {gainLossColor(holding.gainLoss)}">
											{fmt(holding.gainLoss)}
										</td>
										<td class="px-4 py-3 text-right text-sm {gainLossColor(holding.gainLossPercent)}">
											{fmtPct(holding.gainLossPercent)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card>
			{/each}
		{/if}

		<!-- Performance tab -->
		{#if activeTab === 'performance'}
			<!-- Period selector -->
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-semibold text-white">Portfolio Value Over Time</h3>
				<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
					{#each periods as period}
						<button
							class="rounded-md px-3 py-1.5 text-sm font-medium transition
								{data.period === period
								? 'bg-primary-600 text-white'
								: 'text-surface-400 hover:text-white'}"
							onclick={() => selectPeriod(period)}
						>
							{period}
						</button>
					{/each}
				</div>
			</div>

			<!-- Return summary -->
			<div class="grid gap-4 sm:grid-cols-2">
				<Card>
					<p class="text-sm text-surface-400">{data.period} Return</p>
					<p class="mt-1 text-2xl font-bold {gainLossColor(data.performance.totalReturn)}">
						{fmt(data.performance.totalReturn)}
					</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">{data.period} Return %</p>
					<p class="mt-1 text-2xl font-bold {gainLossColor(data.performance.totalReturnPercent)}">
						{fmtPct(data.performance.totalReturnPercent)}
					</p>
				</Card>
			</div>

			<!-- Performance chart -->
			<Card>
				{#if hasPerfData}
					<LineChart
						labels={perfChartLabels}
						datasets={[
							{
								label: 'Portfolio Value',
								data: perfChartData,
								borderColor: data.performance.totalReturn >= 0 ? '#22c55e' : '#ef4444',
								fill: true,
								backgroundColor: data.performance.totalReturn >= 0 ? '#22c55e20' : '#ef444420'
							}
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
						<p class="mt-3 text-sm text-surface-400">
							Not enough price history for this period.
						</p>
						<p class="mt-1 text-xs text-surface-500">
							Data accumulates as prices are synced daily.
						</p>
					</div>
				{/if}
			</Card>
		{/if}

		<!-- Allocation tab -->
		{#if activeTab === 'allocation'}
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Donut chart -->
				<Card>
					<h3 class="text-lg font-semibold text-white">Asset Allocation</h3>
					{#if data.allocation.length > 0}
						<div class="mt-4 flex items-start gap-4">
							<div class="flex-1">
								<DonutChart
									labels={allocationLabels}
									data={allocationData}
									colors={allocationChartColors}
									height={220}
								/>
							</div>
							<div class="w-36 space-y-2 pt-4">
								{#each data.allocation as slice}
									<div class="flex items-center gap-2">
										<span
											class="h-2.5 w-2.5 rounded-full"
											style="background-color: {getAllocationColor(slice.type)}"
										></span>
										<span class="text-xs capitalize text-surface-300">{slice.type}</span>
										<span class="ml-auto text-xs font-medium text-white">
											{slice.percentage.toFixed(1)}%
										</span>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="mt-4 text-sm text-surface-500">No allocation data available</p>
					{/if}
				</Card>

				<!-- Allocation table -->
				<Card>
					<h3 class="text-lg font-semibold text-white">Allocation Breakdown</h3>
					<div class="mt-4 space-y-3">
						{#each data.allocation as slice}
							<div>
								<div class="flex items-center justify-between">
									<span class="text-sm capitalize text-surface-300">{slice.type}</span>
									<div class="text-right">
										<span class="text-sm font-medium text-white">{fmt(slice.value)}</span>
										<span class="ml-2 text-xs text-surface-400"
											>{slice.percentage.toFixed(1)}%</span
										>
									</div>
								</div>
								<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-700">
									<div
										class="h-full rounded-full transition-all"
										style="width: {Math.min(slice.percentage, 100)}%; background-color: {getAllocationColor(slice.type)}"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			</div>

			<!-- Rebalancing suggestions -->
			{#if data.rebalance.length > 0}
				<Card>
					<div class="mb-4 flex items-center gap-3">
						<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-600/20">
							<svg class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<div>
							<h3 class="text-lg font-semibold text-white">Rebalancing Suggestions</h3>
							<p class="text-xs text-surface-500">
								Shown when allocation drifts more than 5% from target
							</p>
						</div>
					</div>
					<div class="space-y-3">
						{#each data.rebalance as suggestion}
							<div
								class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-3"
							>
								<div>
									<p class="font-medium capitalize text-white">
										{suggestion.securityType}
									</p>
									<p class="text-xs text-surface-400">
										Current: {suggestion.currentPercent}% / Target: {suggestion.targetPercent}%
									</p>
								</div>
								<div class="text-right">
									<span
										class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
										{suggestion.action === 'buy'
											? 'bg-green-900/50 text-green-400'
											: 'bg-red-900/50 text-red-400'}"
									>
										{suggestion.action === 'buy' ? 'Buy' : 'Sell'}
									</span>
									<p class="mt-1 text-sm font-medium text-white">{fmt(suggestion.amount)}</p>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		{/if}
	{/if}
</div>
