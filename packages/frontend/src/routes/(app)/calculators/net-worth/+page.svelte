<script lang="ts">
	import { Card } from '$components/ui';

	// Assets
	let cashAndSavings = $state(15000);
	let investments = $state(45000);
	let propertyValue = $state(350000);
	let vehicleValue = $state(22000);
	let otherAssets = $state(5000);

	// Liabilities
	let mortgageBalance = $state(280000);
	let autoLoans = $state(12000);
	let studentLoans = $state(25000);
	let creditCardDebt = $state(3500);
	let otherLiabilities = $state(0);

	// Calculations
	let totalAssets = $derived(cashAndSavings + investments + propertyValue + vehicleValue + otherAssets);
	let totalLiabilities = $derived(mortgageBalance + autoLoans + studentLoans + creditCardDebt + otherLiabilities);
	let netWorth = $derived(totalAssets - totalLiabilities);

	let assetBreakdown = $derived([
		{ label: 'Cash & Savings', value: cashAndSavings, color: '#22c55e' },
		{ label: 'Investments', value: investments, color: '#3b82f6' },
		{ label: 'Property', value: propertyValue, color: '#f59e0b' },
		{ label: 'Vehicles', value: vehicleValue, color: '#8b5cf6' },
		{ label: 'Other Assets', value: otherAssets, color: '#6b7280' }
	].filter((a) => a.value > 0));

	let liabilityBreakdown = $derived([
		{ label: 'Mortgage', value: mortgageBalance, color: '#ef4444' },
		{ label: 'Auto Loans', value: autoLoans, color: '#f97316' },
		{ label: 'Student Loans', value: studentLoans, color: '#eab308' },
		{ label: 'Credit Card Debt', value: creditCardDebt, color: '#ec4899' },
		{ label: 'Other Liabilities', value: otherLiabilities, color: '#6b7280' }
	].filter((l) => l.value > 0));

	// Donut chart
	function getDonutSegments(
		data: Array<{ label: string; value: number; color: string }>
	): Array<{ offset: number; length: number; color: string; label: string; value: number; pct: number }> {
		const total = data.reduce((sum, d) => sum + d.value, 0);
		if (total === 0) return [];
		const circumference = 2 * Math.PI * 50;
		let offset = 0;
		return data.map((d) => {
			const length = (d.value / total) * circumference;
			const pct = (d.value / total) * 100;
			const segment = { offset, length, color: d.color, label: d.label, value: d.value, pct };
			offset += length;
			return segment;
		});
	}

	let assetSegments = $derived(getDonutSegments(assetBreakdown));
	let liabilitySegments = $derived(getDonutSegments(liabilityBreakdown));

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}
</script>

