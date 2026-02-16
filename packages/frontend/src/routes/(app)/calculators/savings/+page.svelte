<script lang="ts">
	import { Card } from '$components/ui';

	// Inputs
	let initialDeposit = $state(5000);
	let monthlyContribution = $state(500);
	let annualRate = $state(7);
	let years = $state(20);
	let compoundingFrequency = $state('monthly');

	const frequencyOptions = [
		{ label: 'Daily', value: 'daily' },
		{ label: 'Monthly', value: 'monthly' },
		{ label: 'Quarterly', value: 'quarterly' },
		{ label: 'Annually', value: 'annually' }
	];

	const frequencyMap: Record<string, number> = {
		daily: 365,
		monthly: 12,
		quarterly: 4,
		annually: 1
	};

	// Year-by-year calculation
	let result = $derived.by(() => {
		const n = frequencyMap[compoundingFrequency] || 12;
		const r = annualRate / 100;
		const P = initialDeposit;
		const PMT = monthlyContribution;

		const breakdown: Array<{
			year: number;
			balance: number;
			contributions: number;
			interestEarned: number;
		}> = [];

		let balance = P;
		let totalContributions = P;

		for (let year = 1; year <= years; year++) {
			const periodsPerYear = n;
			const ratePerPeriod = r / n;
			const monthsPerPeriod = 12 / n;

			for (let period = 0; period < periodsPerYear; period++) {
				balance += PMT * monthsPerPeriod;
				totalContributions += PMT * monthsPerPeriod;
				balance *= 1 + ratePerPeriod;
			}

			breakdown.push({
				year,
				balance: round(balance),
				contributions: round(totalContributions),
				interestEarned: round(balance - totalContributions)
			});
		}

		const futureValue = balance;
		const totalContributionsFinal = P + PMT * 12 * years;
		const totalInterestEarned = futureValue - totalContributionsFinal;

		return {
			futureValue: round(futureValue),
			totalContributions: round(totalContributionsFinal),
			totalInterestEarned: round(totalInterestEarned),
			breakdown
		};
	});

	// SVG chart data
	let chartData = $derived.by(() => {
		const bd = result.breakdown;
		if (bd.length === 0) return { contributionPoints: '', interestPoints: '', balancePoints: '', maxVal: 0 };

		const maxVal = Math.max(...bd.map((b) => b.balance), 1);
		const width = 600;
		const height = 250;
		const padX = 5;
		const padY = 5;

		const balancePoints = bd
			.map((b, i) => {
				const x = padX + (i / Math.max(1, bd.length - 1)) * (width - 2 * padX);
				const y = padY + (1 - b.balance / maxVal) * (height - 2 * padY);
				return `${x},${y}`;
			})
			.join(' ');

		const contributionPoints = bd
			.map((b, i) => {
				const x = padX + (i / Math.max(1, bd.length - 1)) * (width - 2 * padX);
				const y = padY + (1 - b.contributions / maxVal) * (height - 2 * padY);
				return `${x},${y}`;
			})
			.join(' ');

		// For the stacked area, we build filled polygons
		const bottomLine = `${padX},${height - padY} ${width - padX},${height - padY}`;

		const contributionArea =
			contributionPoints + ` ${width - padX},${height - padY} ${padX},${height - padY}`;
		const balanceArea =
			balancePoints + ` ${width - padX},${height - padY} ${padX},${height - padY}`;

		return {
			contributionArea,
			balanceArea,
			balancePoints,
			contributionPoints,
			maxVal
		};
	});

	function round(v: number): number {
		return Math.round(v * 100) / 100;
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function fmtShort(amount: number): string {
		if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
		if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
		return fmt(amount);
	}
</script>

<svelte:head>
	<title>Savings Calculator - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a aria-label="Back to calculators" href="/calculators" class="text-surface-400 hover:text-white transition">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h2 class="text-2xl font-bold text-white">Savings / Compound Interest Calculator</h2>
	</div>

	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Inputs -->
		<div class="lg:col-span-2 space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Investment Details</h3>
				<div class="space-y-4">
					<div>
						<label for="initial" class="block text-sm font-medium text-surface-300">Initial Deposit</label>
						<input
							id="initial"
							type="number"
							bind:value={initialDeposit}
							min="0"
							step="100"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="monthly" class="block text-sm font-medium text-surface-300">Monthly Contribution</label>
						<input
							id="monthly"
							type="number"
							bind:value={monthlyContribution}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="rate" class="block text-sm font-medium text-surface-300">Annual Return Rate (%)</label>
						<input
							id="rate"
							type="number"
							bind:value={annualRate}
							min="0"
							max="50"
							step="0.1"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="years" class="block text-sm font-medium text-surface-300">Time Period (Years)</label>
						<input
							id="years"
							type="range"
							bind:value={years}
							min="1"
							max="50"
							class="mt-2 w-full accent-primary-500"
						/>
						<div class="mt-1 flex justify-between text-xs text-surface-500">
							<span>1 yr</span>
							<span class="font-medium text-primary-400">{years} years</span>
							<span>50 yr</span>
						</div>
					</div>

					<div>
						<label for="frequency" class="block text-sm font-medium text-surface-300">Compounding Frequency</label>
						<select
							id="frequency"
							bind:value={compoundingFrequency}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each frequencyOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
			</Card>
		</div>

		<!-- Results -->
		<div class="lg:col-span-3 space-y-4">
			<!-- Summary -->
			<div class="grid gap-4 sm:grid-cols-3">
				<Card>
					<p class="text-sm text-surface-400">Future Value</p>
					<p class="mt-1 text-2xl font-bold text-primary-400">{fmt(result.futureValue)}</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Total Contributions</p>
					<p class="mt-1 text-2xl font-bold text-blue-400">{fmt(result.totalContributions)}</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Interest Earned</p>
					<p class="mt-1 text-2xl font-bold text-green-400">{fmt(result.totalInterestEarned)}</p>
				</Card>
			</div>

			<!-- Growth chart -->
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Growth Over Time</h3>
				<div class="overflow-hidden rounded-lg bg-surface-900 p-4">
					<svg viewBox="0 0 600 250" class="w-full" preserveAspectRatio="xMidYMid meet">
						<!-- Grid lines -->
						{#each [0, 0.25, 0.5, 0.75, 1] as pct}
							<line
								x1="5"
								y1={5 + pct * 240}
								x2="595"
								y2={5 + pct * 240}
								stroke="#334155"
								stroke-width="0.5"
								stroke-dasharray="4 4"
							/>
							<text x="595" y={5 + pct * 240 - 3} fill="#64748b" font-size="9" text-anchor="end">
								{fmtShort(chartData.maxVal * (1 - pct))}
							</text>
						{/each}

						<!-- Contribution area -->
						{#if chartData.contributionArea}
							<polygon points={chartData.contributionArea} fill="#3b82f6" opacity="0.2" />
						{/if}

						<!-- Total balance area (on top) -->
						{#if chartData.balanceArea}
							<polygon points={chartData.balanceArea} fill="#22c55e" opacity="0.15" />
						{/if}

						<!-- Lines -->
						{#if chartData.balancePoints}
							<polyline
								points={chartData.balancePoints}
								fill="none"
								stroke="#22c55e"
								stroke-width="2"
							/>
						{/if}
						{#if chartData.contributionPoints}
							<polyline
								points={chartData.contributionPoints}
								fill="none"
								stroke="#3b82f6"
								stroke-width="1.5"
								stroke-dasharray="4 2"
							/>
						{/if}

						<!-- Labels -->
						<text x="5" y="248" fill="#94a3b8" font-size="10">Year 1</text>
						<text x="595" y="248" fill="#94a3b8" font-size="10" text-anchor="end">
							Year {years}
						</text>
					</svg>
					<div class="mt-2 flex items-center gap-4 text-xs text-surface-400">
						<span class="flex items-center gap-1">
							<span class="inline-block h-0.5 w-4 bg-green-500"></span>
							Total Balance
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-0.5 w-4 border-t border-dashed border-blue-500"></span>
							Contributions
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-2 w-4 rounded-sm bg-green-500/15"></span>
							Interest Earned
						</span>
					</div>
				</div>
			</Card>

			<!-- Year-by-year table -->
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Year-by-Year Breakdown</h3>
				<div class="max-h-80 overflow-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-surface-800">
							<tr class="border-b border-surface-700 text-left text-surface-400">
								<th class="px-2 py-2">Year</th>
								<th class="px-2 py-2 text-right">Balance</th>
								<th class="px-2 py-2 text-right">Contributions</th>
								<th class="px-2 py-2 text-right">Interest Earned</th>
							</tr>
						</thead>
						<tbody>
							{#each result.breakdown as row}
								<tr class="border-b border-surface-700/50 hover:bg-surface-700/30">
									<td class="px-2 py-1.5 text-surface-300">{row.year}</td>
									<td class="px-2 py-1.5 text-right font-medium text-white">{fmt(row.balance)}</td>
									<td class="px-2 py-1.5 text-right text-blue-400">{fmt(row.contributions)}</td>
									<td class="px-2 py-1.5 text-right text-green-400">{fmt(row.interestEarned)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	</div>
</div>
