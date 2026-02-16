<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let generating = $state(false);

	$effect(() => {
		if (form?.success) {
			generating = false;
			invalidateAll();
		}
		if (form?.error) {
			generating = false;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtCompact(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			notation: 'compact',
			maximumFractionDigits: 1
		}).format(amount);
	}

	function selectYear(year: number) {
		goto(`/year-review?year=${year}`, { invalidateAll: true });
	}

	const monthNames = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	const maxMonthlySpending = $derived(
		data.review?.monthlyBreakdown
			? Math.max(...data.review.monthlyBreakdown.map((m: any) => Math.max(m.income, m.spending)), 1)
			: 1
	);
</script>

<svelte:head>
	<title>Year in Review - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Year in Review</h2>
			<p class="mt-1 text-sm text-surface-400">
				Your financial summary for {data.selectedYear}
			</p>
		</div>
		<div class="flex items-center gap-3">
			<!-- Year selector -->
			<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
				{#each data.years as year}
					<button
						class="rounded-md px-3 py-1.5 text-sm font-medium transition
							{data.selectedYear === year
							? 'bg-primary-600 text-white'
							: 'text-surface-400 hover:text-white'}"
						onclick={() => selectYear(year)}
					>
						{year}
					</button>
				{/each}
			</div>

			<form
				method="POST"
				action="?/generate"
				use:enhance={() => {
					generating = true;
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<input type="hidden" name="year" value={data.selectedYear} />
				<Button type="submit" loading={generating}>Generate Review</Button>
			</form>
		</div>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	{#if data.review}
		<!-- Big stat cards -->
		<div class="grid gap-4 sm:grid-cols-3">
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-600/20">
						<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Income</p>
						<p class="text-2xl font-bold text-green-400">{fmt(data.review.totalIncome)}</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20">
						<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Spending</p>
						<p class="text-2xl font-bold text-red-400">{fmt(data.review.totalSpending)}</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-12 w-12 items-center justify-center rounded-lg {data.review.totalSaved >= 0 ? 'bg-primary-600/20' : 'bg-red-600/20'}">
						<svg class="h-6 w-6 {data.review.totalSaved >= 0 ? 'text-primary-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Net Saved</p>
						<p class="text-2xl font-bold {data.review.totalSaved >= 0 ? 'text-primary-400' : 'text-red-400'}">
							{fmt(data.review.totalSaved)}
						</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Highlights row -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<p class="text-sm text-surface-400">Top Category</p>
				<p class="mt-1 text-lg font-bold text-white">{data.review.topCategory ?? 'N/A'}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Top Merchant</p>
				<p class="mt-1 text-lg font-bold text-white">{data.review.topMerchant ?? 'N/A'}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Transactions</p>
				<p class="mt-1 text-lg font-bold text-white">
					{data.review.transactionCount.toLocaleString()}
				</p>
				<p class="text-xs text-surface-500">
					Avg: {fmt(data.review.averageTransaction)}
				</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Biggest Purchase</p>
				<p class="mt-1 text-lg font-bold text-white">{fmt(data.review.biggestPurchase)}</p>
				{#if data.review.biggestPurchaseDescription}
					<p class="text-xs text-surface-500">{data.review.biggestPurchaseDescription}</p>
				{/if}
			</Card>
		</div>

		<!-- Monthly Trend -->
		{#if data.review.monthlyBreakdown && data.review.monthlyBreakdown.length > 0}
			<Card>
				<h3 class="text-lg font-semibold text-white">Monthly Trend</h3>
				<div class="mt-4 space-y-2">
					{#each data.review.monthlyBreakdown as entry}
						{@const incomeWidth = (entry.income / maxMonthlySpending) * 100}
						{@const spendingWidth = (entry.spending / maxMonthlySpending) * 100}
						<div class="flex items-center gap-3">
							<span class="w-8 text-right text-xs text-surface-400">
								{monthNames[entry.month - 1]}
							</span>
							<div class="flex-1">
								<div class="flex gap-1">
									<div
										class="h-3 rounded bg-green-500/60"
										style="width: {incomeWidth}%"
										title="Income: {fmt(entry.income)}"
									></div>
								</div>
								<div class="mt-0.5 flex gap-1">
									<div
										class="h-3 rounded bg-red-500/60"
										style="width: {spendingWidth}%"
										title="Spending: {fmt(entry.spending)}"
									></div>
								</div>
							</div>
							<div class="w-24 text-right">
								<p class="text-xs text-green-400">{fmtCompact(entry.income)}</p>
								<p class="text-xs text-red-400">{fmtCompact(entry.spending)}</p>
							</div>
						</div>
					{/each}
				</div>
				<div class="mt-3 flex items-center justify-center gap-4">
					<div class="flex items-center gap-1.5">
						<span class="h-2.5 w-2.5 rounded bg-green-500/60"></span>
						<span class="text-xs text-surface-400">Income</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="h-2.5 w-2.5 rounded bg-red-500/60"></span>
						<span class="text-xs text-surface-400">Spending</span>
					</div>
				</div>
			</Card>
		{/if}

		<!-- Category Breakdown -->
		{#if data.review.categoryBreakdown && data.review.categoryBreakdown.length > 0}
			<Card>
				<h3 class="text-lg font-semibold text-white">Spending by Category</h3>
				<div class="mt-4 space-y-3">
					{#each data.review.categoryBreakdown.slice(0, 10) as cat}
						{@const catPercent = data.review.totalSpending > 0
							? (cat.amount / data.review.totalSpending) * 100
							: 0}
						<div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-surface-300">{cat.name}</span>
								<div class="text-right">
									<span class="text-sm font-medium text-white">{fmt(cat.amount)}</span>
									<span class="ml-2 text-xs text-surface-400">
										{catPercent.toFixed(1)}%
									</span>
								</div>
							</div>
							<div class="mt-1 h-2 overflow-hidden rounded-full bg-surface-700">
								<div
									class="h-full rounded-full bg-primary-500 transition-all"
									style="width: {catPercent}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Generation timestamp -->
		<p class="text-center text-xs text-surface-500">
			Generated: {new Date(data.review.generatedAt).toLocaleString()}
		</p>
	{:else}
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
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">
					No review for {data.selectedYear}
				</p>
				<p class="mt-1 text-sm text-surface-500">
					Generate a year-in-review to see your financial summary.
				</p>
			</div>
		</Card>
	{/if}
</div>
