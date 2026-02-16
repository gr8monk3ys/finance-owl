<script lang="ts">
	import { Card, Button } from '$components/ui';

	// Inputs
	let homePrice = $state(350000);
	let downPayment = $state(70000);
	let downPaymentPct = $state(20);
	let interestRate = $state(6.5);
	let loanTermYears = $state(30);
	let propertyTax = $state(3600);
	let homeInsurance = $state(1200);
	let pmi = $state(1200);
	let showSchedule = $state(false);

	// Sync down payment percentage
	function onDownPaymentChange() {
		downPaymentPct = homePrice > 0 ? Math.round((downPayment / homePrice) * 100 * 100) / 100 : 0;
	}

	function onDownPaymentPctChange() {
		downPayment = Math.round(homePrice * (downPaymentPct / 100));
	}

	// Core calculations using $derived
	let loanAmount = $derived(homePrice - downPayment);
	let monthlyRate = $derived(interestRate / 100 / 12);
	let totalPayments = $derived(loanTermYears * 12);

	let principalAndInterest = $derived.by(() => {
		if (monthlyRate === 0) return loanAmount / totalPayments;
		return (
			(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments))) /
			(Math.pow(1 + monthlyRate, totalPayments) - 1)
		);
	});

	let monthlyPropertyTax = $derived(propertyTax / 12);
	let monthlyInsurance = $derived(homeInsurance / 12);
	let showPmi = $derived(downPayment / homePrice < 0.2);
	let monthlyPMI = $derived(showPmi ? pmi / 12 : 0);

	let monthlyPayment = $derived(
		principalAndInterest + monthlyPropertyTax + monthlyInsurance + monthlyPMI
	);
	let totalPayment = $derived(principalAndInterest * totalPayments);
	let totalInterest = $derived(totalPayment - loanAmount);

	// Amortization schedule
	let amortizationSchedule = $derived.by(() => {
		const schedule: Array<{
			month: number;
			payment: number;
			principal: number;
			interest: number;
			balance: number;
		}> = [];

		let balance = loanAmount;
		for (let m = 1; m <= totalPayments; m++) {
			const interest = balance * monthlyRate;
			let principal = principalAndInterest - interest;
			if (principal > balance) principal = balance;
			balance = Math.max(0, balance - principal);
			schedule.push({
				month: m,
				payment: round(principalAndInterest),
				principal: round(principal),
				interest: round(interest),
				balance: round(balance)
			});
		}
		return schedule;
	});

	// Pie chart segments (for visual breakdown)
	let pieData = $derived([
		{ label: 'Principal & Interest', value: principalAndInterest, color: '#3b82f6' },
		{ label: 'Property Tax', value: monthlyPropertyTax, color: '#f59e0b' },
		{ label: 'Home Insurance', value: monthlyInsurance, color: '#22c55e' },
		...(showPmi ? [{ label: 'PMI', value: monthlyPMI, color: '#ef4444' }] : [])
	]);

	function round(v: number): number {
		return Math.round(v * 100) / 100;
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	// SVG donut chart helpers
	function getDonutSegments(
		data: Array<{ label: string; value: number; color: string }>
	): Array<{ offset: number; length: number; color: string; label: string; value: number }> {
		const total = data.reduce((sum, d) => sum + d.value, 0);
		if (total === 0) return [];
		const circumference = 2 * Math.PI * 60;
		let offset = 0;
		return data.map((d) => {
			const length = (d.value / total) * circumference;
			const segment = { offset, length, color: d.color, label: d.label, value: d.value };
			offset += length;
			return segment;
		});
	}

	let donutSegments = $derived(getDonutSegments(pieData));
</script>

<svelte:head>
	<title>Mortgage Calculator - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a aria-label="Back to calculators" href="/calculators" class="text-surface-400 hover:text-white transition">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h2 class="text-2xl font-bold text-white">Mortgage Calculator</h2>
	</div>

	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Inputs (left side) -->
		<div class="lg:col-span-2 space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Loan Details</h3>
				<div class="space-y-4">
					<div>
						<label for="homePrice" class="block text-sm font-medium text-surface-300">Home Price</label>
						<input
							id="homePrice"
							type="number"
							bind:value={homePrice}
							oninput={onDownPaymentChange}
							min="0"
							step="1000"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="downPayment" class="block text-sm font-medium text-surface-300">Down Payment</label>
						<div class="mt-1 flex gap-2">
							<input
								id="downPayment"
								type="number"
								bind:value={downPayment}
								oninput={onDownPaymentChange}
								min="0"
								class="block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
							<div class="flex items-center gap-1">
								<input
									type="number"
									bind:value={downPaymentPct}
									oninput={onDownPaymentPctChange}
									min="0"
									max="100"
									step="0.5"
									class="w-20 rounded-lg border border-surface-600 bg-surface-700 px-2 py-2 text-white text-right focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								/>
								<span class="text-surface-400 text-sm">%</span>
							</div>
						</div>
					</div>

					<div>
						<label for="interestRate" class="block text-sm font-medium text-surface-300">Interest Rate (%)</label>
						<input
							id="interestRate"
							type="number"
							bind:value={interestRate}
							min="0"
							max="30"
							step="0.125"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="loanTerm" class="block text-sm font-medium text-surface-300">Loan Term</label>
						<div class="mt-1 flex gap-2">
							{#each [15, 20, 30] as term}
								<button
									class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition {loanTermYears === term
										? 'border-primary-500 bg-primary-600/20 text-primary-400'
										: 'border-surface-600 bg-surface-700 text-surface-300 hover:border-surface-500'}"
									onclick={() => (loanTermYears = term)}
								>
									{term} yr
								</button>
							{/each}
						</div>
					</div>

					<div>
						<label for="propertyTax" class="block text-sm font-medium text-surface-300">Annual Property Tax</label>
						<input
							id="propertyTax"
							type="number"
							bind:value={propertyTax}
							min="0"
							step="100"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="homeInsurance" class="block text-sm font-medium text-surface-300">Annual Home Insurance</label>
						<input
							id="homeInsurance"
							type="number"
							bind:value={homeInsurance}
							min="0"
							step="100"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					{#if showPmi}
						<div>
							<label for="pmi" class="block text-sm font-medium text-surface-300">
								Annual PMI
								<span class="text-xs text-surface-500">(down payment &lt; 20%)</span>
							</label>
							<input
								id="pmi"
								type="number"
								bind:value={pmi}
								min="0"
								step="100"
								class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
						</div>
					{/if}
				</div>
			</Card>
		</div>

		<!-- Results (right side) -->
		<div class="lg:col-span-3 space-y-4">
			<!-- Monthly payment headline -->
			<Card>
				<div class="flex flex-col items-center py-2">
					<p class="text-sm text-surface-400">Estimated Monthly Payment</p>
					<p class="mt-1 text-4xl font-bold text-primary-400">{fmt(monthlyPayment)}</p>
				</div>
			</Card>

			<!-- Donut chart + breakdown -->
			<Card>
				<div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
					<!-- Donut -->
					<div class="flex-shrink-0">
						<svg width="160" height="160" viewBox="0 0 160 160">
							{#each donutSegments as seg}
								<circle
									cx="80"
									cy="80"
									r="60"
									fill="none"
									stroke={seg.color}
									stroke-width="20"
									stroke-dasharray="{seg.length} {2 * Math.PI * 60 - seg.length}"
									stroke-dashoffset={-seg.offset}
									transform="rotate(-90 80 80)"
								/>
							{/each}
						</svg>
					</div>

					<!-- Legend -->
					<div class="flex-1 space-y-3">
						{#each pieData as item}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="h-3 w-3 rounded-full" style="background-color: {item.color}"></span>
									<span class="text-sm text-surface-300">{item.label}</span>
								</div>
								<span class="text-sm font-medium text-white">{fmt(item.value)}</span>
							</div>
						{/each}
					</div>
				</div>
			</Card>

			<!-- Total cost summary -->
			<Card>
				<h3 class="text-lg font-semibold text-white mb-3">Loan Summary</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-surface-400">Loan Amount</p>
						<p class="text-lg font-semibold text-white">{fmt(loanAmount)}</p>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Interest</p>
						<p class="text-lg font-semibold text-red-400">{fmt(totalInterest)}</p>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Cost of Loan</p>
						<p class="text-lg font-semibold text-white">{fmt(totalPayment)}</p>
					</div>
					<div>
						<p class="text-sm text-surface-400">Total Payments</p>
						<p class="text-lg font-semibold text-white">{totalPayments}</p>
					</div>
				</div>
			</Card>

			<!-- Amortization schedule -->
			<Card>
				<button
					class="flex w-full items-center justify-between text-left"
					onclick={() => (showSchedule = !showSchedule)}
				>
					<h3 class="text-lg font-semibold text-white">Amortization Schedule</h3>
					<svg
						class="h-5 w-5 text-surface-400 transition-transform {showSchedule ? 'rotate-180' : ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if showSchedule}
					<div class="mt-4 max-h-96 overflow-auto">
						<table class="w-full text-sm">
							<thead class="sticky top-0 bg-surface-800">
								<tr class="border-b border-surface-700 text-left text-surface-400">
									<th class="px-2 py-2">Month</th>
									<th class="px-2 py-2 text-right">Payment</th>
									<th class="px-2 py-2 text-right">Principal</th>
									<th class="px-2 py-2 text-right">Interest</th>
									<th class="px-2 py-2 text-right">Balance</th>
								</tr>
							</thead>
							<tbody>
								{#each amortizationSchedule as row}
									{#if row.month % 12 === 1 || row.month <= 12}
										<tr class="border-b border-surface-700/50 hover:bg-surface-700/30">
											<td class="px-2 py-1.5 text-surface-300">{row.month}</td>
											<td class="px-2 py-1.5 text-right text-white">{fmt(row.payment)}</td>
											<td class="px-2 py-1.5 text-right text-green-400">{fmt(row.principal)}</td>
											<td class="px-2 py-1.5 text-right text-red-400">{fmt(row.interest)}</td>
											<td class="px-2 py-1.5 text-right text-surface-300">{fmt(row.balance)}</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
						<p class="mt-2 text-xs text-surface-500">
							Showing yearly snapshots (month 1 of each year). Full schedule contains {totalPayments} entries.
						</p>
					</div>
				{/if}
			</Card>
		</div>
	</div>
</div>
