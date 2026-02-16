<script lang="ts">
	import { Card } from '$components/ui';

	// Inputs
	let principal = $state(250000);
	let interestRate = $state(6.5);
	let termMonths = $state(360);
	let extraPayment = $state(0);
	let showFullSchedule = $state(false);

	// Core calculations
	let monthlyRate = $derived(interestRate / 100 / 12);

	let monthlyPayment = $derived.by(() => {
		if (monthlyRate === 0) return principal / termMonths;
		return (
			(principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
			(Math.pow(1 + monthlyRate, termMonths) - 1)
		);
	});

	// Without extra payments
	let totalPaymentNoExtra = $derived(monthlyPayment * termMonths);
	let totalInterestNoExtra = $derived(totalPaymentNoExtra - principal);

	// Schedule with extra payments
	let scheduleResult = $derived.by(() => {
		const schedule: Array<{
			month: number;
			payment: number;
			principal: number;
			interest: number;
			extra: number;
			balance: number;
		}> = [];

		let balance = principal;
		let totalPaid = 0;
		let totalInterestPaid = 0;
		let month = 0;

		while (balance > 0.01 && month < termMonths) {
			month++;
			const interestCharge = balance * monthlyRate;
			let principalPortion = monthlyPayment - interestCharge;

			let extra = extraPayment;
			if (principalPortion + extra > balance) {
				extra = Math.max(0, balance - principalPortion);
				principalPortion = Math.min(principalPortion, balance);
			}

			const totalPrincipal = principalPortion + extra;
			const payment = interestCharge + totalPrincipal;

			balance = Math.max(0, balance - totalPrincipal);
			totalPaid += payment;
			totalInterestPaid += interestCharge;

			schedule.push({
				month,
				payment: round(payment),
				principal: round(principalPortion),
				interest: round(interestCharge),
				extra: round(extra),
				balance: round(balance)
			});
		}

		const today = new Date();
		const payoffDate = new Date(today.getFullYear(), today.getMonth() + month, today.getDate());

		return {
			schedule,
			totalPaid: round(totalPaid),
			totalInterestPaid: round(totalInterestPaid),
			payoffMonths: month,
			payoffDate: payoffDate.toISOString().split('T')[0],
			interestSaved: round(Math.max(0, totalInterestNoExtra - totalInterestPaid)),
			monthsSaved: termMonths - month
		};
	});

	// For the balance-over-time chart (SVG line chart)
	let chartPoints = $derived.by(() => {
		const sched = scheduleResult.schedule;
		if (sched.length === 0) return '';

		const maxBalance = principal;
		const totalMonths = sched.length;
		const width = 600;
		const height = 200;
		const padding = 5;

		return sched
			.map((row, i) => {
				const x = padding + (i / Math.max(1, totalMonths - 1)) * (width - 2 * padding);
				const y = padding + (1 - row.balance / maxBalance) * (height - 2 * padding);
				return `${x},${y}`;
			})
			.join(' ');
	});

	// Chart for without extra payments
	let chartPointsNoExtra = $derived.by(() => {
		if (extraPayment <= 0) return '';

		const width = 600;
		const height = 200;
		const padding = 5;
		let balance = principal;

		const points: string[] = [];
		for (let m = 0; m < termMonths; m++) {
			const interest = balance * monthlyRate;
			const princ = monthlyPayment - interest;
			balance = Math.max(0, balance - princ);

			const x = padding + (m / Math.max(1, termMonths - 1)) * (width - 2 * padding);
			const y = padding + (1 - balance / principal) * (height - 2 * padding);
			points.push(`${x},${y}`);
		}
		return points.join(' ');
	});

	function round(v: number): number {
		return Math.round(v * 100) / 100;
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function fmtDate(dateStr: string): string {
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		});
	}

	const termOptions = [
		{ label: '10yr (120mo)', value: 120 },
		{ label: '15yr (180mo)', value: 180 },
		{ label: '20yr (240mo)', value: 240 },
		{ label: '30yr (360mo)', value: 360 }
	];
</script>

