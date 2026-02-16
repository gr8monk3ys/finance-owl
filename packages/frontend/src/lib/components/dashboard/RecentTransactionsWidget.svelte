<script lang="ts">
	import { Card } from '$components/ui';

	interface Transaction {
		name: string;
		merchantName: string | null;
		amount: number;
		date: string;
		categoryName?: string;
		categoryColor?: string;
	}

	interface Props {
		transactions: Transaction[];
	}

	let { transactions }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	const recentTx = $derived(transactions.slice(0, 7));
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Recent Transactions</h3>
		<a href="/transactions" class="text-xs text-primary-400 hover:text-primary-300">View all</a>
	</div>

	{#if recentTx.length > 0}
		<div class="mt-2 divide-y divide-surface-700">
			{#each recentTx as tx}
				<div class="flex items-center justify-between py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs font-medium text-white">
							{tx.merchantName || tx.name}
						</p>
						<p class="text-xs text-surface-500">
							{formatDate(tx.date)}
							{#if tx.categoryName}
								<span style="color: {tx.categoryColor}"> · {tx.categoryName}</span>
							{/if}
						</p>
					</div>
					<span
						class="ml-2 text-xs font-semibold {tx.amount < 0
							? 'text-green-400'
							: 'text-white'}"
					>
						{fmt(tx.amount)}
					</span>
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
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">No transactions yet</p>
		</div>
	{/if}
</Card>
