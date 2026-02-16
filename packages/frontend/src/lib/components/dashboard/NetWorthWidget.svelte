<script lang="ts">
	import { Card } from '$components/ui';

	interface Props {
		netWorth: {
			assets: number;
			liabilities: number;
			netWorth: number;
			accountCount: number;
		};
		netWorthHistory: Array<{ date: string; netWorth: number }>;
	}

	let { netWorth, netWorthHistory }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	const trend = $derived.by(() => {
		if (netWorthHistory.length < 2) return null;
		const current = netWorthHistory[netWorthHistory.length - 1].netWorth;
		const previous = netWorthHistory[netWorthHistory.length - 2].netWorth;
		if (previous === 0) return null;
		const change = ((current - previous) / Math.abs(previous)) * 100;
		return { change, isPositive: change >= 0 };
	});
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Net Worth</h3>
		{#if trend}
			<span
				class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {trend.isPositive
					? 'bg-green-400/10 text-green-400'
					: 'bg-red-400/10 text-red-400'}"
			>
				<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
					{#if trend.isPositive}
						<path
							fill-rule="evenodd"
							d="M12 7a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 12.586V7z"
							clip-rule="evenodd"
							transform="rotate(180 10 10)"
						/>
					{:else}
						<path
							fill-rule="evenodd"
							d="M12 13a1 1 0 10-2 0V7.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L12 7.414V13z"
							clip-rule="evenodd"
							transform="rotate(180 10 10)"
						/>
					{/if}
				</svg>
				{trend.change >= 0 ? '+' : ''}{trend.change.toFixed(1)}%
			</span>
		{/if}
	</div>

	{#if netWorth.accountCount > 0}
		<p
			class="mt-2 text-2xl font-bold {netWorth.netWorth >= 0 ? 'text-white' : 'text-red-400'}"
		>
			{fmt(netWorth.netWorth)}
		</p>

		<div class="mt-3 space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-surface-400">Assets</span>
				<span class="text-xs font-medium text-green-400">{fmt(netWorth.assets)}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-xs text-surface-400">Liabilities</span>
				<span class="text-xs font-medium text-red-400">{fmt(netWorth.liabilities)}</span>
			</div>
		</div>

		{#if netWorthHistory.length > 1}
			<div class="mt-3">
				{#await import('$lib/components/charts/LineChart.svelte') then { default: LineChart }}
					<LineChart
						labels={netWorthHistory.slice(-7).map((h) =>
							new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						)}
						datasets={[
							{
								label: 'Net Worth',
								data: netWorthHistory.slice(-7).map((h) => h.netWorth),
								borderColor: '#3b82f6',
								fill: true
							}
						]}
						height={100}
					/>
				{/await}
			</div>
		{/if}
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
					d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">
				<a href="/accounts" class="text-primary-400 hover:text-primary-300">Link accounts</a>
				to see your net worth
			</p>
		</div>
	{/if}
</Card>
