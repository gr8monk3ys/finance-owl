<script lang="ts">
	import { Card } from '$components/ui';
	import { BarChart } from '$components/charts';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// ---------- Formatters ----------

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtPct(ratio: number): string {
		return `${(ratio * 100).toFixed(2)}%`;
	}

	function fmtBps(ratio: number): string {
		return `${(ratio * 10000).toFixed(1)} bps`;
	}

	// ---------- Expense ratio color coding ----------

	function erColor(ratio: number): string {
		if (ratio <= 0.001) return 'text-green-400';
		if (ratio <= 0.005) return 'text-yellow-400';
		return 'text-red-400';
	}

	function erBgColor(ratio: number): string {
		if (ratio <= 0.001) return 'bg-green-600/20';
		if (ratio <= 0.005) return 'bg-yellow-600/20';
		return 'bg-red-600/20';
	}

	function erBadgeColor(ratio: number): string {
		if (ratio <= 0.001) return 'bg-green-900/50 text-green-400';
		if (ratio <= 0.005) return 'bg-yellow-900/50 text-yellow-400';
		return 'bg-red-900/50 text-red-400';
	}

	// ---------- Fee score ----------

	function scoreColor(score: string): string {
		switch (score) {
			case 'A':
				return 'text-green-400';
			case 'B':
				return 'text-green-300';
			case 'C':
				return 'text-yellow-400';
			case 'D':
				return 'text-orange-400';
			case 'F':
				return 'text-red-400';
			default:
				return 'text-surface-400';
		}
	}

	function scoreBgColor(score: string): string {
		switch (score) {
			case 'A':
				return 'bg-green-600/20 border-green-500/30';
			case 'B':
				return 'bg-green-600/10 border-green-500/20';
			case 'C':
				return 'bg-yellow-600/20 border-yellow-500/30';
			case 'D':
				return 'bg-orange-600/20 border-orange-500/30';
			case 'F':
				return 'bg-red-600/20 border-red-500/30';
			default:
				return 'bg-surface-700 border-surface-600';
		}
	}

	// ---------- Lifetime impact chart data ----------

	const impactLabels = $derived(['10 Years', '20 Years', '30 Years']);
	const impactCurrentFees = $derived([
		data.impact10.projectedWithCurrentFees,
		data.impact20.projectedWithCurrentFees,
		data.impact30.projectedWithCurrentFees
	]);
	const impactLowCostFees = $derived([
		data.impact10.projectedWithLowCostFees,
		data.impact20.projectedWithLowCostFees,
		data.impact30.projectedWithLowCostFees
	]);

	const hasData = $derived(data.summary.holdingCount > 0);

	// Total potential annual savings from switching
	const totalPotentialSavings = $derived(
		data.alternatives.reduce((sum: number, alt: any) => sum + alt.annualSavings, 0)
	);
</script>