<svelte:head>
	<title>Net Worth Calculator - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a aria-label="Back to calculators" href="/calculators" class="text-surface-400 hover:text-white transition">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h2 class="text-2xl font-bold text-white">Net Worth Calculator</h2>
	</div>

	<!-- Net worth headline -->
	<Card>
		<div class="flex flex-col items-center py-4">
			<p class="text-sm text-surface-400">Your Net Worth</p>
			<p class="mt-2 text-4xl font-bold {netWorth >= 0 ? 'text-green-400' : 'text-red-400'}">
				{fmt(netWorth)}
			</p>
			<div class="mt-3 flex items-center gap-6 text-sm">
				<span class="text-surface-300">
					Assets: <span class="font-semibold text-green-400">{fmt(totalAssets)}</span>
				</span>
				<span class="text-surface-500">-</span>
				<span class="text-surface-300">
					Liabilities: <span class="font-semibold text-red-400">{fmt(totalLiabilities)}</span>
				</span>
			</div>
		</div>
	</Card>

	<!-- Assets vs Liabilities bar -->
	<Card>
		{@const maxVal = Math.max(totalAssets, totalLiabilities, 1)}
		<div class="space-y-3">
			<div>
				<div class="mb-1 flex items-center justify-between text-sm">
					<span class="font-medium text-green-400">Total Assets</span>
					<span class="font-semibold text-white">{fmt(totalAssets)}</span>
				</div>
				<div class="h-5 overflow-hidden rounded-full bg-surface-700">
					<div
						class="h-full rounded-full bg-green-500/60 transition-all"
						style="width: {(totalAssets / maxVal) * 100}%"
					></div>
				</div>
			</div>
			<div>
				<div class="mb-1 flex items-center justify-between text-sm">
					<span class="font-medium text-red-400">Total Liabilities</span>
					<span class="font-semibold text-white">{fmt(totalLiabilities)}</span>
				</div>
				<div class="h-5 overflow-hidden rounded-full bg-surface-700">
					<div
						class="h-full rounded-full bg-red-500/60 transition-all"
						style="width: {(totalLiabilities / maxVal) * 100}%"
					></div>
				</div>
			</div>
		</div>
	</Card>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Assets section -->
		<div class="space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-green-400 mb-4">Assets</h3>
				<div class="space-y-4">
					<div>
						<label for="cash" class="block text-sm font-medium text-surface-300">Cash & Savings</label>
						<input
							id="cash"
							type="number"
							bind:value={cashAndSavings}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="invest" class="block text-sm font-medium text-surface-300">Investments (stocks, bonds, retirement)</label>
						<input
							id="invest"
							type="number"
							bind:value={investments}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="property" class="block text-sm font-medium text-surface-300">Property Value</label>
						<input
							id="property"
							type="number"
							bind:value={propertyValue}
							min="0"
							step="1000"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="vehicles" class="block text-sm font-medium text-surface-300">Vehicle Value</label>
						<input
							id="vehicles"
							type="number"
							bind:value={vehicleValue}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="otherA" class="block text-sm font-medium text-surface-300">Other Assets</label>
						<input
							id="otherA"
							type="number"
							bind:value={otherAssets}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			</Card>

			<!-- Asset donut -->
			{#if assetSegments.length > 0}
				<Card>
					<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
						<svg width="130" height="130" viewBox="0 0 130 130" class="flex-shrink-0">
							{#each assetSegments as seg}
								<circle
									cx="65"
									cy="65"
									r="50"
									fill="none"
									stroke={seg.color}
									stroke-width="18"
									stroke-dasharray="{seg.length} {2 * Math.PI * 50 - seg.length}"
									stroke-dashoffset={-seg.offset}
									transform="rotate(-90 65 65)"
								/>
							{/each}
						</svg>
						<div class="flex-1 space-y-2">
							{#each assetSegments as seg}
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<span class="h-2.5 w-2.5 rounded-full" style="background-color: {seg.color}"></span>
										<span class="text-surface-300">{seg.label}</span>
									</div>
									<span class="font-medium text-white">
										{fmt(seg.value)}
										<span class="text-xs text-surface-500">({seg.pct.toFixed(0)}%)</span>
									</span>
								</div>
							{/each}
						</div>
					</div>
				</Card>
			{/if}
		</div>

		<!-- Liabilities section -->
		<div class="space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-red-400 mb-4">Liabilities</h3>
				<div class="space-y-4">
					<div>
						<label for="mortBal" class="block text-sm font-medium text-surface-300">Mortgage Balance</label>
						<input
							id="mortBal"
							type="number"
							bind:value={mortgageBalance}
							min="0"
							step="1000"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="autoLoan" class="block text-sm font-medium text-surface-300">Auto Loans</label>
						<input
							id="autoLoan"
							type="number"
							bind:value={autoLoans}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="stuLoan" class="block text-sm font-medium text-surface-300">Student Loans</label>
						<input
							id="stuLoan"
							type="number"
							bind:value={studentLoans}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="ccDebt" class="block text-sm font-medium text-surface-300">Credit Card Debt</label>
						<input
							id="ccDebt"
							type="number"
							bind:value={creditCardDebt}
							min="0"
							step="100"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="otherL" class="block text-sm font-medium text-surface-300">Other Liabilities</label>
						<input
							id="otherL"
							type="number"
							bind:value={otherLiabilities}
							min="0"
							step="500"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			</Card>

			<!-- Liability donut -->
			{#if liabilitySegments.length > 0}
				<Card>
					<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
						<svg width="130" height="130" viewBox="0 0 130 130" class="flex-shrink-0">
							{#each liabilitySegments as seg}
								<circle
									cx="65"
									cy="65"
									r="50"
									fill="none"
									stroke={seg.color}
									stroke-width="18"
									stroke-dasharray="{seg.length} {2 * Math.PI * 50 - seg.length}"
									stroke-dashoffset={-seg.offset}
									transform="rotate(-90 65 65)"
								/>
							{/each}
						</svg>
						<div class="flex-1 space-y-2">
							{#each liabilitySegments as seg}
								<div class="flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<span class="h-2.5 w-2.5 rounded-full" style="background-color: {seg.color}"></span>
										<span class="text-surface-300">{seg.label}</span>
									</div>
									<span class="font-medium text-white">
										{fmt(seg.value)}
										<span class="text-xs text-surface-500">({seg.pct.toFixed(0)}%)</span>
									</span>
								</div>
							{/each}
						</div>
					</div>
				</Card>
			{/if}
		</div>
	</div>
</div>
