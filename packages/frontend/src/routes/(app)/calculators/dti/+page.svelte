<script lang="ts">
	import { Card } from '$components/ui';

	// Inputs
	let monthlyIncome = $state(6500);
	let mortgage = $state(1500);
	let carPayment = $state(350);
	let studentLoans = $state(200);
	let creditCards = $state(150);
	let otherDebts = $state(0);

	// Calculations
	let totalDebt = $derived(mortgage + carPayment + studentLoans + creditCards + otherDebts);
	let dtiRatio = $derived(monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 0);

	let rating = $derived.by(() => {
		if (dtiRatio <= 20) return 'excellent';
		if (dtiRatio <= 35) return 'good';
		if (dtiRatio <= 43) return 'fair';
		return 'poor';
	});

	let maxRecommendedDebt = $derived(monthlyIncome * 0.43);
	let remainingCapacity = $derived(Math.max(0, maxRecommendedDebt - totalDebt));

	// Rating styling
	let ratingColor = $derived.by(() => {
		switch (rating) {
			case 'excellent':
				return { text: 'text-green-400', bg: 'bg-green-400', ring: 'ring-green-400/30', stroke: '#4ade80' };
			case 'good':
				return { text: 'text-blue-400', bg: 'bg-blue-400', ring: 'ring-blue-400/30', stroke: '#60a5fa' };
			case 'fair':
				return { text: 'text-yellow-400', bg: 'bg-yellow-400', ring: 'ring-yellow-400/30', stroke: '#facc15' };
			default:
				return { text: 'text-red-400', bg: 'bg-red-400', ring: 'ring-red-400/30', stroke: '#f87171' };
		}
	});

	let ratingDescription = $derived.by(() => {
		switch (rating) {
			case 'excellent':
				return 'Your debt-to-income ratio is excellent. You are well within healthy limits and should have no issues qualifying for new credit.';
			case 'good':
				return 'Your DTI is in good shape. Most lenders consider this a manageable level of debt. You should be able to qualify for most loans.';
			case 'fair':
				return 'Your DTI is approaching the limit. While some lenders will still approve you, you may want to reduce debts before taking on more.';
			default:
				return 'Your DTI ratio is above the recommended 43% threshold. Lenders may view this unfavorably. Consider paying down debts before applying for new credit.';
		}
	});

	// SVG gauge
	let gaugeAngle = $derived(Math.min(dtiRatio, 100) * 1.8); // 0-100% mapped to 0-180 degrees

	function getGaugeArc(angle: number): string {
		const r = 80;
		const cx = 100;
		const cy = 100;
		const rad = (angle * Math.PI) / 180;
		const x = cx + r * Math.cos(Math.PI - rad);
		const y = cy - r * Math.sin(Math.PI - rad);
		const largeArc = angle > 180 ? 1 : 0;
		return `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y}`;
	}

	let needleRotation = $derived(-90 + (Math.min(dtiRatio, 100) / 100) * 180);

	// Debt breakdown for bars
	let debtItems = $derived([
		{ label: 'Mortgage / Rent', value: mortgage, color: '#3b82f6' },
		{ label: 'Car Payment', value: carPayment, color: '#8b5cf6' },
		{ label: 'Student Loans', value: studentLoans, color: '#f59e0b' },
		{ label: 'Credit Cards', value: creditCards, color: '#ef4444' },
		{ label: 'Other Debts', value: otherDebts, color: '#6b7280' }
	].filter((d) => d.value > 0));

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}
</script>

