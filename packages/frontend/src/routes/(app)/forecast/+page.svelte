<script lang="ts">
	import { goto } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import { LineChart, BarChart } from '$components/charts';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function changePeriod(months: number) {
		goto(`/forecast?months=${months}`, { invalidateAll: true });
	}

	// Chart data
	const displayedMonths = $derived(data.forecast.months);
	const chartLabels = $derived(displayedMonths.map((m: any) => m.month));
	const chartBalances = $derived(displayedMonths.map((m: any) => m.projectedBalance));
	const chartIncome = $derived(displayedMonths.map((m: any) => m.projectedIncome));
	const chartExpenses = $derived(displayedMonths.map((m: any) => m.projectedExpenses));

	// Confidence bands: optimistic (+15%) and pessimistic (-15%) scenarios
	const confidenceUpper = $derived(
		displayedMonths.map((m: any, i: number) => {
			const base = data.forecast.currentBalance;
			const monthlyNet = m.projectedIncome - m.projectedExpenses;
			const optimisticNet = monthlyNet * 1.15;
			return base + optimisticNet * (i + 1);
		})
	);
	const confidenceLower = $derived(
		displayedMonths.map((m: any, i: number) => {
			const base = data.forecast.currentBalance;
			const monthlyNet = m.projectedIncome - m.projectedExpenses;
			const pessimisticNet = monthlyNet * 0.85;
			return base + pessimisticNet * (i + 1);
		})
	);

	// Balance trend direction
	const balanceTrend = $derived(() => {
		if (displayedMonths.length < 2) return 'neutral';
		const first = displayedMonths[0]?.projectedBalance ?? 0;
		const last = displayedMonths[displayedMonths.length - 1]?.projectedBalance ?? 0;
		return last >= first ? 'positive' : 'negative';
	});

	// Net amounts
	const projectedNetPerMonth = $derived(data.cashFlow.netMonthlyCashFlow);
	const projectedEndBalance = $derived(
		displayedMonths.length > 0
			? displayedMonths[displayedMonths.length - 1]?.projectedBalance ?? 0
			: data.forecast.currentBalance
	);
	const projectedChange = $derived(projectedEndBalance - data.forecast.currentBalance);

	// Total income and expense item counts
	const incomeCount = $derived(data.cashFlow.incomeItems.length);
	const expenseCount = $derived(data.cashFlow.expenseItems.length);
</script>

