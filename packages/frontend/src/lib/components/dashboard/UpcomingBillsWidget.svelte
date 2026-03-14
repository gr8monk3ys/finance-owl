<script lang="ts">
	import { Card } from '$components/ui';

	interface Bill {
		name: string;
		merchantName?: string;
		estimatedAmount: number;
		expectedDate: string;
		categoryName?: string;
		categoryColor?: string;
	}

	interface Props {
		bills: Bill[];
	}

	let { bills }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	const todayStr = new Date().toISOString().split('T')[0];

	function daysUntil(dateStr: string): number {
		const target = new Date(dateStr + 'T00:00:00');
		const today = new Date(todayStr + 'T00:00:00');
		return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function formatDueLabel(dateStr: string): string {
		const days = daysUntil(dateStr);
		if (days < 0) return `${Math.abs(days)}d overdue`;
		if (days === 0) return 'Due today';
		if (days === 1) return 'Due tomorrow';
		return `in ${days} days`;
	}

	const upcomingBills = $derived(bills.slice(0, 5));
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Upcoming Bills</h3>
		<a href="/bills" class="text-xs text-primary-400 hover:text-primary-300">View all</a>
	</div>

	{#if upcomingBills.length > 0}
		<div class="mt-2 divide-y divide-surface-700">
			{#each upcomingBills as bill}
				{@const days = daysUntil(bill.expectedDate)}
				<div class="flex items-center justify-between py-2">
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs font-medium text-white">
							{bill.merchantName || bill.name}
						</p>
						<p
							class="text-xs {days < 0
								? 'text-red-400'
								: days <= 3
									? 'text-amber-400'
									: 'text-surface-300'}"
						>
							{formatDueLabel(bill.expectedDate)}
						</p>
					</div>
					<span class="ml-2 text-xs font-semibold text-white">
						{fmt(bill.estimatedAmount)}
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
					d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-400">No upcoming bills</p>
		</div>
	{/if}
</Card>
