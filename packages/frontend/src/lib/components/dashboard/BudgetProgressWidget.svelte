<script lang="ts">
	import { Card } from '$components/ui';

	interface Budget {
		categoryName: string | null;
		categoryColor: string | null;
		amount: number;
		spent: number;
		remaining: number;
		percentUsed: number;
	}

	interface Props {
		budgets: Budget[] | null;
	}

	let { budgets }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	const topBudgets = $derived(
		budgets ? budgets.slice(0, 5) : []
	);
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Budget Progress</h3>
		<a href="/budgets" class="text-xs text-primary-400 hover:text-primary-300">View all</a>
	</div>

	{#if topBudgets.length > 0}
		<div class="mt-3 space-y-3">
			{#each topBudgets as budget}
				<div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-surface-300">
							{budget.categoryName || 'Uncategorized'}
						</span>
						<span class="text-xs text-surface-400">
							{fmt(budget.spent)} / {fmt(budget.amount)}
						</span>
					</div>
					<div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-700">
						<div
							class="h-full rounded-full transition-all duration-300"
							style="width: {Math.min(budget.percentUsed, 100)}%;
								background-color: {budget.percentUsed > 100
								? '#ef4444'
								: budget.percentUsed > 80
									? '#f59e0b'
									: budget.categoryColor || '#3b82f6'}"
						></div>
					</div>
					{#if budget.percentUsed > 100}
						<p class="mt-0.5 text-xs text-red-400">
							Over by {fmt(budget.spent - budget.amount)}
						</p>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
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
					d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">
				<a href="/budgets" class="text-primary-400 hover:text-primary-300">Set up budgets</a>
				to track spending
			</p>
		</div>
	{/if}
</Card>
