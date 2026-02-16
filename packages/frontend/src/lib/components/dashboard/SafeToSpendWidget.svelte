<script lang="ts">
	import { Card } from '$components/ui';

	interface SafeToSpendData {
		totalAvailable: number;
		upcomingBills: number;
		savingsAllocations: number;
		budgetRemaining: number;
		safeToSpend: number;
		daysLeftInMonth: number;
		dailyAllowance: number;
		lastCalculated: string;
	}

	interface AffordabilityResult {
		amount: number;
		canAfford: boolean;
		safeToSpend: number;
		remainingAfterPurchase: number;
		dailyAllowanceAfter: number;
		daysLeftInMonth: number;
		impact: 'none' | 'low' | 'medium' | 'high' | 'over_budget';
		recommendation: string;
	}

	interface Props {
		safeToSpend: SafeToSpendData | null;
	}

	let { safeToSpend }: Props = $props();

	let checkAmount = $state('');
	let checking = $state(false);
	let affordResult = $state<AffordabilityResult | null>(null);
	let showCalculator = $state(false);

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	async function checkAffordability() {
		const amount = parseFloat(checkAmount);
		if (isNaN(amount) || amount <= 0) return;

		checking = true;
		affordResult = null;

		try {
			const res = await fetch('/api/analytics/can-i-afford', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount })
			});

			if (res.ok) {
				affordResult = await res.json();
			}
		} catch {
			// silent fail
		} finally {
			checking = false;
		}
	}

	function getImpactColor(impact: string): string {
		switch (impact) {
			case 'low':
				return 'text-green-400';
			case 'medium':
				return 'text-yellow-400';
			case 'high':
				return 'text-orange-400';
			case 'over_budget':
				return 'text-red-400';
			default:
				return 'text-surface-400';
		}
	}

	function getImpactBgColor(impact: string): string {
		switch (impact) {
			case 'low':
				return 'bg-green-400/10';
			case 'medium':
				return 'bg-yellow-400/10';
			case 'high':
				return 'bg-orange-400/10';
			case 'over_budget':
				return 'bg-red-400/10';
			default:
				return 'bg-surface-700';
		}
	}

	const safeToSpendColor = $derived.by(() => {
		if (!safeToSpend) return 'text-surface-400';
		if (safeToSpend.safeToSpend <= 0) return 'text-red-400';
		if (safeToSpend.dailyAllowance < 20) return 'text-yellow-400';
		return 'text-green-400';
	});
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Safe to Spend</h3>
		<button
			type="button"
			class="rounded p-1 text-surface-500 transition hover:bg-surface-700 hover:text-primary-400"
			onclick={() => (showCalculator = !showCalculator)}
			aria-label="Toggle calculator"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
				/>
			</svg>
		</button>
	</div>

	{#if safeToSpend}
		<!-- Big number -->
		<p class="mt-2 text-3xl font-bold {safeToSpendColor}">
			{fmt(safeToSpend.safeToSpend)}
		</p>

		<!-- Daily allowance -->
		<div class="mt-1 flex items-center gap-2">
			<span class="text-sm text-surface-400">
				{fmt(safeToSpend.dailyAllowance)}/day
			</span>
			<span class="text-xs text-surface-500">
				({safeToSpend.daysLeftInMonth} day{safeToSpend.daysLeftInMonth !== 1 ? 's' : ''} left)
			</span>
		</div>

		<!-- Breakdown -->
		<div class="mt-3 space-y-1.5 border-t border-surface-700 pt-3">
			<div class="flex items-center justify-between text-xs">
				<span class="text-surface-500">Available cash</span>
				<span class="text-surface-300">{fmt(safeToSpend.totalAvailable)}</span>
			</div>
			{#if safeToSpend.upcomingBills > 0}
				<div class="flex items-center justify-between text-xs">
					<span class="text-surface-500">Upcoming bills</span>
					<span class="text-red-400">-{fmt(safeToSpend.upcomingBills)}</span>
				</div>
			{/if}
			{#if safeToSpend.savingsAllocations > 0}
				<div class="flex items-center justify-between text-xs">
					<span class="text-surface-500">Savings commitments</span>
					<span class="text-yellow-400">-{fmt(safeToSpend.savingsAllocations)}</span>
				</div>
			{/if}
			{#if safeToSpend.budgetRemaining > 0}
				<div class="flex items-center justify-between text-xs">
					<span class="text-surface-500">Budget commitments</span>
					<span class="text-blue-400">-{fmt(safeToSpend.budgetRemaining)}</span>
				</div>
			{/if}
		</div>

		<!-- Can I Afford Calculator -->
		{#if showCalculator}
			<div class="mt-3 border-t border-surface-700 pt-3">
				<p class="mb-2 text-xs font-medium text-surface-400">Can I Afford?</p>
				<div class="flex gap-2">
					<div class="relative flex-1">
						<span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-surface-500"
							>$</span
						>
						<input
							type="number"
							min="0"
							step="0.01"
							placeholder="0.00"
							bind:value={checkAmount}
							onkeydown={(e) => {
								if (e.key === 'Enter') checkAffordability();
							}}
							class="w-full rounded-lg border border-surface-700 bg-surface-800 py-1.5 pl-6 pr-2 text-sm text-white placeholder-surface-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<button
						type="button"
						disabled={checking || !checkAmount}
						onclick={checkAffordability}
						class="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-500 disabled:opacity-50"
					>
						{checking ? '...' : 'Check'}
					</button>
				</div>

				{#if affordResult}
					<div
						class="mt-2 rounded-lg p-2.5 {getImpactBgColor(affordResult.impact)}"
					>
						<div class="flex items-center gap-2">
							{#if affordResult.canAfford}
								<svg
									class="h-4 w-4 flex-shrink-0 text-green-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							{:else}
								<svg
									class="h-4 w-4 flex-shrink-0 text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							{/if}
							<p class="text-xs font-medium {getImpactColor(affordResult.impact)}">
								{affordResult.canAfford ? 'Yes, you can!' : 'Not recommended'}
							</p>
						</div>
						<p class="mt-1 text-xs text-surface-300">
							{affordResult.recommendation}
						</p>
						{#if affordResult.canAfford}
							<p class="mt-1 text-xs text-surface-500">
								Remaining: {fmt(affordResult.remainingAfterPurchase)} ({fmt(
									affordResult.dailyAllowanceAfter
								)}/day)
							</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-6 text-center">
			<svg
				class="h-8 w-8 text-surface-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">
				<a href="/accounts" class="text-primary-400 hover:text-primary-300">Link accounts</a>
				to see your safe-to-spend amount
			</p>
		</div>
	{/if}
</Card>
