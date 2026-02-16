<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showAddModal = $state(false);
	let editingDebt = $state<any>(null);
	let payingDebt = $state<any>(null);
	let viewingPayments = $state<any>(null);
	let paymentHistory = $state<any[]>([]);
	let loadingPayments = $state(false);

	// Payoff strategy state
	let selectedStrategy = $state('avalanche');
	let extraPayment = $state(200);
	let showPayoffResults = $state(false);
	let expandedSchedule = $state<string | null>(null);

	// Get plan/comparison from form action result
	let payoffPlan = $derived(form?.plan ?? null);
	let strategyComparison = $derived(form?.comparison ?? null);

	// Active tab: 'debts' or 'strategy'
	let activeTab = $state<'debts' | 'strategy'>('debts');

	$effect(() => {
		if (form?.success && !form?.plan && !form?.payments) {
			invalidateAll();
			showAddModal = false;
			editingDebt = null;
			payingDebt = null;
		}
		if (form?.plan) {
			showPayoffResults = true;
		}
		if (form?.payments) {
			paymentHistory = form.payments;
			loadingPayments = false;
			// Find the debt being viewed
			const debtId = form.viewDebtId;
			if (debtId && !viewingPayments) {
				const debt = data.debts.find((d: any) => d.id === debtId);
				if (debt) viewingPayments = debt;
			}
		}
	});

	const debtTypes = [
		{ value: 'credit_card', label: 'Credit Card' },
		{ value: 'student_loan', label: 'Student Loan' },
		{ value: 'auto_loan', label: 'Auto Loan' },
		{ value: 'mortgage', label: 'Mortgage' },
		{ value: 'personal_loan', label: 'Personal Loan' },
		{ value: 'medical', label: 'Medical' },
		{ value: 'other', label: 'Other' }
	];

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtPct(rate: number): string {
		return rate.toFixed(2) + '%';
	}

	function fmtDate(dateStr: string): string {
		if (!dateStr) return '--';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getDebtTypeLabel(type: string): string {
		return debtTypes.find((t) => t.value === type)?.label ?? type;
	}

	function getDebtTypeColor(type: string): string {
		const colors: Record<string, string> = {
			credit_card: 'bg-red-500/20 text-red-400',
			student_loan: 'bg-blue-500/20 text-blue-400',
			auto_loan: 'bg-amber-500/20 text-amber-400',
			mortgage: 'bg-green-500/20 text-green-400',
			personal_loan: 'bg-purple-500/20 text-purple-400',
			medical: 'bg-pink-500/20 text-pink-400',
			other: 'bg-surface-500/20 text-surface-400'
		};
		return colors[type] || colors.other;
	}

	function getProgressColor(pct: number): string {
		if (pct >= 75) return 'bg-green-500';
		if (pct >= 50) return 'bg-primary-500';
		if (pct >= 25) return 'bg-yellow-500';
		return 'bg-orange-500';
	}

	function getMonthsText(months: number): string {
		if (months === 0) return 'Paid off';
		const years = Math.floor(months / 12);
		const remaining = months % 12;
		if (years === 0) return `${remaining} mo`;
		if (remaining === 0) return `${years} yr`;
		return `${years} yr ${remaining} mo`;
	}

	function getCountdown(dateStr: string): string {
		if (!dateStr) return '--';
		const now = new Date();
		const target = new Date(dateStr);
		const diffMs = target.getTime() - now.getTime();
		if (diffMs <= 0) return 'Already past';
		const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
		const years = Math.floor(days / 365);
		const remainingDays = days % 365;
		const months = Math.floor(remainingDays / 30);
		if (years === 0 && months === 0) return `${days} days`;
		if (years === 0) return `${months} months`;
		return `${years}y ${months}m`;
	}

	function openPaymentHistory(debt: any) {
		viewingPayments = debt;
		paymentHistory = [];
		loadingPayments = true;
		// The form action will populate paymentHistory via $effect
	}

	// Chart data for the timeline
	function getTimelineData(schedules: any[]) {
		if (!schedules || schedules.length === 0) return [];
		const maxMonths = Math.max(...schedules.map((s: any) => s.months?.length ?? 0));
		const points = [];
		for (let i = 0; i < maxMonths; i++) {
			const point: Record<string, any> = { month: i + 1 };
			let totalBalance = 0;
			for (const schedule of schedules) {
				const entry = schedule.months?.[i];
				const balance = entry ? entry.remainingBalance : 0;
				point[schedule.debtName] = balance;
				totalBalance += balance;
			}
			point.total = totalBalance;
			points.push(point);
		}
		return points;
	}

	const chartColors = [
		'#ef4444',
		'#3b82f6',
		'#f59e0b',
		'#22c55e',
		'#a855f7',
		'#ec4899',
		'#06b6d4',
		'#f97316'
	];
</script>

<svelte:head>
	<title>Debt Payoff Planner - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-white">Debt Payoff Planner</h2>
		<Button onclick={() => (showAddModal = true)}>Add Debt</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Summary Cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<p class="text-sm text-surface-400">Total Debt</p>
			<p class="mt-1 text-xl font-bold text-red-400">{fmt(data.summary.totalDebt)}</p>
			<p class="mt-1 text-xs text-surface-500">{data.summary.activeDebts} active debts</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Minimum Payments</p>
			<p class="mt-1 text-xl font-bold text-white">{fmt(data.summary.totalMinimumPayments)}</p>
			<p class="mt-1 text-xs text-surface-500">per month</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Weighted Avg APR</p>
			<p class="mt-1 text-xl font-bold text-amber-400">
				{fmtPct(data.summary.weightedAvgRate)}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Debt-Free Date</p>
			<p class="mt-1 text-xl font-bold text-green-400">
				{data.summary.estimatedPayoffDate ? fmtDate(data.summary.estimatedPayoffDate) : '--'}
			</p>
			<p class="mt-1 text-xs text-surface-500">
				{data.summary.estimatedPayoffMonths
					? getMonthsText(data.summary.estimatedPayoffMonths)
					: '--'} (min. payments only)
			</p>
		</Card>
	</div>

	<!-- Tab Navigation -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'debts'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'debts')}
		>
			My Debts
		</button>
		<button
			class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition {activeTab === 'strategy'
				? 'bg-primary-600 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeTab = 'strategy')}
		>
			Payoff Strategy
		</button>
	</div>

	<!-- Debts Tab -->
	{#if activeTab === 'debts'}
		{#if data.debts.length === 0}
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
					<p class="mt-4 text-lg text-surface-300">No debts added yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Add your debts to start building a payoff plan.
					</p>
				</div>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each data.debts as debt}
					<Card>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div>
									<div class="flex items-center gap-2">
										<p class="font-medium text-white">{debt.name}</p>
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium {getDebtTypeColor(
												debt.type
											)}"
										>
											{getDebtTypeLabel(debt.type)}
										</span>
										{#if debt.isPaidOff}
											<span
												class="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400"
											>
												Paid Off
											</span>
										{/if}
									</div>
									{#if debt.lender}
										<p class="text-xs text-surface-500">{debt.lender}</p>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-1">
								<button
									class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
									onclick={() => (payingDebt = debt)}
									title="Record payment"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</button>
								<form
									method="POST"
									action="?/loadPayments"
									use:enhance={() => {
										openPaymentHistory(debt);
										return async ({ update }) => {
											await update();
										};
									}}
									class="inline"
								>
									<input type="hidden" name="debtId" value={debt.id} />
									<button
										type="submit"
										class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
										title="View payments"
									>
										<svg
											class="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
											/>
										</svg>
									</button>
								</form>
								<button
									class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
									onclick={() => (editingDebt = debt)}
									title="Edit debt"
								>
									<svg
										class="h-4 w-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
										/>
									</svg>
								</button>
							</div>
						</div>

						<!-- Debt details row -->
						<div class="mt-3 grid grid-cols-3 gap-4">
							<div>
								<p class="text-xs text-surface-500">Balance</p>
								<p class="text-sm font-semibold text-white">{fmt(debt.currentBalance)}</p>
							</div>
							<div>
								<p class="text-xs text-surface-500">APR</p>
								<p class="text-sm font-semibold text-amber-400">{fmtPct(debt.interestRate)}</p>
							</div>
							<div>
								<p class="text-xs text-surface-500">Min. Payment</p>
								<p class="text-sm font-semibold text-white">{fmt(debt.minimumPayment)}/mo</p>
							</div>
						</div>

						<!-- Progress bar -->
						{#if debt.originalBalance && debt.originalBalance > 0}
							<div class="mt-3">
								<div class="flex items-end justify-between">
									<span class="text-xs text-surface-500">
										{fmt(debt.originalBalance - debt.currentBalance)} paid off of {fmt(
											debt.originalBalance
										)}
									</span>
									<span class="text-xs font-semibold text-primary-400">
										{debt.progress.toFixed(0)}%
									</span>
								</div>
								<div class="mt-1 h-2 overflow-hidden rounded-full bg-surface-700">
									<div
										class="{getProgressColor(debt.progress)} h-full rounded-full transition-all"
										style="width: {Math.min(debt.progress, 100)}%"
									></div>
								</div>
							</div>
						{/if}
					</Card>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Strategy Tab -->
	{#if activeTab === 'strategy'}
		{#if data.debts.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<p class="text-lg text-surface-300">Add debts first</p>
					<p class="mt-1 text-sm text-surface-500">
						You need at least one active debt to build a payoff strategy.
					</p>
				</div>
			</Card>
		{:else}
			<!-- Strategy Selector & Calculator -->
			<Card>
				<h3 class="text-lg font-semibold text-white">Payoff Strategy Calculator</h3>
				<p class="mt-1 text-sm text-surface-400">
					Choose a strategy and see how fast you can become debt-free.
				</p>

				<form
					method="POST"
					action="?/calculatePayoff"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
					class="mt-4 space-y-4"
				>
					<!-- Strategy tabs -->
					<div>
						<span class="block text-sm font-medium text-surface-300">Strategy</span>
						<div class="mt-2 flex gap-2">
							<button
								type="button"
								class="rounded-lg border px-4 py-2 text-sm font-medium transition {selectedStrategy ===
								'avalanche'
									? 'border-primary-500 bg-primary-500/20 text-primary-400'
									: 'border-surface-600 text-surface-400 hover:border-surface-500'}"
								onclick={() => (selectedStrategy = 'avalanche')}
							>
								Avalanche
							</button>
							<button
								type="button"
								class="rounded-lg border px-4 py-2 text-sm font-medium transition {selectedStrategy ===
								'snowball'
									? 'border-primary-500 bg-primary-500/20 text-primary-400'
									: 'border-surface-600 text-surface-400 hover:border-surface-500'}"
								onclick={() => (selectedStrategy = 'snowball')}
							>
								Snowball
							</button>
						</div>
						<input type="hidden" name="strategy" value={selectedStrategy} />
						<p class="mt-2 text-xs text-surface-500">
							{#if selectedStrategy === 'avalanche'}
								Targets highest interest rate first. Saves the most money on interest.
							{:else}
								Targets smallest balance first. Builds momentum with quick wins.
							{/if}
						</p>
					</div>

					<!-- Extra payment slider -->
					<div>
						<label for="extraPayment" class="block text-sm font-medium text-surface-300">
							Extra Monthly Payment: <span class="text-white">{fmt(extraPayment)}</span>
						</label>
						<input
							id="extraPayment"
							type="range"
							min="0"
							max="2000"
							step="25"
							bind:value={extraPayment}
							class="mt-2 w-full accent-primary-500"
						/>
						<div class="mt-1 flex justify-between text-xs text-surface-500">
							<span>$0</span>
							<span>$500</span>
							<span>$1,000</span>
							<span>$1,500</span>
							<span>$2,000</span>
						</div>
						<input type="hidden" name="extraMonthlyPayment" value={extraPayment} />
					</div>

					<Button type="submit" class="w-full">Calculate Payoff Plan</Button>
				</form>
			</Card>

			<!-- Results Section -->
			{#if showPayoffResults && strategyComparison}
				<!-- Strategy Comparison Table -->
				<Card>
					<h3 class="text-lg font-semibold text-white">Strategy Comparison</h3>
					<div class="mt-4 overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-surface-700">
									<th class="pb-3 text-left text-surface-400">Strategy</th>
									<th class="pb-3 text-right text-surface-400">Months</th>
									<th class="pb-3 text-right text-surface-400">Total Interest</th>
									<th class="pb-3 text-right text-surface-400">Interest Saved</th>
									<th class="pb-3 text-right text-surface-400">Debt-Free</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-surface-700/50">
								{#each [strategyComparison.avalanche, strategyComparison.snowball, strategyComparison.minimumOnly] as row}
									<tr
										class={row.strategy === selectedStrategy
											? 'bg-primary-500/10'
											: ''}
									>
										<td class="py-3 font-medium text-white capitalize">
											{row.strategy === 'minimum_only'
												? 'Minimum Only'
												: row.strategy}
											{#if row.strategy === selectedStrategy}
												<span
													class="ml-1 rounded bg-primary-500/20 px-1.5 py-0.5 text-xs text-primary-400"
												>
													Selected
												</span>
											{/if}
										</td>
										<td class="py-3 text-right text-white">
											{getMonthsText(row.totalMonths)}
										</td>
										<td class="py-3 text-right text-red-400">
											{fmt(row.totalInterest)}
										</td>
										<td class="py-3 text-right text-green-400">
											{row.interestSaved > 0 ? fmt(row.interestSaved) : '--'}
										</td>
										<td class="py-3 text-right text-surface-300">
											{fmtDate(row.debtFreeDate)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</Card>

				<!-- Debt-Free Countdown & Savings -->
				{#if payoffPlan}
					<div class="grid gap-4 sm:grid-cols-3">
						<Card>
							<p class="text-sm text-surface-400">Debt-Free Date</p>
							<p class="mt-1 text-xl font-bold text-green-400">
								{fmtDate(payoffPlan.debtFreeDate)}
							</p>
							<p class="mt-1 text-xs text-surface-500">
								{getCountdown(payoffPlan.debtFreeDate)} from now
							</p>
						</Card>
						<Card>
							<p class="text-sm text-surface-400">Total Interest</p>
							<p class="mt-1 text-xl font-bold text-red-400">
								{fmt(payoffPlan.totalInterest)}
							</p>
							<p class="mt-1 text-xs text-surface-500">
								of {fmt(payoffPlan.totalPaid)} total paid
							</p>
						</Card>
						<Card>
							<p class="text-sm text-surface-400">Interest Saved</p>
							<p class="mt-1 text-xl font-bold text-green-400">
								{fmt(payoffPlan.interestSavedVsMinimum)}
							</p>
							<p class="mt-1 text-xs text-surface-500">
								vs. minimum payments only ({getMonthsText(
									payoffPlan.minimumOnlyTotalMonths - payoffPlan.totalMonths
								)} faster)
							</p>
						</Card>
					</div>

					<!-- Payoff Timeline Chart (simplified bar visualization) -->
					{#if payoffPlan.schedules && payoffPlan.schedules.length > 0}
						<Card>
							<h3 class="text-lg font-semibold text-white">Payoff Timeline</h3>
							<p class="mt-1 text-sm text-surface-400">
								When each debt will be paid off
							</p>
							<div class="mt-4 space-y-3">
								{#each payoffPlan.schedules.sort((a: any, b: any) => a.payoffMonth - b.payoffMonth) as schedule, i}
									{@const widthPct =
										payoffPlan.totalMonths > 0
											? (schedule.payoffMonth / payoffPlan.totalMonths) * 100
											: 0}
									<div>
										<div class="flex items-center justify-between text-sm">
											<span class="text-white">{schedule.debtName}</span>
											<span class="text-surface-400">
												{getMonthsText(schedule.payoffMonth)}
											</span>
										</div>
										<div class="mt-1 h-4 overflow-hidden rounded-full bg-surface-700">
											<div
												class="h-full rounded-full transition-all"
												style="width: {widthPct}%; background-color: {chartColors[
													i % chartColors.length
												]}"
											></div>
										</div>
									</div>
								{/each}
							</div>
						</Card>

						<!-- Balance Over Time Chart -->
						<Card>
							<h3 class="text-lg font-semibold text-white">Balance Over Time</h3>
							<p class="mt-1 text-sm text-surface-400">
								Projected balances month by month
							</p>
							{@const timeline = getTimelineData(payoffPlan.schedules)}
							{@const maxBalance = timeline.length > 0 ? timeline[0].total : 1}
							<div class="mt-4">
								<!-- Simplified stacked area chart using bars -->
								<div class="flex items-end gap-px" style="height: 200px">
									{#each timeline as point, idx}
										{#if idx % Math.max(1, Math.floor(timeline.length / 60)) === 0}
											{@const heightPct =
												maxBalance > 0 ? (point.total / maxBalance) * 100 : 0}
											<div
												class="flex-1 rounded-t bg-gradient-to-t from-red-500/60 to-primary-500/60 transition-all hover:opacity-80"
												style="height: {heightPct}%"
												title="Month {point.month}: {fmt(point.total)} remaining"
											></div>
										{/if}
									{/each}
								</div>
								<div class="mt-2 flex justify-between text-xs text-surface-500">
									<span>Month 1</span>
									<span>Month {Math.floor(payoffPlan.totalMonths / 2)}</span>
									<span>Month {payoffPlan.totalMonths}</span>
								</div>
							</div>
						</Card>

						<!-- Month-by-Month Amortization (expandable per debt) -->
						<Card>
							<h3 class="text-lg font-semibold text-white">
								Month-by-Month Amortization
							</h3>
							<p class="mt-1 text-sm text-surface-400">
								Click a debt to expand its full payment schedule.
							</p>
							<div class="mt-4 space-y-2">
								{#each payoffPlan.schedules as schedule, i}
									<div class="rounded-lg border border-surface-700">
										<button
											class="flex w-full items-center justify-between p-3 text-left hover:bg-surface-700/50"
											onclick={() =>
												(expandedSchedule =
													expandedSchedule === schedule.debtId
														? null
														: schedule.debtId)}
										>
											<div class="flex items-center gap-3">
												<div
													class="h-3 w-3 rounded-full"
													style="background-color: {chartColors[
														i % chartColors.length
													]}"
												></div>
												<div>
													<p class="font-medium text-white">{schedule.debtName}</p>
													<p class="text-xs text-surface-500">
														{fmt(schedule.startingBalance)} at {fmtPct(
															schedule.interestRate
														)} -- Payoff in {getMonthsText(schedule.payoffMonth)}
													</p>
												</div>
											</div>
											<svg
												class="h-5 w-5 text-surface-400 transition-transform {expandedSchedule ===
												schedule.debtId
													? 'rotate-180'
													: ''}"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</button>
										{#if expandedSchedule === schedule.debtId}
											<div
												class="max-h-72 overflow-y-auto border-t border-surface-700 p-3"
											>
												<table class="w-full text-xs">
													<thead>
														<tr class="border-b border-surface-700">
															<th class="pb-2 text-left text-surface-400">Month</th>
															<th class="pb-2 text-right text-surface-400">
																Payment
															</th>
															<th class="pb-2 text-right text-surface-400">
																Principal
															</th>
															<th class="pb-2 text-right text-surface-400">
																Interest
															</th>
															<th class="pb-2 text-right text-surface-400">
																Balance
															</th>
														</tr>
													</thead>
													<tbody class="divide-y divide-surface-700/30">
														{#each schedule.months as entry}
															<tr>
																<td class="py-1.5 text-surface-300"
																	>{entry.month}</td
																>
																<td class="py-1.5 text-right text-white">
																	{fmt(entry.payment)}
																</td>
																<td class="py-1.5 text-right text-green-400">
																	{fmt(entry.principal)}
																</td>
																<td class="py-1.5 text-right text-red-400">
																	{fmt(entry.interest)}
																</td>
																<td class="py-1.5 text-right text-surface-300">
																	{fmt(entry.remainingBalance)}
																</td>
															</tr>
														{/each}
													</tbody>
													<tfoot class="border-t border-surface-600">
														<tr class="font-semibold">
															<td class="pt-2 text-white">Total</td>
															<td class="pt-2 text-right text-white">
																{fmt(schedule.totalPaid)}
															</td>
															<td class="pt-2 text-right text-green-400">
																{fmt(schedule.totalPaid - schedule.totalInterest)}
															</td>
															<td class="pt-2 text-right text-red-400">
																{fmt(schedule.totalInterest)}
															</td>
															<td class="pt-2 text-right text-surface-300">
																{fmt(0)}
															</td>
														</tr>
													</tfoot>
												</table>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</Card>
					{/if}
				{/if}
			{/if}
		{/if}
	{/if}
</div>

<!-- Add Debt Modal -->
<Modal open={showAddModal} onclose={() => (showAddModal = false)} title="Add Debt">
	<form
		method="POST"
		action="?/addDebt"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="debtName" class="block text-sm font-medium text-surface-300">Debt Name</label>
			<input
				id="debtName"
				name="name"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Chase Sapphire Card"
			/>
		</div>

		<div>
			<label for="debtType" class="block text-sm font-medium text-surface-300">Type</label>
			<select
				id="debtType"
				name="type"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				{#each debtTypes as dt}
					<option value={dt.value}>{dt.label}</option>
				{/each}
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="debtBalance" class="block text-sm font-medium text-surface-300"
					>Current Balance</label
				>
				<input
					id="debtBalance"
					name="currentBalance"
					type="number"
					step="0.01"
					min="0"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="5000.00"
				/>
			</div>
			<div>
				<label for="debtRate" class="block text-sm font-medium text-surface-300"
					>Interest Rate (APR %)</label
				>
				<input
					id="debtRate"
					name="interestRate"
					type="number"
					step="0.01"
					min="0"
					max="100"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="19.99"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="debtMinPayment" class="block text-sm font-medium text-surface-300"
					>Minimum Payment</label
				>
				<input
					id="debtMinPayment"
					name="minimumPayment"
					type="number"
					step="0.01"
					min="0"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="150.00"
				/>
			</div>
			<div>
				<label for="debtOrigBalance" class="block text-sm font-medium text-surface-300"
					>Original Balance (optional)</label
				>
				<input
					id="debtOrigBalance"
					name="originalBalance"
					type="number"
					step="0.01"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="10000.00"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="debtLender" class="block text-sm font-medium text-surface-300"
					>Lender (optional)</label
				>
				<input
					id="debtLender"
					name="lender"
					type="text"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Chase"
				/>
			</div>
			<div>
				<label for="debtDueDay" class="block text-sm font-medium text-surface-300"
					>Due Day (optional)</label
				>
				<input
					id="debtDueDay"
					name="dueDay"
					type="number"
					min="1"
					max="31"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="15"
				/>
			</div>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showAddModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Add Debt</Button>
		</div>
	</form>
</Modal>

<!-- Edit Debt Modal -->
<Modal open={editingDebt !== null} onclose={() => (editingDebt = null)} title="Edit Debt">
	{#if editingDebt}
		<form
			method="POST"
			action="?/updateDebt"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={editingDebt.id} />

			<div>
				<label for="editDebtName" class="block text-sm font-medium text-surface-300"
					>Debt Name</label
				>
				<input
					id="editDebtName"
					name="name"
					type="text"
					required
					value={editingDebt.name}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="editDebtType" class="block text-sm font-medium text-surface-300">Type</label>
				<select
					id="editDebtType"
					name="type"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					{#each debtTypes as dt}
						<option value={dt.value} selected={editingDebt.type === dt.value}>{dt.label}</option>
					{/each}
				</select>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="editDebtBalance" class="block text-sm font-medium text-surface-300"
						>Current Balance</label
					>
					<input
						id="editDebtBalance"
						name="currentBalance"
						type="number"
						step="0.01"
						min="0"
						required
						value={editingDebt.currentBalance}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
				<div>
					<label for="editDebtRate" class="block text-sm font-medium text-surface-300"
						>Interest Rate (APR %)</label
					>
					<input
						id="editDebtRate"
						name="interestRate"
						type="number"
						step="0.01"
						min="0"
						max="100"
						required
						value={editingDebt.interestRate}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="editDebtMinPayment" class="block text-sm font-medium text-surface-300"
						>Minimum Payment</label
					>
					<input
						id="editDebtMinPayment"
						name="minimumPayment"
						type="number"
						step="0.01"
						min="0"
						required
						value={editingDebt.minimumPayment}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
				<div>
					<label for="editDebtLender" class="block text-sm font-medium text-surface-300"
						>Lender</label
					>
					<input
						id="editDebtLender"
						name="lender"
						type="text"
						value={editingDebt.lender || ''}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (editingDebt = null)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>

		<form
			method="POST"
			action="?/deleteDebt"
			use:enhance
			class="mt-3 border-t border-surface-700 pt-3"
		>
			<input type="hidden" name="id" value={editingDebt.id} />
			<Button type="submit" variant="danger" size="sm">Delete Debt</Button>
		</form>
	{/if}
</Modal>

<!-- Record Payment Modal -->
<Modal
	open={payingDebt !== null}
	onclose={() => (payingDebt = null)}
	title="Record Payment"
>
	{#if payingDebt}
		<div class="mb-4 rounded-lg bg-surface-900 p-3">
			<p class="text-sm text-surface-400">Paying toward</p>
			<p class="font-medium text-white">{payingDebt.name}</p>
			<p class="text-xs text-surface-500">
				Balance: {fmt(payingDebt.currentBalance)} -- Min. payment: {fmt(
					payingDebt.minimumPayment
				)}/mo
			</p>
		</div>

		<form
			method="POST"
			action="?/recordPayment"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="debtId" value={payingDebt.id} />

			<div>
				<label for="paymentAmount" class="block text-sm font-medium text-surface-300"
					>Amount</label
				>
				<input
					id="paymentAmount"
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					required
					value={payingDebt.minimumPayment}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="paymentDate" class="block text-sm font-medium text-surface-300"
					>Date (optional)</label
				>
				<input
					id="paymentDate"
					name="date"
					type="date"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div class="flex items-center gap-2">
				<input
					id="paymentIsExtra"
					name="isExtra"
					type="checkbox"
					class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
				/>
				<label for="paymentIsExtra" class="text-sm text-surface-300">
					Extra payment (beyond minimum)
				</label>
			</div>

			<div>
				<label for="paymentNotes" class="block text-sm font-medium text-surface-300"
					>Notes (optional)</label
				>
				<input
					id="paymentNotes"
					name="notes"
					type="text"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Monthly payment"
				/>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (payingDebt = null)}>
					Cancel
				</Button>
				<Button type="submit">Record Payment</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Payment History Modal -->
<Modal
	open={viewingPayments !== null}
	onclose={() => (viewingPayments = null)}
	title={viewingPayments ? `Payment History: ${viewingPayments.name}` : 'Payment History'}
>
	{#if viewingPayments}
		<div class="mb-4 rounded-lg bg-surface-900 p-3">
			<div class="flex justify-between">
				<div>
					<p class="text-sm text-surface-400">Current Balance</p>
					<p class="text-lg font-bold text-white">{fmt(viewingPayments.currentBalance)}</p>
				</div>
				<div class="text-right">
					<p class="text-sm text-surface-400">APR</p>
					<p class="text-lg font-bold text-amber-400">{fmtPct(viewingPayments.interestRate)}</p>
				</div>
			</div>
		</div>

		{#if loadingPayments}
			<div class="flex justify-center py-8">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if paymentHistory.length > 0}
			<div class="max-h-72 space-y-2 overflow-y-auto">
				{#each paymentHistory as payment}
					<div class="flex items-center justify-between rounded-lg bg-surface-900 px-3 py-2">
						<div>
							<p class="text-sm font-medium text-white">
								{fmt(payment.amount)}
								{#if payment.isExtra}
									<span
										class="ml-1 rounded bg-primary-500/20 px-1.5 py-0.5 text-xs text-primary-400"
									>
										Extra
									</span>
								{/if}
							</p>
							<p class="text-xs text-surface-500">
								{fmtDate(payment.date)}
								{#if payment.notes}
									-- {payment.notes}
								{/if}
							</p>
						</div>
						<div class="text-right text-xs">
							{#if payment.principal !== null}
								<p class="text-green-400">Principal: {fmt(payment.principal)}</p>
							{/if}
							{#if payment.interest !== null}
								<p class="text-red-400">Interest: {fmt(payment.interest)}</p>
							{/if}
							{#if payment.balanceAfter !== null}
								<p class="text-surface-400">After: {fmt(payment.balanceAfter)}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="py-4 text-center text-sm text-surface-500">No payments recorded yet.</p>
		{/if}

		<!-- Quick action to record a payment -->
		<div class="mt-4 border-t border-surface-700 pt-3">
			<Button
				size="sm"
				onclick={() => {
					const d = viewingPayments;
					viewingPayments = null;
					payingDebt = d;
				}}
			>
				Record Payment
			</Button>
		</div>
	{/if}
</Modal>