<svelte:head>
	<title>Forecast - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Cash Flow Forecast</h2>
			<p class="mt-1 text-sm text-surface-400">Project your finances forward based on recurring patterns</p>
		</div>
		<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
			{#each [3, 6, 12] as months}
				<button
					class="rounded-md px-3 py-1.5 text-sm font-medium transition {data.months ===
					months
						? 'bg-primary-600 text-white'
						: 'text-surface-400 hover:text-white'}"
					onclick={() => changePeriod(months)}
				>
					{months}mo
				</button>
			{/each}
		</div>
	</div>

	<!-- Summary cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
					<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Current Balance</p>
					<p class="text-xl font-bold text-white">{fmt(data.forecast.currentBalance)}</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
					<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Monthly Income</p>
					<p class="text-xl font-bold text-green-400">{fmt(data.cashFlow.monthlyRecurringIncome)}</p>
					<p class="text-xs text-surface-500">{incomeCount} recurring source{incomeCount !== 1 ? 's' : ''}</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20">
					<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Monthly Expenses</p>
					<p class="text-xl font-bold text-red-400">{fmt(data.cashFlow.monthlyRecurringExpenses)}</p>
					<p class="text-xs text-surface-500">{expenseCount} recurring expense{expenseCount !== 1 ? 's' : ''}</p>
				</div>
			</div>
		</Card>
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg {projectedChange >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}">
					<svg class="h-5 w-5 {projectedChange >= 0 ? 'text-green-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Projected in {data.months}mo</p>
					<p class="text-xl font-bold {projectedEndBalance >= 0 ? 'text-white' : 'text-red-400'}">{fmt(projectedEndBalance)}</p>
					<p class="text-xs {projectedChange >= 0 ? 'text-green-400' : 'text-red-400'}">
						{projectedChange >= 0 ? '+' : ''}{fmt(projectedChange)}
					</p>
				</div>
			</div>
		</Card>
	</div>

	<!-- Net cash flow callout -->
	<Card>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-full {data.cashFlow.netMonthlyCashFlow >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}">
					<svg class="h-6 w-6 {data.cashFlow.netMonthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						{#if data.cashFlow.netMonthlyCashFlow >= 0}
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						{/if}
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Net Monthly Cash Flow</p>
					<p
						class="text-2xl font-bold {data.cashFlow.netMonthlyCashFlow >= 0
							? 'text-green-400'
							: 'text-red-400'}"
					>
						{fmt(data.cashFlow.netMonthlyCashFlow)}
					</p>
				</div>
			</div>
			<div class="text-right">
				<p class="text-sm font-medium {data.cashFlow.netMonthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}">
					{data.cashFlow.netMonthlyCashFlow >= 0 ? 'Monthly Surplus' : 'Monthly Deficit'}
				</p>
				<p class="text-xs text-surface-500">
					{fmt(Math.abs(data.cashFlow.netMonthlyCashFlow * 12))}/year projected
				</p>
			</div>
		</div>
	</Card>

	<!-- Projected Balance Chart with Confidence Bands -->
	<Card>
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="text-lg font-semibold text-white">Projected Balance</h3>
				<p class="text-xs text-surface-500">Shaded areas show optimistic/pessimistic scenarios (+-15%)</p>
			</div>
			{#if balanceTrend() === 'positive'}
				<span class="inline-flex items-center rounded-full bg-green-900/50 px-2.5 py-0.5 text-xs font-medium text-green-400">
					Upward trend
				</span>
			{:else if balanceTrend() === 'negative'}
				<span class="inline-flex items-center rounded-full bg-red-900/50 px-2.5 py-0.5 text-xs font-medium text-red-400">
					Downward trend
				</span>
			{/if}
		</div>
		{#if displayedMonths.length > 0}
			<LineChart
				labels={chartLabels}
				datasets={[
					{
						label: 'Optimistic (+15%)',
						data: confidenceUpper,
						borderColor: '#22c55e40',
						fill: false,
						backgroundColor: '#22c55e10'
					},
					{
						label: 'Projected Balance',
						data: chartBalances,
						borderColor: '#3b82f6',
						fill: true,
						backgroundColor: '#3b82f620'
					},
					{
						label: 'Pessimistic (-15%)',
						data: confidenceLower,
						borderColor: '#ef444440',
						fill: false,
						backgroundColor: '#ef444410'
					}
				]}
				height={320}
			/>
		{:else}
			<p class="py-8 text-center text-surface-400">
				No forecast data available. Add recurring transactions to generate projections.
			</p>
		{/if}
	</Card>

	<!-- Income vs Expenses Projection -->
	{#if displayedMonths.length > 0}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Monthly Income vs Expenses</h3>
			<BarChart
				labels={chartLabels}
				datasets={[
					{ label: 'Income', data: chartIncome, backgroundColor: '#10b981' },
					{ label: 'Expenses', data: chartExpenses, backgroundColor: '#ef4444' }
				]}
				height={250}
			/>
		</Card>
	{/if}

	<!-- Month-by-month breakdown table -->
	{#if displayedMonths.length > 0}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Monthly Breakdown</h3>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-surface-700">
							<th class="px-4 py-2 text-left text-surface-400">Month</th>
							<th class="px-4 py-2 text-right text-surface-400">Projected Income</th>
							<th class="px-4 py-2 text-right text-surface-400">Projected Expenses</th>
							<th class="px-4 py-2 text-right text-surface-400">Net</th>
							<th class="px-4 py-2 text-right text-surface-400">Projected Balance</th>
						</tr>
					</thead>
					<tbody>
						<!-- Current balance row -->
						<tr class="border-b border-surface-700/50 bg-surface-800/50">
							<td class="px-4 py-2 font-medium text-surface-300">Current</td>
							<td class="px-4 py-2 text-right text-surface-500">-</td>
							<td class="px-4 py-2 text-right text-surface-500">-</td>
							<td class="px-4 py-2 text-right text-surface-500">-</td>
							<td class="px-4 py-2 text-right font-medium text-white">
								{fmt(data.forecast.currentBalance)}
							</td>
						</tr>
						{#each displayedMonths as month}
							{@const net = month.projectedIncome - month.projectedExpenses}
							<tr class="border-b border-surface-700/50 hover:bg-surface-700/30 transition">
								<td class="px-4 py-2 font-medium text-surface-300">{month.month}</td>
								<td class="px-4 py-2 text-right text-green-400">
									{fmt(month.projectedIncome)}
								</td>
								<td class="px-4 py-2 text-right text-red-400">
									{fmt(month.projectedExpenses)}
								</td>
								<td class="px-4 py-2 text-right font-medium {net >= 0 ? 'text-green-400' : 'text-red-400'}">
									{fmt(net)}
								</td>
								<td
									class="px-4 py-2 text-right font-medium {month.projectedBalance >= 0
										? 'text-white'
										: 'text-red-400'}"
								>
									{fmt(month.projectedBalance)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}

	<!-- Recurring Cash Flow Details -->
	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Income Items -->
		<Card>
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600/20">
					<svg class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-white">Recurring Income</h3>
			</div>
			{#if data.cashFlow.incomeItems.length > 0}
				<div class="space-y-3">
					{#each data.cashFlow.incomeItems as item}
						<div class="flex items-center justify-between rounded-lg bg-surface-700/30 px-4 py-3">
							<div>
								<p class="text-sm font-medium text-white">{item.name}</p>
								<p class="text-xs capitalize text-surface-500">
									{item.frequency} - {fmt(item.amount)}/occurrence
								</p>
							</div>
							<p class="text-sm font-medium text-green-400">{fmt(item.monthlyAmount)}/mo</p>
						</div>
					{/each}
				</div>
				<div class="mt-4 border-t border-surface-700 pt-3">
					<div class="flex justify-between text-sm">
						<span class="font-medium text-surface-300">Total Monthly Income</span>
						<span class="font-bold text-green-400">{fmt(data.cashFlow.monthlyRecurringIncome)}</span>
					</div>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-surface-400">No recurring income found.</p>
			{/if}
		</Card>

		<!-- Expense Items -->
		<Card>
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20">
					<svg class="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-white">Recurring Expenses</h3>
			</div>
			{#if data.cashFlow.expenseItems.length > 0}
				<div class="space-y-3">
					{#each data.cashFlow.expenseItems as item}
						<div class="flex items-center justify-between rounded-lg bg-surface-700/30 px-4 py-3">
							<div>
								<p class="text-sm font-medium text-white">{item.name}</p>
								<p class="text-xs capitalize text-surface-500">
									{item.frequency} - {fmt(item.amount)}/occurrence
								</p>
							</div>
							<p class="text-sm font-medium text-red-400">{fmt(item.monthlyAmount)}/mo</p>
						</div>
					{/each}
				</div>
				<div class="mt-4 border-t border-surface-700 pt-3">
					<div class="flex justify-between text-sm">
						<span class="font-medium text-surface-300">Total Monthly Expenses</span>
						<span class="font-bold text-red-400">{fmt(data.cashFlow.monthlyRecurringExpenses)}</span>
					</div>
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-surface-400">
					No recurring expenses found.
				</p>
			{/if}
		</Card>
	</div>

	<!-- Key Assumptions -->
	<Card>
		<div class="mb-4 flex items-center gap-3">
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-700">
				<svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div>
				<h3 class="text-lg font-semibold text-white">Key Assumptions</h3>
				<p class="text-xs text-surface-500">Understand the basis for this forecast</p>
			</div>
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-3">
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">1</span>
					<div>
						<p class="text-sm font-medium text-surface-300">Recurring patterns are stable</p>
						<p class="text-xs text-surface-500">Income and expenses repeat at the same amounts and frequencies each period.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">2</span>
					<div>
						<p class="text-sm font-medium text-surface-300">No one-time large transactions</p>
						<p class="text-xs text-surface-500">The forecast does not account for irregular large purchases, bonuses, or windfalls.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">3</span>
					<div>
						<p class="text-sm font-medium text-surface-300">Budget targets used for gaps</p>
						<p class="text-xs text-surface-500">Where recurring transactions do not cover a category, budget amounts are used as expense estimates.</p>
					</div>
				</div>
			</div>
			<div class="space-y-3">
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">4</span>
					<div>
						<p class="text-sm font-medium text-surface-300">Confidence bands at +-15%</p>
						<p class="text-xs text-surface-500">The optimistic and pessimistic scenarios assume a 15% variance from projected net cash flow.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">5</span>
					<div>
						<p class="text-sm font-medium text-surface-300">No interest or investment returns</p>
						<p class="text-xs text-surface-500">Savings and investment growth are not factored into balance projections.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-medium text-surface-300">6</span>
					<div>
						<p class="text-sm font-medium text-surface-300">Based on {incomeCount + expenseCount} recurring items</p>
						<p class="text-xs text-surface-500">{incomeCount} income source{incomeCount !== 1 ? 's' : ''} and {expenseCount} expense{expenseCount !== 1 ? 's' : ''} are used in this projection.</p>
					</div>
				</div>
			</div>
		</div>
	</Card>
</div>
