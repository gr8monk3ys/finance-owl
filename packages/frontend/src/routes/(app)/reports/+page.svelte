<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$components/ui';
	import { BarChart, DonutChart, LineChart } from '$components/charts';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let activeTab = $state<'spending' | 'income-expense' | 'net-worth' | 'trends'>('spending');

	// Spending tab state
	let startDate = $state(
		(() => {
			const now = new Date();
			return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
		})()
	);
	let endDate = $state(new Date().toISOString().split('T')[0]);
	let groupBy = $state<string>('category');

	// CSV export state
	let exportType = $state<string>('transactions');

	// Date preset helpers
	function setPreset(preset: string) {
		const now = new Date();
		switch (preset) {
			case 'this-month':
				startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
				endDate = now.toISOString().split('T')[0];
				break;
			case 'last-month': {
				const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
				const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
				startDate = lastMonth.toISOString().split('T')[0];
				endDate = lastMonthEnd.toISOString().split('T')[0];
				break;
			}
			case 'last-3-months': {
				const threeAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
				startDate = threeAgo.toISOString().split('T')[0];
				endDate = now.toISOString().split('T')[0];
				break;
			}
			case 'last-6-months': {
				const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
				startDate = sixAgo.toISOString().split('T')[0];
				endDate = now.toISOString().split('T')[0];
				break;
			}
			case 'last-year': {
				const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
				startDate = yearAgo.toISOString().split('T')[0];
				endDate = now.toISOString().split('T')[0];
				break;
			}
			case 'ytd': {
				startDate = `${now.getFullYear()}-01-01`;
				endDate = now.toISOString().split('T')[0];
				break;
			}
		}
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	// Spending chart data
	const spendingLabels = $derived(data.spending.map((r: any) => r.group));
	const spendingData = $derived(data.spending.map((r: any) => r.total));
	const spendingColors = $derived(
		data.spending.map(
			(r: any, i: number) =>
				r.color ||
				[
					'#3b82f6',
					'#10b981',
					'#f59e0b',
					'#ef4444',
					'#8b5cf6',
					'#ec4899',
					'#06b6d4',
					'#84cc16',
					'#f97316',
					'#6366f1'
				][i % 10]
		)
	);
	const spendingTotal = $derived(spendingData.reduce((a: number, b: number) => a + b, 0));

	// Income vs Expense chart data
	const ieLabels = $derived(data.incomeExpense.map((r: any) => r.period));
	const ieIncomeData = $derived(data.incomeExpense.map((r: any) => r.income));
	const ieExpenseData = $derived(data.incomeExpense.map((r: any) => r.expenses));
	const ieTotalIncome = $derived(ieIncomeData.reduce((a: number, b: number) => a + b, 0));
	const ieTotalExpenses = $derived(ieExpenseData.reduce((a: number, b: number) => a + b, 0));
	const ieNet = $derived(ieTotalIncome - ieTotalExpenses);

	// Net Worth data
	const assetAccounts = $derived(
		(data.netWorth?.accounts ?? []).filter((a: any) =>
			['checking', 'savings', 'investment', 'other'].includes(a.type)
		)
	);
	const liabilityAccounts = $derived(
		(data.netWorth?.accounts ?? []).filter((a: any) =>
			['credit_card', 'loan', 'mortgage'].includes(a.type)
		)
	);

	// Trends data
	const trendLabels = $derived(data.trends.map((t: any) => t.month));
	const trendData = $derived(data.trends.map((t: any) => t.total));
	const trendTotal = $derived(trendData.reduce((a: number, b: number) => a + b, 0));
	const trendAvg = $derived(trendData.length > 0 ? trendTotal / trendData.length : 0);

	// Handle CSV download from form result
	$effect(() => {
		if (form?.csv) {
			const blob = new Blob([form.csv], { type: 'text/csv' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = form.filename || 'export.csv';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	});

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Reports - FinanceOwl</title>
	<style>
		@media print {
			body { background: white !important; color: black !important; }
			nav, header, [data-no-print] { display: none !important; }
			.print\:bg-white { background: white !important; }
			.print\:text-black { color: black !important; }
			.print\:border-gray-300 { border-color: #d1d5db !important; }
		}
	</style>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between" data-no-print>
		<div>
			<h2 class="text-2xl font-bold text-white">Reports</h2>
			<p class="mt-1 text-sm text-surface-400">Analyze your spending, income, and net worth</p>
		</div>
		<div class="flex gap-2">
			<Button variant="secondary" onclick={handlePrint}>
				<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
				</svg>
				Print
			</Button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1" data-no-print>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'spending'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'spending')}
		>
			Spending
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab ===
			'income-expense'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'income-expense')}
		>
			Income vs Expense
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'net-worth'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'net-worth')}
		>
			Net Worth
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'trends'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'trends')}
		>
			Trends
		</button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Spending Tab -->
	{#if activeTab === 'spending'}
		<Card>
			<div class="space-y-4">
				<h3 class="text-lg font-semibold text-white">Spending Breakdown</h3>

				<!-- Date presets -->
				<div class="flex flex-wrap gap-2" data-no-print>
					{#each [
						{ value: 'this-month', label: 'This Month' },
						{ value: 'last-month', label: 'Last Month' },
						{ value: 'last-3-months', label: 'Last 3 Months' },
						{ value: 'last-6-months', label: 'Last 6 Months' },
						{ value: 'last-year', label: 'Last Year' },
						{ value: 'ytd', label: 'Year to Date' }
					] as preset}
						<button
							class="rounded-lg border border-surface-700 px-3 py-1.5 text-xs font-medium text-surface-300 transition hover:border-primary-500 hover:text-primary-400"
							onclick={() => setPreset(preset.value)}
						>
							{preset.label}
						</button>
					{/each}
				</div>

				<!-- Filters -->
				<div class="grid gap-4 sm:grid-cols-3" data-no-print>
					<div>
						<label for="startDate" class="block text-sm font-medium text-surface-300"
							>Start Date</label
						>
						<input
							id="startDate"
							type="date"
							bind:value={startDate}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="endDate" class="block text-sm font-medium text-surface-300"
							>End Date</label
						>
						<input
							id="endDate"
							type="date"
							bind:value={endDate}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="groupBy" class="block text-sm font-medium text-surface-300"
							>Group By</label
						>
						<select
							id="groupBy"
							bind:value={groupBy}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="category">Category</option>
							<option value="merchant">Merchant</option>
							<option value="account">Account</option>
							<option value="day">Day</option>
							<option value="week">Week</option>
							<option value="month">Month</option>
						</select>
					</div>
				</div>

				<!-- Chart -->
				{#if data.spending.length > 0}
					<div class="grid gap-6 lg:grid-cols-2">
						<div>
							<DonutChart
								labels={spendingLabels}
								data={spendingData}
								colors={spendingColors}
								height={280}
							/>
						</div>
						<div>
							<p class="mb-3 text-sm font-medium text-surface-400">
								Total: {fmt(spendingTotal)}
							</p>
							<div class="space-y-2">
								{#each data.spending as item, i}
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span
												class="h-3 w-3 rounded-full"
												style="background-color: {spendingColors[i]}"
											></span>
											<span class="text-sm text-surface-300">{item.group}</span>
										</div>
										<div class="text-right">
											<span class="text-sm font-medium text-white">{fmt(item.total)}</span>
											<span class="ml-2 text-xs text-surface-500">
												({spendingTotal > 0
													? ((item.total / spendingTotal) * 100).toFixed(1)
													: '0'}%)
											</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Spending data table -->
					<div class="border-t border-surface-700 pt-4">
						<h4 class="mb-3 text-sm font-semibold text-white">Detailed Breakdown</h4>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-surface-700">
										<th class="px-4 py-2 text-left text-surface-400">Category</th>
										<th class="px-4 py-2 text-right text-surface-400">Transactions</th>
										<th class="px-4 py-2 text-right text-surface-400">Total Spent</th>
										<th class="px-4 py-2 text-right text-surface-400">% of Total</th>
										<th class="px-4 py-2 text-right text-surface-400">Avg/Transaction</th>
									</tr>
								</thead>
								<tbody>
									{#each data.spending as item}
										<tr class="border-b border-surface-700/50 hover:bg-surface-700/30 transition">
											<td class="px-4 py-2 font-medium text-white">{item.group}</td>
											<td class="px-4 py-2 text-right text-surface-300">{item.count}</td>
											<td class="px-4 py-2 text-right font-medium text-white">{fmt(item.total)}</td>
											<td class="px-4 py-2 text-right text-surface-300">
												{spendingTotal > 0 ? ((item.total / spendingTotal) * 100).toFixed(1) : '0'}%
											</td>
											<td class="px-4 py-2 text-right text-surface-300">
												{item.count > 0 ? fmt(item.total / item.count) : fmt(0)}
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="border-t border-surface-600 bg-surface-700/30">
										<td class="px-4 py-2 font-semibold text-white">Total</td>
										<td class="px-4 py-2 text-right font-semibold text-surface-300">
											{data.spending.reduce((a: number, b: any) => a + b.count, 0)}
										</td>
										<td class="px-4 py-2 text-right font-semibold text-white">{fmt(spendingTotal)}</td>
										<td class="px-4 py-2 text-right text-surface-300">100%</td>
										<td class="px-4 py-2 text-right text-surface-300">-</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</div>
				{:else}
					<p class="py-8 text-center text-surface-400">
						No spending data for the selected period.
					</p>
				{/if}

				<!-- Export -->
				<div class="border-t border-surface-700 pt-4" data-no-print>
					<form
						method="POST"
						action="?/export"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
							};
						}}
						class="flex flex-wrap items-end gap-3"
					>
						<div>
							<label for="exportType" class="block text-sm font-medium text-surface-300"
								>Export</label
							>
							<select
								id="exportType"
								name="type"
								bind:value={exportType}
								class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							>
								<option value="transactions">Transactions</option>
								<option value="budgets">Budgets</option>
								<option value="networth">Net Worth</option>
							</select>
						</div>
						<input type="hidden" name="startDate" value={startDate} />
						<input type="hidden" name="endDate" value={endDate} />
						<Button type="submit">
							<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export CSV
						</Button>
					</form>
				</div>
			</div>
		</Card>
	{/if}

	<!-- Income vs Expense Tab -->
	{#if activeTab === 'income-expense'}
		<div class="grid gap-4 sm:grid-cols-3">
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
						<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Income</p>
						<p class="text-xl font-bold text-green-400">{fmt(ieTotalIncome)}</p>
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
						<p class="text-sm text-surface-400">Total Expenses</p>
						<p class="text-xl font-bold text-red-400">{fmt(ieTotalExpenses)}</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg {ieNet >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}">
						<svg class="h-5 w-5 {ieNet >= 0 ? 'text-green-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Net</p>
						<p class="text-xl font-bold {ieNet >= 0 ? 'text-green-400' : 'text-red-400'}">{fmt(ieNet)}</p>
					</div>
				</div>
			</Card>
		</div>

		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Monthly Income vs Expenses</h3>
			{#if data.incomeExpense.length > 0}
				<BarChart
					labels={ieLabels}
					datasets={[
						{ label: 'Income', data: ieIncomeData, backgroundColor: '#10b981' },
						{ label: 'Expenses', data: ieExpenseData, backgroundColor: '#ef4444' }
					]}
					height={300}
				/>
			{:else}
				<p class="py-8 text-center text-surface-400">No data available.</p>
			{/if}
		</Card>

		<!-- Monthly breakdown table -->
		{#if data.incomeExpense.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Monthly Breakdown</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-surface-700">
								<th class="px-4 py-2 text-left text-surface-400">Period</th>
								<th class="px-4 py-2 text-right text-surface-400">Income</th>
								<th class="px-4 py-2 text-right text-surface-400">Expenses</th>
								<th class="px-4 py-2 text-right text-surface-400">Net</th>
								<th class="px-4 py-2 text-right text-surface-400">Savings Rate</th>
							</tr>
						</thead>
						<tbody>
							{#each data.incomeExpense as row}
								{@const savingsRate = row.income > 0 ? ((row.income - row.expenses) / row.income * 100) : 0}
								<tr class="border-b border-surface-700/50">
									<td class="px-4 py-2 text-surface-300">{row.period}</td>
									<td class="px-4 py-2 text-right text-green-400">{fmt(row.income)}</td>
									<td class="px-4 py-2 text-right text-red-400">{fmt(row.expenses)}</td>
									<td
										class="px-4 py-2 text-right font-medium {row.net >= 0
											? 'text-green-400'
											: 'text-red-400'}"
									>
										{fmt(row.net)}
									</td>
									<td class="px-4 py-2 text-right text-surface-300">
										{savingsRate.toFixed(1)}%
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr class="border-t border-surface-600 bg-surface-700/30">
								<td class="px-4 py-2 font-semibold text-white">Total</td>
								<td class="px-4 py-2 text-right font-semibold text-green-400">{fmt(ieTotalIncome)}</td>
								<td class="px-4 py-2 text-right font-semibold text-red-400">{fmt(ieTotalExpenses)}</td>
								<td class="px-4 py-2 text-right font-semibold {ieNet >= 0 ? 'text-green-400' : 'text-red-400'}">{fmt(ieNet)}</td>
								<td class="px-4 py-2 text-right font-semibold text-surface-300">
									{ieTotalIncome > 0 ? ((ieNet / ieTotalIncome) * 100).toFixed(1) : '0'}%
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Net Worth Tab -->
	{#if activeTab === 'net-worth'}
		<div class="grid gap-4 sm:grid-cols-3">
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
						<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Assets</p>
						<p class="text-xl font-bold text-green-400">
							{fmt(data.netWorth?.totalAssets ?? 0)}
						</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20">
						<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Liabilities</p>
						<p class="text-xl font-bold text-red-400">
							{fmt(data.netWorth?.totalLiabilities ?? 0)}
						</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg {(data.netWorth?.netWorth ?? 0) >= 0 ? 'bg-green-600/20' : 'bg-red-600/20'}">
						<svg class="h-5 w-5 {(data.netWorth?.netWorth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Net Worth</p>
						<p
							class="text-xl font-bold {(data.netWorth?.netWorth ?? 0) >= 0
								? 'text-green-400'
								: 'text-red-400'}"
						>
							{fmt(data.netWorth?.netWorth ?? 0)}
						</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Net Worth visual breakdown -->
		{#if assetAccounts.length > 0 || liabilityAccounts.length > 0}
			{@const totalAssets = data.netWorth?.totalAssets ?? 0}
			{@const totalLiabilities = data.netWorth?.totalLiabilities ?? 0}
			{@const maxBar = Math.max(totalAssets, totalLiabilities) || 1}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Net Worth Composition</h3>
				<div class="space-y-2">
					<div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="text-surface-300">Assets</span>
							<span class="font-medium text-green-400">{fmt(totalAssets)}</span>
						</div>
						<div class="h-4 overflow-hidden rounded-full bg-surface-700">
							<div class="h-full rounded-full bg-green-500 transition-all" style="width: {(totalAssets / maxBar) * 100}%"></div>
						</div>
					</div>
					<div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="text-surface-300">Liabilities</span>
							<span class="font-medium text-red-400">{fmt(totalLiabilities)}</span>
						</div>
						<div class="h-4 overflow-hidden rounded-full bg-surface-700">
							<div class="h-full rounded-full bg-red-500 transition-all" style="width: {(totalLiabilities / maxBar) * 100}%"></div>
						</div>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Assets -->
		{#if assetAccounts.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Assets</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-surface-700">
								<th class="px-4 py-2 text-left text-surface-400">Account</th>
								<th class="px-4 py-2 text-left text-surface-400">Type</th>
								<th class="px-4 py-2 text-left text-surface-400">Institution</th>
								<th class="px-4 py-2 text-right text-surface-400">Balance</th>
							</tr>
						</thead>
						<tbody>
							{#each assetAccounts as account}
								<tr class="border-b border-surface-700/50">
									<td class="px-4 py-2 font-medium text-white">{account.name}</td>
									<td class="px-4 py-2 capitalize text-surface-300">{account.type}</td>
									<td class="px-4 py-2 text-surface-300">
										{account.institutionName || '-'}
									</td>
									<td class="px-4 py-2 text-right text-green-400">
										{fmt(account.balance)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}

		<!-- Liabilities -->
		{#if liabilityAccounts.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Liabilities</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-surface-700">
								<th class="px-4 py-2 text-left text-surface-400">Account</th>
								<th class="px-4 py-2 text-left text-surface-400">Type</th>
								<th class="px-4 py-2 text-left text-surface-400">Institution</th>
								<th class="px-4 py-2 text-right text-surface-400">Balance</th>
							</tr>
						</thead>
						<tbody>
							{#each liabilityAccounts as account}
								<tr class="border-b border-surface-700/50">
									<td class="px-4 py-2 font-medium text-white">{account.name}</td>
									<td class="px-4 py-2 capitalize text-surface-300"
										>{account.type.replace('_', ' ')}</td
									>
									<td class="px-4 py-2 text-surface-300">
										{account.institutionName || '-'}
									</td>
									<td class="px-4 py-2 text-right text-red-400">
										{fmt(Math.abs(account.balance))}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}

		{#if assetAccounts.length === 0 && liabilityAccounts.length === 0}
			<Card>
				<p class="py-8 text-center text-surface-400">No accounts found. Link your accounts to see your net worth.</p>
			</Card>
		{/if}
	{/if}

	<!-- Trends Tab -->
	{#if activeTab === 'trends'}
		<div class="grid gap-4 sm:grid-cols-3">
			<Card>
				<p class="text-sm text-surface-400">6-Month Total Spending</p>
				<p class="mt-1 text-xl font-bold text-white">{fmt(trendTotal)}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Monthly Average</p>
				<p class="mt-1 text-xl font-bold text-surface-300">{fmt(trendAvg)}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Months Tracked</p>
				<p class="mt-1 text-xl font-bold text-white">{trendData.length}</p>
			</Card>
		</div>

		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Spending Trends (Last 6 Months)</h3>
			{#if data.trends.length > 0}
				<LineChart
					labels={trendLabels}
					datasets={[
						{
							label: 'Monthly Spending',
							data: trendData,
							borderColor: '#f59e0b',
							fill: true,
							backgroundColor: '#f59e0b20'
						}
					]}
					height={300}
				/>
			{:else}
				<p class="py-8 text-center text-surface-400">No trend data available yet.</p>
			{/if}
		</Card>

		{#if data.trends.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Monthly Spending Detail</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-surface-700">
								<th class="px-4 py-2 text-left text-surface-400">Month</th>
								<th class="px-4 py-2 text-right text-surface-400">Total Spent</th>
								<th class="px-4 py-2 text-right text-surface-400">vs Average</th>
								<th class="px-4 py-2 text-left text-surface-400">Trend</th>
							</tr>
						</thead>
						<tbody>
							{#each data.trends as trend}
								{@const diff = trend.total - trendAvg}
								{@const pct = trendAvg > 0 ? (diff / trendAvg) * 100 : 0}
								<tr class="border-b border-surface-700/50">
									<td class="px-4 py-2 text-surface-300">{trend.month}</td>
									<td class="px-4 py-2 text-right font-medium text-white">{fmt(trend.total)}</td>
									<td class="px-4 py-2 text-right {diff >= 0 ? 'text-red-400' : 'text-green-400'}">
										{diff >= 0 ? '+' : ''}{fmt(diff)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
									</td>
									<td class="px-4 py-2">
										<div class="h-2 w-full max-w-[120px] overflow-hidden rounded-full bg-surface-700">
											<div
												class="h-full rounded-full transition-all {trend.total > trendAvg ? 'bg-red-500' : 'bg-green-500'}"
												style="width: {Math.min((trend.total / (trendAvg * 2)) * 100, 100)}%"
											></div>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		{/if}
	{/if}
</div>
