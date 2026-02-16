<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Spinner } from '$components/ui';
	import { BarChart } from '$components/charts';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let activeTab = $state<'suggestions' | 'insights' | 'predictions' | 'patterns'>('suggestions');
	let sensitivity = $state<'conservative' | 'moderate' | 'aggressive'>('moderate');
	let isAutoAdjusting = $state(false);
	let acceptedCategories = $state<Set<string>>(new Set());
	let showAutoAdjustModal = $state(false);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			if (form.accepted) {
				acceptedCategories = new Set([...acceptedCategories, form.accepted]);
			}
			if (form.adjustments) {
				showAutoAdjustModal = false;
				isAutoAdjusting = false;
			}
		}
		if (form?.error) {
			isAutoAdjusting = false;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	function fmtPercent(value: number): string {
		return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
	}

	function getConfidenceColor(confidence: string | number): string {
		if (typeof confidence === 'string') {
			if (confidence === 'high') return 'text-green-400';
			if (confidence === 'medium') return 'text-yellow-400';
			return 'text-red-400';
		}
		if (confidence >= 0.7) return 'text-green-400';
		if (confidence >= 0.4) return 'text-yellow-400';
		return 'text-red-400';
	}

	function getConfidenceBg(confidence: number): string {
		if (confidence >= 0.7) return 'bg-green-500';
		if (confidence >= 0.4) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function getSeverityStyles(severity: string): { bg: string; border: string; icon: string; color: string } {
		switch (severity) {
			case 'warning':
				return { bg: 'bg-amber-900/30', border: 'border-amber-700/50', icon: '!', color: 'text-amber-400' };
			case 'success':
				return { bg: 'bg-emerald-900/30', border: 'border-emerald-700/50', icon: '\u2713', color: 'text-emerald-400' };
			default:
				return { bg: 'bg-blue-900/30', border: 'border-blue-700/50', icon: 'i', color: 'text-blue-400' };
		}
	}

	function getTrendIcon(trend: string): string {
		if (trend === 'increasing') return '\u2191';
		if (trend === 'decreasing') return '\u2193';
		return '\u2192';
	}

	function getTrendColor(trend: string): string {
		if (trend === 'increasing') return 'text-red-400';
		if (trend === 'decreasing') return 'text-green-400';
		return 'text-surface-400';
	}

	// Build seasonal heatmap data
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const seasonalChartData = $derived(() => {
		if (!data.patterns || data.patterns.length === 0) return null;
		const labels = monthNames;
		const datasets = data.patterns.slice(0, 5).map((pattern: any, i: number) => {
			const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];
			const monthData = new Array(12).fill(0);
			for (const m of pattern.affectedMonths) {
				monthData[m - 1] = pattern.averageIncrease;
			}
			return {
				label: pattern.categoryName,
				data: monthData,
				backgroundColor: colors[i % colors.length]
			};
		});
		return { labels, datasets };
	});

	// Build predictions chart data
	const predictionsChartData = $derived(() => {
		if (!data.predictions || data.predictions.length === 0) return null;
		const top = data.predictions.slice(0, 8);
		return {
			labels: top.map((p: any) => p.categoryName),
			datasets: [
				{
					label: 'Predicted Spending',
					data: top.map((p: any) => p.predictedAmount),
					backgroundColor: '#6366f1'
				}
			]
		};
	});

	let tabs = $derived([
		{ id: 'suggestions' as const, label: 'Suggestions', count: data.suggestions?.length ?? 0 },
		{ id: 'insights' as const, label: 'Insights', count: data.insights?.length ?? 0 },
		{ id: 'predictions' as const, label: 'Predictions', count: data.predictions?.length ?? 0 },
		{ id: 'patterns' as const, label: 'Seasonal', count: data.patterns?.length ?? 0 }
	]);
</script>

<svelte:head>
	<title>Smart Budget Assistant - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Smart Budget Assistant</h2>
			<p class="mt-1 text-sm text-surface-400">
				AI-powered budget recommendations based on your spending history
			</p>
		</div>
		<div class="flex gap-3">
			<a href="/budgets" class="inline-flex items-center gap-2 rounded-lg bg-surface-700 px-4 py-2 text-sm text-surface-200 hover:bg-surface-600 transition">
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Budgets
			</a>
			<Button onclick={() => (showAutoAdjustModal = true)}>Auto-tune Budgets</Button>
		</div>
	</div>

	<!-- Error banner -->
	{#if form?.error}
		<div class="rounded-lg border border-red-700/50 bg-red-900/30 p-4 text-sm text-red-300">
			{form.error}
		</div>
	{/if}

	<!-- Adjustments result banner -->
	{#if form?.adjustments && form.adjustments.length > 0}
		<div class="rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-4">
			<p class="text-sm font-medium text-emerald-300">Budgets adjusted successfully!</p>
			<ul class="mt-2 space-y-1">
				{#each form.adjustments as adj}
					<li class="text-sm text-emerald-200">
						{adj.categoryName}: {fmt(adj.previousAmount)} &rarr; {fmt(adj.newAmount)}
						<span class="text-emerald-400">({fmtPercent(adj.changePercent)})</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else if form?.adjustments && form.adjustments.length === 0}
		<div class="rounded-lg border border-blue-700/50 bg-blue-900/30 p-4 text-sm text-blue-300">
			No adjustments needed - your budgets are already well-aligned with your spending patterns.
		</div>
	{/if}

	<!-- Tab navigation -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
		{#each tabs as tab}
			<button
				class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition {activeTab === tab.id
					? 'bg-primary-600 text-white'
					: 'text-surface-400 hover:text-white hover:bg-surface-700'}"
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
				{#if tab.count > 0}
					<span class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs {activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-surface-600 text-surface-300'}">
						{tab.count}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- ===== SUGGESTIONS TAB ===== -->
	{#if activeTab === 'suggestions'}
		{#if data.suggestions.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					<p class="mt-4 text-lg text-surface-300">Not enough data for suggestions</p>
					<p class="mt-1 text-sm text-surface-500">
						We need at least a few months of transaction history to suggest budgets.
					</p>
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each data.suggestions as suggestion}
					{@const accepted = acceptedCategories.has(suggestion.categoryId)}
					<Card class={accepted ? 'opacity-60' : ''}>
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div class="flex-1 space-y-2">
								<div class="flex items-center gap-3">
									<h3 class="font-semibold text-white">{suggestion.categoryName}</h3>
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {getConfidenceColor(suggestion.confidence)} bg-surface-700">
										{suggestion.confidence} confidence
									</span>
								</div>
								<p class="text-sm text-surface-400">{suggestion.reasoning}</p>
								<div class="flex flex-wrap gap-4 text-xs text-surface-500">
									<span>Avg: <span class="text-surface-300">{fmt(suggestion.averageSpending)}</span>/mo</span>
									<span>Median: <span class="text-surface-300">{fmt(suggestion.medianSpending)}</span>/mo</span>
									<span>Max: <span class="text-surface-300">{fmt(suggestion.maxSpending)}</span>/mo</span>
								</div>
							</div>

							<div class="flex items-center gap-3">
								<div class="text-right">
									<p class="text-xs text-surface-500">Suggested budget</p>
									<p class="text-xl font-bold text-primary-400">{fmt(suggestion.suggestedAmount)}</p>
									<p class="text-xs text-surface-500">per month</p>
								</div>
								{#if accepted}
									<div class="rounded-lg bg-emerald-900/30 px-3 py-2 text-sm text-emerald-400">
										Accepted
									</div>
								{:else}
									<form method="POST" action="?/accept-suggestion" use:enhance>
										<input type="hidden" name="categoryId" value={suggestion.categoryId} />
										<input type="hidden" name="amount" value={suggestion.suggestedAmount} />
										<Button type="submit" size="sm">Accept</Button>
									</form>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- ===== INSIGHTS TAB ===== -->
	{#if activeTab === 'insights'}
		{#if data.insights.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<p class="mt-4 text-lg text-surface-300">No insights available</p>
					<p class="mt-1 text-sm text-surface-500">
						Create some budgets and track spending to get personalized insights.
					</p>
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each data.insights as insight}
					{@const styles = getSeverityStyles(insight.severity)}
					<div class="rounded-xl border {styles.border} {styles.bg} p-5">
						<div class="flex items-start gap-3">
							<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {styles.bg} {styles.color} border {styles.border} text-sm font-bold">
								{styles.icon}
							</div>
							<div class="flex-1">
								<h3 class="font-semibold text-white">{insight.title}</h3>
								<p class="mt-1 text-sm text-surface-300">{insight.description}</p>
								{#if insight.categoryName}
									<div class="mt-2 flex items-center gap-3">
										<span class="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-300">
											{insight.categoryName}
										</span>
										{#if insight.amount}
											<span class="text-xs {styles.color} font-medium">
												{fmt(insight.amount)}
											</span>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- ===== PREDICTIONS TAB ===== -->
	{#if activeTab === 'predictions'}
		{#if data.predictions.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
					</svg>
					<p class="mt-4 text-lg text-surface-300">Not enough data for predictions</p>
					<p class="mt-1 text-sm text-surface-500">
						We need at least 2 months of data to predict next month's spending.
					</p>
				</div>
			</Card>
		{:else}
			<!-- Predictions chart -->
			{@const chartData = predictionsChartData()}
			{#if chartData}
				<Card>
					<h3 class="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">Next Month Forecast</h3>
					<BarChart labels={chartData.labels} datasets={chartData.datasets} height={280} />
				</Card>
			{/if}

			<!-- Prediction cards -->
			<div class="grid gap-3 sm:grid-cols-2">
				{#each data.predictions as prediction}
					<Card>
						<div class="flex items-start justify-between">
							<div>
								<h3 class="font-semibold text-white">{prediction.categoryName}</h3>
								<div class="mt-1 flex items-center gap-2">
									<span class="text-lg font-bold text-primary-400">
										{fmt(prediction.predictedAmount)}
									</span>
									<span class="{getTrendColor(prediction.trend)} text-sm font-medium">
										{getTrendIcon(prediction.trend)} {fmtPercent(prediction.monthOverMonthChange)}
									</span>
								</div>
							</div>
							<span class="rounded-full bg-surface-700 px-2 py-0.5 text-xs {getTrendColor(prediction.trend)} capitalize">
								{prediction.trend}
							</span>
						</div>

						<!-- Confidence bar -->
						<div class="mt-3">
							<div class="flex items-center justify-between text-xs text-surface-500">
								<span>Confidence</span>
								<span class="{getConfidenceColor(prediction.confidence)}">{(prediction.confidence * 100).toFixed(0)}%</span>
							</div>
							<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-700">
								<div
									class="{getConfidenceBg(prediction.confidence)} h-full rounded-full transition-all"
									style="width: {prediction.confidence * 100}%"
								></div>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- ===== SEASONAL PATTERNS TAB ===== -->
	{#if activeTab === 'patterns'}
		{#if data.patterns.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					<p class="mt-4 text-lg text-surface-300">No seasonal patterns detected</p>
					<p class="mt-1 text-sm text-surface-500">
						We need 6+ months of data to identify seasonal spending patterns.
					</p>
				</div>
			</Card>
		{:else}
			<!-- Seasonal chart -->
			{@const chartData = seasonalChartData()}
			{#if chartData}
				<Card>
					<h3 class="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">Spending Increase by Month (%)</h3>
					<BarChart labels={chartData.labels} datasets={chartData.datasets} height={280} stacked />
				</Card>
			{/if}

			<!-- Seasonal heatmap grid -->
			<Card>
				<h3 class="mb-4 text-sm font-semibold text-surface-300 uppercase tracking-wider">Seasonal Heatmap</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr>
								<th class="py-2 pr-4 text-left text-xs font-medium text-surface-500">Category</th>
								{#each monthNames as month}
									<th class="px-1 py-2 text-center text-xs font-medium text-surface-500">{month}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each data.patterns as pattern}
								<tr class="border-t border-surface-700">
									<td class="py-2 pr-4 font-medium text-white whitespace-nowrap">{pattern.categoryName}</td>
									{#each Array.from({ length: 12 }, (_, i) => i + 1) as month}
										{@const isAffected = pattern.affectedMonths.includes(month)}
										<td class="px-1 py-2 text-center">
											<div
												class="mx-auto h-6 w-6 rounded {isAffected
													? 'bg-amber-500/60'
													: 'bg-surface-700/50'}"
												title={isAffected
													? `+${pattern.averageIncrease}% spending increase`
													: 'Normal spending'}
											></div>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="mt-3 flex items-center gap-4 text-xs text-surface-500">
					<div class="flex items-center gap-1.5">
						<div class="h-3 w-3 rounded bg-amber-500/60"></div>
						<span>Above-average spending</span>
					</div>
					<div class="flex items-center gap-1.5">
						<div class="h-3 w-3 rounded bg-surface-700/50"></div>
						<span>Normal spending</span>
					</div>
				</div>
			</Card>

			<!-- Pattern details -->
			<div class="space-y-3">
				{#each data.patterns as pattern}
					<Card>
						<div class="flex items-start gap-3">
							<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-900/30 text-amber-400">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
								</svg>
							</div>
							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-semibold text-white">{pattern.categoryName}</h3>
									<span class="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-amber-400 capitalize">
										{pattern.pattern.replace(/_/g, ' ')}
									</span>
								</div>
								<p class="mt-1 text-sm text-surface-300">{pattern.recommendation}</p>
								<div class="mt-2 flex items-center gap-2 text-xs text-surface-500">
									<span>Average increase: <span class="text-amber-400 font-medium">+{pattern.averageIncrease}%</span></span>
									<span class="text-surface-600">|</span>
									<span>Months: {pattern.affectedMonths.map((m: number) => monthNames[m - 1]).join(', ')}</span>
								</div>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Auto-Adjust Modal -->
{#if showAutoAdjustModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog">
		<div class="mx-4 w-full max-w-md rounded-2xl bg-surface-800 p-6 shadow-2xl">
			<h3 class="text-lg font-bold text-white">Auto-tune Budgets</h3>
			<p class="mt-2 text-sm text-surface-400">
				Automatically adjust your budget amounts based on recent spending trends.
				Choose how aggressively budgets should be adjusted.
			</p>

			<form
				method="POST"
				action="?/auto-adjust"
				use:enhance={() => {
					isAutoAdjusting = true;
					return async ({ update }) => {
						await update();
					};
				}}
				class="mt-5 space-y-4"
			>
				<div class="space-y-2">
					<span class="block text-sm font-medium text-surface-300">Sensitivity</span>

					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition {sensitivity === 'conservative'
							? 'border-primary-500 bg-primary-900/20'
							: 'border-surface-600 hover:border-surface-500'}"
					>
						<input
							type="radio"
							name="sensitivity"
							value="conservative"
							bind:group={sensitivity}
							class="mt-0.5 h-4 w-4 border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
						/>
						<div>
							<p class="text-sm font-medium text-white">Conservative</p>
							<p class="text-xs text-surface-400">Small adjustments (up to 5%). Safest option.</p>
						</div>
					</label>

					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition {sensitivity === 'moderate'
							? 'border-primary-500 bg-primary-900/20'
							: 'border-surface-600 hover:border-surface-500'}"
					>
						<input
							type="radio"
							name="sensitivity"
							value="moderate"
							bind:group={sensitivity}
							class="mt-0.5 h-4 w-4 border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
						/>
						<div>
							<p class="text-sm font-medium text-white">Moderate</p>
							<p class="text-xs text-surface-400">Balanced adjustments (up to 10%). Recommended.</p>
						</div>
					</label>

					<label
						class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition {sensitivity === 'aggressive'
							? 'border-primary-500 bg-primary-900/20'
							: 'border-surface-600 hover:border-surface-500'}"
					>
						<input
							type="radio"
							name="sensitivity"
							value="aggressive"
							bind:group={sensitivity}
							class="mt-0.5 h-4 w-4 border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
						/>
						<div>
							<p class="text-sm font-medium text-white">Aggressive</p>
							<p class="text-xs text-surface-400">Large adjustments (up to 20%). Closely tracks spending.</p>
						</div>
					</label>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<Button
						variant="ghost"
						type="button"
						onclick={() => (showAutoAdjustModal = false)}
						disabled={isAutoAdjusting}
					>
						Cancel
					</Button>
					<Button type="submit" loading={isAutoAdjusting}>
						{isAutoAdjusting ? 'Adjusting...' : 'Apply Adjustments'}
					</Button>
				</div>
			</form>
		</div>
	</div>
{/if}