<svelte:head>
	<title>Fee Analyzer - Finance Owl</title>
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
			<h2 class="text-2xl font-bold text-white">Investment Fee Analyzer</h2>
			<p class="mt-1 text-sm text-surface-400">
				Understand how fees impact your returns and find ways to save
			</p>
		</div>
	</div>

	{#if !hasData}
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
						d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No investment holdings to analyze</p>
				<p class="mt-1 text-sm text-surface-500">
					<a href="/accounts" class="text-primary-400 hover:text-primary-300"
						>Link an investment account</a
					> to start analyzing your fees.
				</p>
			</div>
		</Card>
	{:else}
		<!-- Top summary cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Fee Score -->
			<Card>
				<div class="flex items-center gap-3">
					<div
						class="flex h-14 w-14 items-center justify-center rounded-xl border {scoreBgColor(
							data.summary.feeScore
						)}"
					>
						<span class="text-2xl font-black {scoreColor(data.summary.feeScore)}">
							{data.summary.feeScore}
						</span>
					</div>
					<div>
						<p class="text-sm text-surface-400">Fee Score</p>
						<p class="text-lg font-semibold text-white">Portfolio Grade</p>
					</div>
				</div>
			</Card>

			<!-- Total Annual Fees -->
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20">
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
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Annual Fees</p>
						<p class="text-2xl font-bold text-red-400">
							{fmt(data.summary.totalAnnualFees)}
						</p>
					</div>
				</div>
			</Card>

			<!-- Weighted Expense Ratio -->
			<Card>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg {erBgColor(
							data.summary.weightedExpenseRatio
						)}"
					>
						<svg
							class="h-5 w-5 {erColor(data.summary.weightedExpenseRatio)}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Weighted Expense Ratio</p>
						<p class="text-2xl font-bold {erColor(data.summary.weightedExpenseRatio)}">
							{fmtPct(data.summary.weightedExpenseRatio)}
						</p>
						<p class="text-xs text-surface-500">
							{fmtBps(data.summary.weightedExpenseRatio)}
						</p>
					</div>
				</div>
			</Card>

			<!-- High Fee Holdings -->
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
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">High-Fee Holdings</p>
						<p class="text-2xl font-bold text-white">
							{data.summary.highFeeCount}
							<span class="text-base font-normal text-surface-500"
								>/ {data.summary.holdingCount}</span
							>
						</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Fee Score Description -->
		<Card>
			<div class="flex items-start gap-4">
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border {scoreBgColor(
						data.summary.feeScore
					)}"
				>
					<span class="text-xl font-black {scoreColor(data.summary.feeScore)}">
						{data.summary.feeScore}
					</span>
				</div>
				<div>
					<h3 class="text-lg font-semibold text-white">Your Fee Assessment</h3>
					<p class="mt-1 text-sm text-surface-300">{data.summary.feeScoreDescription}</p>
					<div class="mt-3 flex gap-4 text-xs text-surface-500">
						<span
							>Portfolio: <span class="text-surface-300"
								>{fmt(data.summary.totalPortfolioValue)}</span
							></span
						>
						<span
							>Annual cost: <span class="text-red-400"
								>{fmt(data.summary.totalAnnualFees)}</span
							></span
						>
						<span
							>Daily cost: <span class="text-surface-300"
								>{fmt(data.summary.totalAnnualFees / 365)}</span
							></span
						>
					</div>
				</div>
			</div>
		</Card>

		<!-- Holdings table sorted by expense ratio -->
		<Card padding="none">
			<div class="border-b border-surface-700 px-6 py-4">
				<h3 class="text-lg font-semibold text-white">Holdings by Expense Ratio</h3>
				<p class="mt-1 text-xs text-surface-500">
					Sorted highest to lowest. Color indicates relative cost.
				</p>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-surface-700 text-xs text-surface-400">
							<th class="px-6 py-3 text-left">Symbol / Name</th>
							<th class="px-4 py-3 text-left">Type</th>
							<th class="px-4 py-3 text-right">Value</th>
							<th class="px-4 py-3 text-right">Expense Ratio</th>
							<th class="px-4 py-3 text-right">Annual Fee</th>
							<th class="px-4 py-3 text-right">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-surface-700/50">
						{#each data.fees.holdings as holding}
							<tr class="transition hover:bg-surface-700/30">
								<td class="px-6 py-3">
									<p class="font-medium text-white">
										{holding.tickerSymbol || '--'}
									</p>
									<p class="text-xs text-surface-500">{holding.securityName}</p>
								</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex rounded-full bg-surface-700 px-2 py-0.5 text-xs capitalize text-surface-300"
									>
										{holding.securityType || 'other'}
									</span>
								</td>
								<td class="px-4 py-3 text-right text-surface-300">
									{fmt(holding.currentValue)}
								</td>
								<td class="px-4 py-3 text-right font-medium {erColor(holding.expenseRatio)}">
									{fmtPct(holding.expenseRatio)}
								</td>
								<td class="px-4 py-3 text-right text-surface-300">
									{fmt(holding.annualFee)}
								</td>
								<td class="px-4 py-3 text-right">
									<span
										class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {erBadgeColor(
											holding.expenseRatio
										)}"
									>
										{#if holding.expenseRatio <= 0.001}
											Low
										{:else if holding.expenseRatio <= 0.005}
											Medium
										{:else}
											High
										{/if}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="border-t border-surface-600 bg-surface-700/30">
							<td class="px-6 py-3 font-semibold text-white" colspan="3">
								Weighted Average
							</td>
							<td
								class="px-4 py-3 text-right font-semibold {erColor(
									data.fees.weightedExpenseRatio
								)}"
							>
								{fmtPct(data.fees.weightedExpenseRatio)}
							</td>
							<td class="px-4 py-3 text-right font-semibold text-red-400">
								{fmt(data.fees.totalAnnualFees)}
							</td>
							<td class="px-4 py-3"></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</Card>

		<!-- Lifetime Fee Impact -->
		<Card>
			<h3 class="mb-2 text-lg font-semibold text-white">Lifetime Fee Impact</h3>
			<p class="mb-4 text-xs text-surface-500">
				Projected portfolio growth assuming 7% annual returns. Shows the compounding cost of fees
				over time.
			</p>

			<!-- Impact comparison chart -->
			{#if data.impact30.currentPortfolioValue > 0}
				<BarChart
					labels={impactLabels}
					datasets={[
						{
							label: 'With Current Fees',
							data: impactCurrentFees,
							backgroundColor: '#ef4444'
						},
						{
							label: 'With Low-Cost Funds (0.03%)',
							data: impactLowCostFees,
							backgroundColor: '#22c55e'
						}
					]}
					height={280}
				/>

				<!-- Impact numbers -->
				<div class="mt-6 grid gap-4 sm:grid-cols-3">
					<div class="rounded-lg bg-surface-700/50 p-4 text-center">
						<p class="text-xs text-surface-400">10-Year Savings</p>
						<p class="mt-1 text-xl font-bold text-green-400">
							{fmt(data.impact10.lifetimeSavings)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-700/50 p-4 text-center">
						<p class="text-xs text-surface-400">20-Year Savings</p>
						<p class="mt-1 text-xl font-bold text-green-400">
							{fmt(data.impact20.lifetimeSavings)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-700/50 p-4 text-center">
						<p class="text-xs text-surface-400">30-Year Savings</p>
						<p class="mt-1 text-2xl font-bold text-green-400">
							{fmt(data.impact30.lifetimeSavings)}
						</p>
					</div>
				</div>

				<div class="mt-4 rounded-lg border border-surface-700 bg-surface-800/50 p-4">
					<div class="flex items-start gap-3">
						<svg
							class="mt-0.5 h-5 w-5 shrink-0 text-yellow-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p class="text-sm text-surface-300">
							By switching to low-cost index funds, your <strong class="text-white"
								>{fmt(data.impact30.currentPortfolioValue)}</strong
							>
							portfolio could grow to
							<strong class="text-green-400"
								>{fmt(data.impact30.projectedWithLowCostFees)}</strong
							>
							instead of
							<strong class="text-red-400"
								>{fmt(data.impact30.projectedWithCurrentFees)}</strong
							>
							over 30 years -- a difference of
							<strong class="text-green-400">{fmt(data.impact30.lifetimeSavings)}</strong
							>.
						</p>
					</div>
				</div>
			{/if}
		</Card>

		<!-- Switch & Save Section -->
		{#if data.alternatives.length > 0}
			<Card padding="none">
				<div class="border-b border-surface-700 px-6 py-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="text-lg font-semibold text-white">Switch & Save</h3>
							<p class="mt-1 text-xs text-surface-500">
								Lower-cost alternatives for your current holdings
							</p>
						</div>
						<div class="text-right">
							<p class="text-xs text-surface-400">Total potential savings</p>
							<p class="text-lg font-bold text-green-400">
								{fmt(totalPotentialSavings)}<span class="text-sm text-surface-500"
									>/yr</span
								>
							</p>
						</div>
					</div>
				</div>

				<div class="divide-y divide-surface-700/50">
					{#each data.alternatives as alt}
						<div class="px-6 py-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4">
									<!-- Current holding -->
									<div class="min-w-[120px]">
										<p class="text-sm font-medium text-white">{alt.currentHolding}</p>
										<p class="text-xs text-red-400">
											ER: {fmtPct(alt.currentExpenseRatio)}
										</p>
									</div>

									<!-- Arrow -->
									<svg
										class="h-5 w-5 shrink-0 text-surface-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13 7l5 5m0 0l-5 5m5-5H6"
										/>
									</svg>

									<!-- Suggested alternative -->
									<div class="min-w-[120px]">
										<p class="text-sm font-medium text-green-400">
											{alt.suggestedSymbol}
										</p>
										<p class="text-xs text-surface-500">{alt.suggestedName}</p>
										<p class="text-xs text-green-400/70">
											ER: {fmtPct(alt.suggestedExpenseRatio)}
										</p>
									</div>
								</div>

								<!-- Annual savings -->
								<div class="text-right">
									<p class="text-sm font-bold text-green-400">
										Save {fmt(alt.annualSavings)}
									</p>
									<p class="text-xs text-surface-500">per year</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Fees by Category -->
		{#if data.fees.feesByCategory.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Fees by Category</h3>
				<div class="space-y-3">
					{#each data.fees.feesByCategory as cat}
						<div
							class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-3"
						>
							<div>
								<p class="font-medium text-white">{cat.category}</p>
								<p class="text-xs text-surface-400">
									Avg ER: <span class={erColor(cat.avgExpenseRatio)}
										>{fmtPct(cat.avgExpenseRatio)}</span
									>
								</p>
							</div>
							<div class="text-right">
								<p class="text-sm font-medium text-red-400">{fmt(cat.totalFees)}</p>
								<p class="text-xs text-surface-500">per year</p>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
	{/if}
</div>
