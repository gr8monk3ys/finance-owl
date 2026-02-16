<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	$effect(() => {
		if (form?.success) {
			invalidateAll();
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtPercent(value: number): string {
		return `${value.toFixed(1)}%`;
	}

	function statusColor(status: string): string {
		if (status === 'better') return 'text-green-400';
		if (status === 'worse') return 'text-red-400';
		return 'text-yellow-400';
	}

	function statusBg(status: string): string {
		if (status === 'better') return 'bg-green-900/30';
		if (status === 'worse') return 'bg-red-900/30';
		return 'bg-yellow-900/30';
	}

	function statusLabel(status: string): string {
		if (status === 'better') return 'Better than peers';
		if (status === 'worse') return 'Below peers';
		return 'Similar to peers';
	}

	function statusIcon(status: string): string {
		if (status === 'better') return '\u2191';
		if (status === 'worse') return '\u2193';
		return '\u2192';
	}

	function incomeRangeLabel(range: string): string {
		const labels: Record<string, string> = {
			under_25k: 'Under $25k',
			'25k_50k': '$25k - $50k',
			'50k_75k': '$50k - $75k',
			'75k_100k': '$75k - $100k',
			'100k_150k': '$100k - $150k',
			'150k_plus': '$150k+'
		};
		return labels[range] || range;
	}

	const hasProfile = $derived(data.profile !== null);
</script>

<svelte:head>
	<title>Peer Benchmarking - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-white">Peer Benchmarking</h2>
		<p class="mt-1 text-sm text-surface-400">
			See how your finances compare to others in your demographic.
		</p>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Profile Setup -->
	{#if !hasProfile}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Set Up Your Profile</h3>
			<p class="mb-4 text-sm text-surface-400">
				Tell us a bit about yourself so we can show you relevant peer comparisons. Your data is
				anonymized.
			</p>
			<form
				method="POST"
				action="?/saveProfile"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="space-y-4"
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="ageRange" class="block text-sm font-medium text-surface-300"
							>Age Range</label
						>
						<select
							id="ageRange"
							name="ageRange"
							required
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="18-24">18 - 24</option>
							<option value="25-34">25 - 34</option>
							<option value="35-44">35 - 44</option>
							<option value="45-54">45 - 54</option>
							<option value="55-64">55 - 64</option>
							<option value="65+">65+</option>
						</select>
					</div>
					<div>
						<label for="incomeRange" class="block text-sm font-medium text-surface-300"
							>Income Range</label
						>
						<select
							id="incomeRange"
							name="incomeRange"
							required
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="under_25k">Under $25k</option>
							<option value="25k_50k">$25k - $50k</option>
							<option value="50k_75k">$50k - $75k</option>
							<option value="75k_100k">$75k - $100k</option>
							<option value="100k_150k">$100k - $150k</option>
							<option value="150k_plus">$150k+</option>
						</select>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="region" class="block text-sm font-medium text-surface-300">Region</label>
						<input
							id="region"
							name="region"
							type="text"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="e.g. Northeast, Midwest"
						/>
					</div>
					<div>
						<label for="householdSize" class="block text-sm font-medium text-surface-300"
							>Household Size</label
						>
						<input
							id="householdSize"
							name="householdSize"
							type="number"
							min="1"
							max="10"
							value="1"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="isOptedIn"
						name="isOptedIn"
						type="checkbox"
						class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
					/>
					<label for="isOptedIn" class="text-sm text-surface-300">
						Opt in to contribute anonymized data to improve benchmarks
					</label>
				</div>

				<div class="flex justify-end">
					<Button type="submit">Save Profile</Button>
				</div>
			</form>
		</Card>

	<!-- Comparison Dashboard -->
	{:else}
		<!-- Profile Summary -->
		<Card>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div>
						<p class="text-sm text-surface-400">Your Cohort</p>
						<p class="text-white">
							Age {data.profile.ageRange} &middot; {incomeRangeLabel(data.profile.incomeRange)}
							{#if data.profile.region}
								&middot; {data.profile.region}
							{/if}
						</p>
					</div>
				</div>
				<form
					method="POST"
					action="?/saveProfile"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<input type="hidden" name="ageRange" value={data.profile.ageRange} />
					<input type="hidden" name="incomeRange" value={data.profile.incomeRange} />
					<input type="hidden" name="region" value={data.profile.region ?? ''} />
					<input
						type="hidden"
						name="householdSize"
						value={data.profile.householdSize}
					/>
				</form>
			</div>
		</Card>

		<!-- Comparison Cards -->
		{#if data.comparison && data.comparison.length > 0}
			<div class="grid gap-4 sm:grid-cols-3">
				{#each data.comparison as comp}
					<Card>
						<div class="space-y-3">
							<p class="text-sm font-medium text-surface-400">{comp.metric}</p>

							<div class="flex items-end justify-between">
								<div>
									<p class="text-xs text-surface-500">You</p>
									<p class="text-xl font-bold text-white">
										{#if comp.metric.includes('Spending')}
											{fmt(comp.userValue)}
										{:else}
											{fmtPercent(comp.userValue)}
										{/if}
									</p>
								</div>
								<div class="text-right">
									<p class="text-xs text-surface-500">Peer Avg</p>
									<p class="text-xl font-bold text-surface-300">
										{#if comp.metric.includes('Spending')}
											{fmt(comp.peerAverage)}
										{:else}
											{fmtPercent(comp.peerAverage)}
										{/if}
									</p>
								</div>
							</div>

							<div class="rounded-lg px-3 py-2 {statusBg(comp.status)}">
								<div class="flex items-center gap-2">
									<span class="text-lg {statusColor(comp.status)}">
										{statusIcon(comp.status)}
									</span>
									<span class="text-sm font-medium {statusColor(comp.status)}">
										{statusLabel(comp.status)}
									</span>
								</div>
								<p class="mt-0.5 text-xs text-surface-400">
									{#if comp.percentDifference > 0}
										{fmtPercent(Math.abs(comp.percentDifference))} above average
									{:else if comp.percentDifference < 0}
										{fmtPercent(Math.abs(comp.percentDifference))} below average
									{:else}
										Right at the average
									{/if}
								</p>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-lg text-surface-300">No comparison data available</p>
					<p class="mt-1 text-sm text-surface-500">
						Add transactions and accounts to see how you compare to your peers.
					</p>
				</div>
			</Card>
		{/if}

		<!-- Benchmark Details -->
		{#if data.benchmarks}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Peer Averages</h3>
				<div class="space-y-3">
					<div class="flex items-center justify-between border-b border-surface-700 pb-2">
						<span class="text-sm text-surface-400">Avg Monthly Spending</span>
						<span class="font-medium text-white">{fmt(data.benchmarks.averageSpending)}</span>
					</div>
					<div class="flex items-center justify-between border-b border-surface-700 pb-2">
						<span class="text-sm text-surface-400">Avg Savings Rate</span>
						<span class="font-medium text-white"
							>{fmtPercent(data.benchmarks.averageSavingsRate)}</span
						>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-surface-400">Avg Debt Ratio</span>
						<span class="font-medium text-white"
							>{fmtPercent(data.benchmarks.averageDebtRatio)}</span
						>
					</div>
				</div>
				{#if data.benchmarks.sampleSize > 0}
					<p class="mt-3 text-xs text-surface-500">
						Based on {data.benchmarks.sampleSize} anonymized profiles
					</p>
				{:else}
					<p class="mt-3 text-xs text-surface-500">
						Based on national averages (default data)
					</p>
				{/if}
			</Card>
		{/if}
	{/if}
</div>