<svelte:head>
	<title>DTI Calculator - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a aria-label="Back to calculators" href="/calculators" class="text-surface-400 hover:text-white transition">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h2 class="text-2xl font-bold text-white">Debt-to-Income Ratio Calculator</h2>
	</div>

	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Inputs -->
		<div class="lg:col-span-2 space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Monthly Income</h3>
				<div>
					<label for="income" class="block text-sm font-medium text-surface-300">Gross Monthly Income</label>
					<input
						id="income"
						type="number"
						bind:value={monthlyIncome}
						min="1"
						step="100"
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
			</Card>

			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Monthly Debts</h3>
				<div class="space-y-4">
					<div>
						<label for="mortgage" class="block text-sm font-medium text-surface-300">Mortgage / Rent</label>
						<input
							id="mortgage"
							type="number"
							bind:value={mortgage}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="car" class="block text-sm font-medium text-surface-300">Car Payment</label>
						<input
							id="car"
							type="number"
							bind:value={carPayment}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="student" class="block text-sm font-medium text-surface-300">Student Loans</label>
						<input
							id="student"
							type="number"
							bind:value={studentLoans}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="credit" class="block text-sm font-medium text-surface-300">Credit Card Payments</label>
						<input
							id="credit"
							type="number"
							bind:value={creditCards}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<div>
						<label for="other" class="block text-sm font-medium text-surface-300">Other Debts</label>
						<input
							id="other"
							type="number"
							bind:value={otherDebts}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			</Card>
		</div>

		<!-- Results -->
		<div class="lg:col-span-3 space-y-4">
			<!-- DTI Gauge -->
			<Card>
				<div class="flex flex-col items-center py-4">
					<h3 class="mb-4 text-lg font-semibold text-white">Your DTI Ratio</h3>

					<div class="relative">
						<svg width="200" height="120" viewBox="0 0 200 120">
							<!-- Background arc -->
							<path
								d="M 20 100 A 80 80 0 0 1 180 100"
								fill="none"
								stroke="#334155"
								stroke-width="14"
								stroke-linecap="round"
							/>
							<!-- Color zones -->
							<!-- Green: 0-20% -->
							<path
								d={getGaugeArc(36)}
								fill="none"
								stroke="#4ade80"
								stroke-width="14"
								stroke-linecap="round"
								opacity="0.3"
							/>
							<!-- Score arc -->
							<path
								d={getGaugeArc(gaugeAngle)}
								fill="none"
								stroke={ratingColor.stroke}
								stroke-width="14"
								stroke-linecap="round"
							/>
							<!-- Needle -->
							<g transform="translate(100, 100) rotate({needleRotation})">
								<line x1="0" y1="0" x2="0" y2="-65" stroke="white" stroke-width="2" stroke-linecap="round" />
								<circle cx="0" cy="0" r="4" fill="white" />
							</g>
							<!-- Labels -->
							<text x="20" y="115" fill="#64748b" font-size="10" text-anchor="start">0%</text>
							<text x="100" y="10" fill="#64748b" font-size="10" text-anchor="middle">50%</text>
							<text x="180" y="115" fill="#64748b" font-size="10" text-anchor="end">100%</text>
						</svg>
					</div>

					<p class="mt-2 text-4xl font-bold {ratingColor.text}">{dtiRatio.toFixed(1)}%</p>
					<span
						class="mt-2 rounded-full px-4 py-1 text-sm font-semibold capitalize {ratingColor.text} ring-1 {ratingColor.ring}"
						style="background-color: {ratingColor.stroke}15"
					>
						{rating}
					</span>
				</div>
			</Card>

			<!-- Rating explanation -->
			<Card>
				<div class="flex items-start gap-3">
					<div class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {ratingColor.text}"
						style="background-color: {ratingColor.stroke}20"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm font-medium text-white">What this means</p>
						<p class="mt-1 text-sm text-surface-300">{ratingDescription}</p>
					</div>
				</div>
			</Card>

			<!-- Summary stats -->
			<div class="grid gap-4 sm:grid-cols-3">
				<Card>
					<p class="text-sm text-surface-400">Total Monthly Debt</p>
					<p class="mt-1 text-xl font-bold text-white">{fmt(totalDebt)}</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Max Recommended</p>
					<p class="mt-1 text-xl font-bold text-surface-300">{fmt(maxRecommendedDebt)}</p>
					<p class="text-xs text-surface-500">43% of income</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Remaining Capacity</p>
					<p class="mt-1 text-xl font-bold {remainingCapacity > 0 ? 'text-green-400' : 'text-red-400'}">
						{fmt(remainingCapacity)}
					</p>
				</Card>
			</div>

			<!-- Debt breakdown bars -->
			{#if debtItems.length > 0}
				<Card>
					<h3 class="text-lg font-semibold text-white mb-4">Debt Breakdown</h3>
					<div class="space-y-3">
						{#each debtItems as item}
							{@const pct = monthlyIncome > 0 ? (item.value / monthlyIncome) * 100 : 0}
							<div>
								<div class="mb-1 flex items-center justify-between text-sm">
									<div class="flex items-center gap-2">
										<span class="h-2.5 w-2.5 rounded-full" style="background-color: {item.color}"></span>
										<span class="text-surface-300">{item.label}</span>
									</div>
									<span class="font-medium text-white">{fmt(item.value)} <span class="text-surface-500 text-xs">({pct.toFixed(1)}%)</span></span>
								</div>
								<div class="h-2 overflow-hidden rounded-full bg-surface-700">
									<div
										class="h-full rounded-full transition-all"
										style="width: {Math.min(pct, 100)}%; background-color: {item.color}"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- DTI Scale reference -->
			<Card>
				<h3 class="text-base font-semibold text-white mb-3">DTI Rating Scale</h3>
				<div class="space-y-2 text-sm">
					<div class="flex items-center gap-3 rounded-lg bg-surface-900 px-3 py-2 {rating === 'excellent' ? 'ring-1 ring-green-400/30' : ''}">
						<span class="h-2.5 w-2.5 rounded-full bg-green-400"></span>
						<span class="font-medium text-green-400 w-20">0 - 20%</span>
						<span class="text-surface-300">Excellent - very manageable</span>
					</div>
					<div class="flex items-center gap-3 rounded-lg bg-surface-900 px-3 py-2 {rating === 'good' ? 'ring-1 ring-blue-400/30' : ''}">
						<span class="h-2.5 w-2.5 rounded-full bg-blue-400"></span>
						<span class="font-medium text-blue-400 w-20">21 - 35%</span>
						<span class="text-surface-300">Good - healthy debt level</span>
					</div>
					<div class="flex items-center gap-3 rounded-lg bg-surface-900 px-3 py-2 {rating === 'fair' ? 'ring-1 ring-yellow-400/30' : ''}">
						<span class="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
						<span class="font-medium text-yellow-400 w-20">36 - 43%</span>
						<span class="text-surface-300">Fair - approaching limits</span>
					</div>
					<div class="flex items-center gap-3 rounded-lg bg-surface-900 px-3 py-2 {rating === 'poor' ? 'ring-1 ring-red-400/30' : ''}">
						<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
						<span class="font-medium text-red-400 w-20">44%+</span>
						<span class="text-surface-300">Poor - over-extended</span>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