<svelte:head>
	<title>Loan Amortization - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a aria-label="Back to calculators" href="/calculators" class="text-surface-400 hover:text-white transition">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h2 class="text-2xl font-bold text-white">Loan Amortization Calculator</h2>
	</div>

	<div class="grid gap-6 lg:grid-cols-5">
		<!-- Inputs -->
		<div class="lg:col-span-2 space-y-4">
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Loan Details</h3>
				<div class="space-y-4">
					<div>
						<label for="principal" class="block text-sm font-medium text-surface-300">Loan Amount</label>
						<input
							id="principal"
							type="number"
							bind:value={principal}
							min="1"
							step="1000"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="rate" class="block text-sm font-medium text-surface-300">Interest Rate (%)</label>
						<input
							id="rate"
							type="number"
							bind:value={interestRate}
							min="0"
							step="0.125"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>

					<div>
						<label for="term" class="block text-sm font-medium text-surface-300">Loan Term</label>
						<select
							id="term"
							bind:value={termMonths}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							{#each termOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="extra" class="block text-sm font-medium text-surface-300">
							Extra Monthly Payment
							<span class="text-xs text-surface-500">(optional)</span>
						</label>
						<input
							id="extra"
							type="number"
							bind:value={extraPayment}
							min="0"
							step="50"
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			</Card>

			<!-- Savings from extra payments -->
			{#if extraPayment > 0}
				<Card class="border border-green-500/30">
					<h3 class="text-base font-semibold text-green-400 mb-3">Extra Payment Savings</h3>
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-sm text-surface-300">Interest Saved</span>
							<span class="text-sm font-semibold text-green-400">{fmt(scheduleResult.interestSaved)}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-surface-300">Months Saved</span>
							<span class="text-sm font-semibold text-green-400">{scheduleResult.monthsSaved} months</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-sm text-surface-300">New Payoff Date</span>
							<span class="text-sm font-semibold text-white">{fmtDate(scheduleResult.payoffDate)}</span>
						</div>
					</div>
				</Card>
			{/if}
		</div>

		<!-- Results -->
		<div class="lg:col-span-3 space-y-4">
			<!-- Summary cards -->
			<div class="grid gap-4 sm:grid-cols-2">
				<Card>
					<p class="text-sm text-surface-400">Monthly Payment</p>
					<p class="mt-1 text-2xl font-bold text-primary-400">{fmt(monthlyPayment)}</p>
					{#if extraPayment > 0}
						<p class="mt-1 text-xs text-surface-500">+ {fmt(extraPayment)} extra = {fmt(monthlyPayment + extraPayment)}</p>
					{/if}
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Total Interest</p>
					<p class="mt-1 text-2xl font-bold text-red-400">{fmt(scheduleResult.totalInterestPaid)}</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Total Paid</p>
					<p class="mt-1 text-2xl font-bold text-white">{fmt(scheduleResult.totalPaid)}</p>
				</Card>
				<Card>
					<p class="text-sm text-surface-400">Payoff Date</p>
					<p class="mt-1 text-2xl font-bold text-white">{fmtDate(scheduleResult.payoffDate)}</p>
					<p class="mt-1 text-xs text-surface-500">{scheduleResult.payoffMonths} payments</p>
				</Card>
			</div>

			<!-- Balance over time chart -->
			<Card>
				<h3 class="text-lg font-semibold text-white mb-4">Balance Over Time</h3>
				<div class="overflow-hidden rounded-lg bg-surface-900 p-4">
					<svg viewBox="0 0 600 200" class="w-full" preserveAspectRatio="xMidYMid meet">
						<!-- Grid lines -->
						{#each [0, 0.25, 0.5, 0.75, 1] as pct}
							<line
								x1="5"
								y1={5 + pct * 190}
								x2="595"
								y2={5 + pct * 190}
								stroke="#334155"
								stroke-width="0.5"
								stroke-dasharray="4 4"
							/>
						{/each}

						<!-- Without extra payments line (dimmed) -->
						{#if chartPointsNoExtra}
							<polyline
								points={chartPointsNoExtra}
								fill="none"
								stroke="#ef4444"
								stroke-width="1.5"
								stroke-dasharray="6 3"
								opacity="0.4"
							/>
						{/if}

						<!-- With extra payments line -->
						<polyline
							points={chartPoints}
							fill="none"
							stroke="#3b82f6"
							stroke-width="2"
						/>

						<!-- Labels -->
						<text x="5" y="198" fill="#94a3b8" font-size="10">Month 1</text>
						<text x="595" y="198" fill="#94a3b8" font-size="10" text-anchor="end">
							Month {scheduleResult.payoffMonths}
						</text>
						<text x="5" y="13" fill="#94a3b8" font-size="10">{fmt(principal)}</text>
						<text x="595" y="13" fill="#94a3b8" font-size="10" text-anchor="end">$0</text>
					</svg>
					{#if extraPayment > 0}
						<div class="mt-2 flex items-center gap-4 text-xs text-surface-400">
							<span class="flex items-center gap-1">
								<span class="inline-block h-0.5 w-4 bg-blue-500"></span>
								With extra payments
							</span>
							<span class="flex items-center gap-1">
								<span class="inline-block h-0.5 w-4 border-t border-dashed border-red-500/40"></span>
								Without extra payments
							</span>
						</div>
					{/if}
				</div>
			</Card>

			<!-- Amortization schedule table -->
			<Card>
				<button
					class="flex w-full items-center justify-between text-left"
					onclick={() => (showFullSchedule = !showFullSchedule)}
				>
					<h3 class="text-lg font-semibold text-white">Amortization Schedule</h3>
					<svg
						class="h-5 w-5 text-surface-400 transition-transform {showFullSchedule ? 'rotate-180' : ''}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{#if showFullSchedule}
					<div class="mt-4 max-h-96 overflow-auto">
						<table class="w-full text-sm">
							<thead class="sticky top-0 bg-surface-800">
								<tr class="border-b border-surface-700 text-left text-surface-400">
									<th class="px-2 py-2">Mo.</th>
									<th class="px-2 py-2 text-right">Payment</th>
									<th class="px-2 py-2 text-right">Principal</th>
									<th class="px-2 py-2 text-right">Interest</th>
									{#if extraPayment > 0}
										<th class="px-2 py-2 text-right">Extra</th>
									{/if}
									<th class="px-2 py-2 text-right">Balance</th>
								</tr>
							</thead>
							<tbody>
								{#each scheduleResult.schedule as row}
									{#if row.month <= 12 || row.month % 12 === 0 || row.month === scheduleResult.payoffMonths}
										<tr class="border-b border-surface-700/50 hover:bg-surface-700/30">
											<td class="px-2 py-1.5 text-surface-300">{row.month}</td>
											<td class="px-2 py-1.5 text-right text-white">{fmt(row.payment)}</td>
											<td class="px-2 py-1.5 text-right text-green-400">{fmt(row.principal)}</td>
											<td class="px-2 py-1.5 text-right text-red-400">{fmt(row.interest)}</td>
											{#if extraPayment > 0}
												<td class="px-2 py-1.5 text-right text-primary-400">{fmt(row.extra)}</td>
											{/if}
											<td class="px-2 py-1.5 text-right text-surface-300">{fmt(row.balance)}</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Card>
		</div>
	</div>
</div>
