<script lang="ts">
	import { Card } from '$components/ui';

	interface MonthlyTrend {
		month: string;
		income: number;
		spending: number;
	}

	interface Props {
		monthlyTrend: MonthlyTrend[];
	}

	let { monthlyTrend }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	const labels = $derived(
		monthlyTrend.map((t) => {
			const [y, m] = t.month.split('-');
			return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', {
				month: 'short'
			});
		})
	);

	const incomeData = $derived(monthlyTrend.map((t) => t.income));
	const spendingData = $derived(monthlyTrend.map((t) => t.spending));

	const currentMonth = $derived(
		monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null
	);

	const netCashFlow = $derived(
		currentMonth ? currentMonth.income - currentMonth.spending : 0
	);
</script>

<Card class="h-full">
	<h3 class="text-sm font-medium text-surface-400">Cash Flow</h3>

	{#if monthlyTrend.length > 0}
		{#if currentMonth}
			<div class="mt-2 flex items-baseline gap-2">
				<span
					class="text-lg font-bold {netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}"
				>
					{netCashFlow >= 0 ? '+' : ''}{fmt(netCashFlow)}
				</span>
				<span class="text-xs text-surface-500">this month</span>
			</div>
			<div class="mt-1 flex gap-4 text-xs">
				<span class="text-green-400">{fmt(currentMonth.income)} in</span>
				<span class="text-red-400">{fmt(currentMonth.spending)} out</span>
			</div>
		{/if}

		<div class="mt-3">
			{#await import('$lib/components/charts/BarChart.svelte') then { default: BarChart }}
				<BarChart
					{labels}
					datasets={[
						{ label: 'Income', data: incomeData, backgroundColor: '#22c55e' },
						{ label: 'Spending', data: spendingData, backgroundColor: '#ef4444' }
					]}
					height={120}
				/>
			{/await}
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
					d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-7.5L16.5 3m0 0L12 7.5M16.5 3v13.5"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">Need more data for cash flow trends</p>
		</div>
	{/if}
</Card>
