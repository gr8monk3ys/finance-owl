<script lang="ts">
	import { Card, Button, Modal, Input } from '$components/ui';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Tab state
	let activeTab = $state<'holdings' | 'transactions' | 'watchlist'>('holdings');

	// Modal states
	let showAddHolding = $state(false);
	let showEditHolding = $state(false);
	let showRecordTx = $state(false);
	let showAddWatchlist = $state(false);
	let showPriceChart = $state(false);
	let showDeleteConfirm = $state(false);

	// Selected items
	let selectedHolding = $state<any>(null);
	let selectedChartSymbol = $state('');
	let selectedChartName = $state('');
	let chartPeriod = $state(30);
	let chartData = $state<Array<[number, number]>>([]);
	let chartLoading = $state(false);
	let deleteHoldingId = $state('');

	// Form states
	let addCoinSearch = $state('');
	let selectedCoin = $state<{ symbol: string; name: string; id: string } | null>(null);
	let txHoldingId = $state('');
	let txCoinForAdd = $state<{ symbol: string; name: string } | null>(null);
	let watchlistSymbol = $state('');
	let watchlistName = $state('');

	// Sorting
	let sortField = $state<string>('value');
	let sortDir = $state<'asc' | 'desc'>('desc');

	// Refresh loading state
	let refreshing = $state(false);

	// Filtered coins for search
	const filteredCoins = $derived(
		addCoinSearch.length > 0
			? (data.coins || []).filter(
					(c: any) =>
						c.symbol.toLowerCase().includes(addCoinSearch.toLowerCase()) ||
						c.name.toLowerCase().includes(addCoinSearch.toLowerCase())
				)
			: (data.coins || []).slice(0, 20)
	);

	// Sorted holdings
	const sortedHoldings = $derived(() => {
		const holdings = [...(data.holdings || [])];
		holdings.sort((a: any, b: any) => {
			let aVal: number, bVal: number;
			switch (sortField) {
				case 'symbol':
					return sortDir === 'asc'
						? a.symbol.localeCompare(b.symbol)
						: b.symbol.localeCompare(a.symbol);
				case 'quantity':
					aVal = a.quantity;
					bVal = b.quantity;
					break;
				case 'price':
					aVal = a.currentPrice || 0;
					bVal = b.currentPrice || 0;
					break;
				case 'gainLoss':
					aVal = a.gainLoss || 0;
					bVal = b.gainLoss || 0;
					break;
				case 'value':
				default:
					aVal = a.currentValue || a.totalCost;
					bVal = b.currentValue || b.totalCost;
					break;
			}
			return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
		});
		return holdings;
	});

	// Portfolio summary
	const portfolio = $derived(data.portfolio);

	// Allocation chart data
	const allocationLabels = $derived(
		(portfolio?.allocation || []).map((a: any) => `${a.symbol} (${a.percentage.toFixed(1)}%)`)
	);
	const allocationData = $derived((portfolio?.allocation || []).map((a: any) => a.value));
	const allocationColors = $derived(
		(portfolio?.allocation || []).map((_: any, i: number) => {
			const colors = [
				'#f7931a', // Bitcoin orange
				'#627eea', // Ethereum blue
				'#00d4aa', // Teal
				'#8b5cf6', // Purple
				'#ef4444', // Red
				'#eab308', // Yellow
				'#ec4899', // Pink
				'#06b6d4', // Cyan
				'#f97316', // Orange
				'#22c55e', // Green
				'#a855f7', // Violet
				'#64748b' // Slate
			];
			return colors[i % colors.length];
		})
	);

	// Helpers
	function formatCurrency(value: number | null | undefined): string {
		if (value == null) return '--';
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}

	function formatCryptoPrice(value: number | null | undefined): string {
		if (value == null) return '--';
		if (value >= 1) {
			return value.toLocaleString('en-US', {
				style: 'currency',
				currency: 'USD',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		}
		return value.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 6
		});
	}

	function formatPercent(value: number | null | undefined): string {
		if (value == null) return '--';
		const sign = value >= 0 ? '+' : '';
		return `${sign}${value.toFixed(2)}%`;
	}

	function formatQuantity(value: number): string {
		if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
		return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatTimestamp(dateStr: string | null | undefined): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function gainLossClass(value: number | null | undefined): string {
		if (value == null || value === 0) return 'text-surface-400';
		return value > 0 ? 'text-green-400' : 'text-red-400';
	}

	function toggleSort(field: string) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'desc';
		}
	}

	function sortIndicator(field: string): string {
		if (sortField !== field) return '';
		return sortDir === 'asc' ? ' \u2191' : ' \u2193';
	}

	// Open price chart
	async function openPriceChart(symbol: string, name: string) {
		selectedChartSymbol = symbol;
		selectedChartName = name;
		showPriceChart = true;
		await loadChartData(chartPeriod);
	}

	async function loadChartData(days: number) {
		chartPeriod = days;
		chartLoading = true;
		try {
			const res = await fetch(`/api/crypto/price-history/${selectedChartSymbol}?days=${days}`);
			if (res.ok) {
				const result = await res.json();
				chartData = result.prices || [];
			}
		} catch {
			chartData = [];
		}
		chartLoading = false;
	}

	// Chart labels/data for price history
	const priceChartLabels = $derived(
		chartData.map((p: [number, number]) => {
			const d = new Date(p[0]);
			if (chartPeriod <= 7)
				return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			if (chartPeriod <= 90)
				return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
		})
	);
	const priceChartData = $derived(chartData.map((p: [number, number]) => p[1]));

	// Open add holding with pre-selected coin from watchlist
	function openAddFromWatchlist(symbol: string, name: string) {
		const coin = (data.coins || []).find(
			(c: any) => c.symbol.toUpperCase() === symbol.toUpperCase()
		);
		if (coin) {
			selectedCoin = coin;
		} else {
			selectedCoin = { symbol, name, id: symbol.toLowerCase() };
		}
		showAddHolding = true;
	}

	// Open record transaction with pre-selected holding
	function openRecordTx(holdingId?: string) {
		txHoldingId = holdingId || '';
		showRecordTx = true;
	}

	// Open edit holding modal
	function openEditHolding(holding: any) {
		selectedHolding = holding;
		showEditHolding = true;
	}

	// Open delete confirm
	function openDeleteConfirm(holdingId: string) {
		deleteHoldingId = holdingId;
		showDeleteConfirm = true;
	}

	// Handle form successes
	$effect(() => {
		if (form && 'success' in form && form.success) {
			showAddHolding = false;
			showEditHolding = false;
			showRecordTx = false;
			showAddWatchlist = false;
			showDeleteConfirm = false;
			selectedCoin = null;
			addCoinSearch = '';
		}
	});

	$effect(() => {
		if (form && 'refreshed' in form) {
			refreshing = false;
		}
	});

	// Transaction type labels
	function txTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			buy: 'Buy',
			sell: 'Sell',
			transfer: 'Transfer',
			staking_reward: 'Staking Reward',
			airdrop: 'Airdrop'
		};
		return labels[type] || type;
	}

	function txTypeColor(type: string): string {
		switch (type) {
			case 'buy':
				return 'text-green-400 bg-green-400/10';
			case 'sell':
				return 'text-red-400 bg-red-400/10';
			case 'transfer':
				return 'text-blue-400 bg-blue-400/10';
			case 'staking_reward':
				return 'text-purple-400 bg-purple-400/10';
			case 'airdrop':
				return 'text-yellow-400 bg-yellow-400/10';
			default:
				return 'text-surface-400 bg-surface-400/10';
		}
	}

	// Get the last price update from the most recently updated holding
	const lastPriceUpdate = $derived(() => {
		const holdings = data.holdings || [];
		if (holdings.length === 0) return null;
		const sorted = [...holdings].sort((a: any, b: any) => {
			if (!a.lastPriceUpdate) return 1;
			if (!b.lastPriceUpdate) return -1;
			return new Date(b.lastPriceUpdate).getTime() - new Date(a.lastPriceUpdate).getTime();
		});
		return sorted[0]?.lastPriceUpdate || null;
	});
</script>

<svelte:head>
	<title>Crypto Portfolio - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-white">Crypto Portfolio</h2>
		<div class="flex items-center gap-2">
			<form
				method="POST"
				action="?/refreshPrices"
				use:enhance={() => {
					refreshing = true;
					return async ({ update }) => {
						await update();
						refreshing = false;
					};
				}}
			>
				<Button type="submit" variant="secondary" size="sm" loading={refreshing}>
					{#if !refreshing}
						<svg
							class="mr-1.5 h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					{/if}
					Refresh Prices
				</Button>
			</form>
			<Button size="sm" onclick={() => (showAddHolding = true)}>
				<svg
					class="mr-1.5 h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Holding
			</Button>
		</div>
	</div>

	<!-- Last updated -->
	{#if lastPriceUpdate()}
		<p class="text-xs text-surface-500">
			Prices last updated: {formatTimestamp(lastPriceUpdate())}
		</p>
	{/if}

	<!-- Summary Cards -->
	{#if portfolio}
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
			<Card>
				<p class="text-xs font-medium uppercase tracking-wider text-surface-400">
					Portfolio Value
				</p>
				<p class="mt-1 text-2xl font-bold text-white">
					{formatCurrency(portfolio.totalValue)}
				</p>
			</Card>
			<Card>
				<p class="text-xs font-medium uppercase tracking-wider text-surface-400">Total Cost</p>
				<p class="mt-1 text-2xl font-bold text-surface-300">
					{formatCurrency(portfolio.totalCost)}
				</p>
			</Card>
			<Card>
				<p class="text-xs font-medium uppercase tracking-wider text-surface-400">
					Total Gain/Loss
				</p>
				<p class="mt-1 text-2xl font-bold {gainLossClass(portfolio.totalGainLoss)}">
					{formatCurrency(portfolio.totalGainLoss)}
				</p>
				<p class="mt-0.5 text-sm {gainLossClass(portfolio.totalGainLossPercent)}">
					{formatPercent(portfolio.totalGainLossPercent)}
				</p>
			</Card>
			<Card>
				<p class="text-xs font-medium uppercase tracking-wider text-surface-400">Assets</p>
				<p class="mt-1 text-2xl font-bold text-white">{portfolio.numberOfAssets}</p>
			</Card>
		</div>
	{/if}

	<!-- Allocation Chart -->
	{#if portfolio && portfolio.allocation && portfolio.allocation.length > 0}
		<div class="grid gap-6 lg:grid-cols-2">
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Portfolio Allocation</h3>
				{#await import('$lib/components/charts/DonutChart.svelte') then { default: DonutChart }}
					<DonutChart
						labels={allocationLabels}
						data={allocationData}
						colors={allocationColors}
						height={250}
					/>
				{/await}
				<!-- Legend -->
				<div class="mt-4 flex flex-wrap gap-3">
					{#each portfolio.allocation as item, i}
						<div class="flex items-center gap-1.5">
							<span
								class="h-3 w-3 rounded-full"
								style="background-color: {allocationColors[i]}"
							></span>
							<span class="text-xs text-surface-300">
								{item.symbol} - {formatCurrency(item.value)}
							</span>
						</div>
					{/each}
				</div>
			</Card>

			<!-- Quick Stats -->
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Top Holdings</h3>
				<div class="space-y-3">
					{#each (portfolio.allocation || []).slice(0, 5) as item}
						<div class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-3">
							<div class="flex items-center gap-3">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
								>
									{item.symbol.slice(0, 3)}
								</div>
								<div>
									<p class="text-sm font-medium text-white">{item.symbol}</p>
									<p class="text-xs text-surface-400">{item.percentage.toFixed(1)}% of portfolio</p>
								</div>
							</div>
							<p class="text-sm font-medium text-white">{formatCurrency(item.value)}</p>
						</div>
					{/each}
				</div>
			</Card>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="border-b border-surface-700">
		<nav class="-mb-px flex gap-6">
			{#each [
				{ id: 'holdings', label: 'Holdings' },
				{ id: 'transactions', label: 'Transactions' },
				{ id: 'watchlist', label: 'Watchlist' }
			] as tab}
				<button
					class="whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition {activeTab ===
					tab.id
						? 'border-primary-500 text-primary-400'
						: 'border-transparent text-surface-400 hover:border-surface-600 hover:text-surface-300'}"
					onclick={() => (activeTab = tab.id as typeof activeTab)}
				>
					{tab.label}
					{#if tab.id === 'holdings'}
						<span
							class="ml-1.5 rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-300"
						>
							{(data.holdings || []).length}
						</span>
					{:else if tab.id === 'transactions'}
						<span
							class="ml-1.5 rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-300"
						>
							{(data.transactions || []).length}
						</span>
					{:else if tab.id === 'watchlist'}
						<span
							class="ml-1.5 rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-300"
						>
							{(data.watchlist || []).length}
						</span>
					{/if}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Holdings Tab -->
	{#if activeTab === 'holdings'}
		{#if (data.holdings || []).length > 0}
			<!-- Desktop table -->
			<div class="hidden overflow-x-auto lg:block">
				<Card padding="none">
					<table class="w-full">
						<thead>
							<tr class="border-b border-surface-700 text-left text-xs font-medium uppercase tracking-wider text-surface-400">
								<th class="px-6 py-3">
									<button class="hover:text-white" onclick={() => toggleSort('symbol')}>
										Coin{sortIndicator('symbol')}
									</button>
								</th>
								<th class="px-6 py-3">
									<button class="hover:text-white" onclick={() => toggleSort('quantity')}>
										Quantity{sortIndicator('quantity')}
									</button>
								</th>
								<th class="px-6 py-3">
									<button class="hover:text-white" onclick={() => toggleSort('price')}>
										Price{sortIndicator('price')}
									</button>
								</th>
								<th class="px-6 py-3">
									<button class="hover:text-white" onclick={() => toggleSort('value')}>
										Value{sortIndicator('value')}
									</button>
								</th>
								<th class="px-6 py-3">
									<button class="hover:text-white" onclick={() => toggleSort('gainLoss')}>
										Gain/Loss{sortIndicator('gainLoss')}
									</button>
								</th>
								<th class="px-6 py-3">% of Portfolio</th>
								<th class="px-6 py-3">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-700">
							{#each sortedHoldings() as holding}
								{@const portfolioPercent =
									portfolio && portfolio.totalValue > 0
										? (((holding.currentValue || holding.totalCost) / portfolio.totalValue) * 100)
										: 0}
								<tr class="transition hover:bg-surface-700/50">
									<td class="px-6 py-4">
										<div class="flex items-center gap-3">
											<div
												class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
											>
												{holding.symbol.slice(0, 3)}
											</div>
											<div>
												<p class="font-medium text-white">{holding.symbol}</p>
												<p class="text-xs text-surface-400">{holding.name}</p>
											</div>
										</div>
									</td>
									<td class="px-6 py-4 text-sm text-surface-300">
										{formatQuantity(holding.quantity)}
									</td>
									<td class="px-6 py-4">
										<button
											class="text-sm text-surface-300 hover:text-primary-400 hover:underline"
											onclick={() => openPriceChart(holding.symbol, holding.name)}
										>
											{formatCryptoPrice(holding.currentPrice)}
										</button>
									</td>
									<td class="px-6 py-4 text-sm font-medium text-white">
										{formatCurrency(holding.currentValue ?? holding.totalCost)}
									</td>
									<td class="px-6 py-4">
										<p class="text-sm font-medium {gainLossClass(holding.gainLoss)}">
											{formatCurrency(holding.gainLoss)}
										</p>
										<p class="text-xs {gainLossClass(holding.gainLossPercent)}">
											{formatPercent(holding.gainLossPercent)}
										</p>
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center gap-2">
											<div class="h-2 w-16 rounded-full bg-surface-700">
												<div
													class="h-2 rounded-full bg-primary-500"
													style="width: {Math.min(portfolioPercent, 100)}%"
												></div>
											</div>
											<span class="text-xs text-surface-400">
												{portfolioPercent.toFixed(1)}%
											</span>
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="flex items-center gap-1">
											<button
												class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
												title="Record transaction"
												onclick={() => openRecordTx(holding.id)}
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
														d="M12 4v16m8-8H4"
													/>
												</svg>
											</button>
											<button
												class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
												title="Edit holding"
												onclick={() => openEditHolding(holding)}
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
											<button
												class="rounded p-1 text-surface-400 hover:bg-red-500/10 hover:text-red-400"
												title="Delete holding"
												onclick={() => openDeleteConfirm(holding.id)}
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
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</Card>
			</div>

			<!-- Mobile cards -->
			<div class="space-y-3 lg:hidden">
				{#each sortedHoldings() as holding}
					{@const portfolioPercent =
						portfolio && portfolio.totalValue > 0
							? (((holding.currentValue || holding.totalCost) / portfolio.totalValue) * 100)
							: 0}
					<Card>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-600 text-sm font-bold text-white"
								>
									{holding.symbol.slice(0, 3)}
								</div>
								<div>
									<p class="font-medium text-white">{holding.symbol}</p>
									<p class="text-xs text-surface-400">{holding.name}</p>
								</div>
							</div>
							<div class="text-right">
								<p class="font-medium text-white">
									{formatCurrency(holding.currentValue ?? holding.totalCost)}
								</p>
								<p class="text-xs {gainLossClass(holding.gainLoss)}">
									{formatCurrency(holding.gainLoss)}
									({formatPercent(holding.gainLossPercent)})
								</p>
							</div>
						</div>
						<div class="mt-3 grid grid-cols-3 gap-3 border-t border-surface-700 pt-3">
							<div>
								<p class="text-xs text-surface-500">Qty</p>
								<p class="text-sm text-surface-300">{formatQuantity(holding.quantity)}</p>
							</div>
							<div>
								<p class="text-xs text-surface-500">Price</p>
								<button
									class="text-sm text-surface-300 hover:text-primary-400"
									onclick={() => openPriceChart(holding.symbol, holding.name)}
								>
									{formatCryptoPrice(holding.currentPrice)}
								</button>
							</div>
							<div>
								<p class="text-xs text-surface-500">Portfolio</p>
								<p class="text-sm text-surface-300">{portfolioPercent.toFixed(1)}%</p>
							</div>
						</div>
						<div class="mt-3 flex gap-2 border-t border-surface-700 pt-3">
							<Button
								size="sm"
								variant="ghost"
								onclick={() => openRecordTx(holding.id)}
							>
								Transaction
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => openEditHolding(holding)}
							>
								Edit
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onclick={() => openDeleteConfirm(holding.id)}
								class="text-red-400"
							>
								Delete
							</Button>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<!-- Empty state -->
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
					<p class="mt-4 text-lg text-surface-300">No crypto holdings yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Add your first cryptocurrency holding to start tracking your portfolio.
					</p>
					<div class="mt-4">
						<Button onclick={() => (showAddHolding = true)}>Add Your First Holding</Button>
					</div>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Transactions Tab -->
	{#if activeTab === 'transactions'}
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-white">Transaction History</h3>
			<Button size="sm" onclick={() => openRecordTx()}>Record Transaction</Button>
		</div>

		{#if (data.transactions || []).length > 0}
			<Card padding="none">
				<div class="divide-y divide-surface-700">
					{#each data.transactions as tx}
						{@const holding = (data.holdings || []).find((h: any) => h.id === tx.holdingId)}
						<div class="flex items-center justify-between px-6 py-4">
							<div class="flex items-center gap-4">
								<span
									class="rounded-full px-2.5 py-1 text-xs font-medium {txTypeColor(tx.type)}"
								>
									{txTypeLabel(tx.type)}
								</span>
								<div>
									<p class="text-sm font-medium text-white">
										{holding ? `${holding.symbol} - ${holding.name}` : 'Unknown'}
									</p>
									<p class="text-xs text-surface-400">
										{formatQuantity(tx.quantity)} @ {formatCryptoPrice(tx.pricePerUnit)}
										{#if tx.fee}
											<span class="text-surface-500">
												(fee: {formatCurrency(tx.fee)})
											</span>
										{/if}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p
									class="text-sm font-medium {tx.type === 'sell'
										? 'text-green-400'
										: 'text-white'}"
								>
									{tx.type === 'sell' ? '+' : '-'}{formatCurrency(tx.totalValue)}
								</p>
								<p class="text-xs text-surface-400">{formatDate(tx.date)}</p>
								{#if tx.txHash}
									<p class="mt-0.5 text-xs text-surface-500" title={tx.txHash}>
										TX: {tx.txHash.slice(0, 8)}...
									</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{:else}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg
						class="h-12 w-12 text-surface-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
					<p class="mt-3 text-sm text-surface-400">No transactions recorded yet.</p>
					<div class="mt-3">
						<Button size="sm" onclick={() => openRecordTx()}>
							Record First Transaction
						</Button>
					</div>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Watchlist Tab -->
	{#if activeTab === 'watchlist'}
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-white">Watchlist</h3>
			<Button size="sm" onclick={() => (showAddWatchlist = true)}>
				<svg
					class="mr-1.5 h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add to Watchlist
			</Button>
		</div>

		{#if (data.watchlist || []).length > 0}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.watchlist as item}
					<Card>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-600 text-sm font-bold text-white"
								>
									{item.symbol.slice(0, 3)}
								</div>
								<div>
									<p class="font-medium text-white">{item.symbol}</p>
									<p class="text-xs text-surface-400">{item.name}</p>
								</div>
							</div>
							<form method="POST" action="?/removeFromWatchlist" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<button
									type="submit"
									class="rounded p-1 text-surface-400 hover:bg-red-500/10 hover:text-red-400"
									title="Remove from watchlist"
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
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</form>
						</div>
						<div class="mt-3 flex items-end justify-between border-t border-surface-700 pt-3">
							<div>
								<p class="text-xs text-surface-500">Current Price</p>
								<p class="text-lg font-medium text-white">
									{formatCryptoPrice(item.currentPrice)}
								</p>
								{#if item.change24h != null}
									<p class="text-xs {gainLossClass(item.change24h)}">
										24h: {formatPercent(item.change24h)}
									</p>
								{/if}
							</div>
							<Button
								size="sm"
								variant="secondary"
								onclick={() => openAddFromWatchlist(item.symbol, item.name)}
							>
								Buy
							</Button>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg
						class="h-12 w-12 text-surface-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
					<p class="mt-3 text-sm text-surface-400">
						Your watchlist is empty. Add coins to keep an eye on their price.
					</p>
					<div class="mt-3">
						<Button size="sm" onclick={() => (showAddWatchlist = true)}>
							Add First Coin
						</Button>
					</div>
				</div>
			</Card>
		{/if}
	{/if}
</div>

<!-- Add Holding Modal -->
<Modal open={showAddHolding} onclose={() => { showAddHolding = false; selectedCoin = null; addCoinSearch = ''; }} title="Add Crypto Holding">
	<form method="POST" action="?/addHolding" use:enhance>
		<div class="space-y-4">
			{#if !selectedCoin}
				<!-- Coin search -->
				<div>
					<label for="coinSearch" class="block text-sm font-medium text-surface-300">
						Search Coin
					</label>
					<input
						id="coinSearch"
						type="text"
						bind:value={addCoinSearch}
						placeholder="Search by name or symbol..."
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
				<div class="max-h-48 overflow-y-auto rounded-lg border border-surface-700">
					{#each filteredCoins as coin}
						<button
							type="button"
							class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-700"
							onclick={() => {
								selectedCoin = coin;
								addCoinSearch = '';
							}}
						>
							<div
								class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
							>
								{coin.symbol.slice(0, 2)}
							</div>
							<div>
								<p class="text-sm font-medium text-white">{coin.name}</p>
								<p class="text-xs text-surface-400">{coin.symbol}</p>
							</div>
						</button>
					{/each}
					{#if filteredCoins.length === 0}
						<p class="px-4 py-3 text-sm text-surface-400">No coins found.</p>
					{/if}
				</div>
			{:else}
				<!-- Selected coin info -->
				<div
					class="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-700/50 px-4 py-3"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
						>
							{selectedCoin.symbol.slice(0, 2)}
						</div>
						<div>
							<p class="text-sm font-medium text-white">{selectedCoin.name}</p>
							<p class="text-xs text-surface-400">{selectedCoin.symbol}</p>
						</div>
					</div>
					<button
						type="button"
						class="text-sm text-primary-400 hover:text-primary-300"
						onclick={() => (selectedCoin = null)}
					>
						Change
					</button>
				</div>

				<input type="hidden" name="symbol" value={selectedCoin.symbol} />
				<input type="hidden" name="name" value={selectedCoin.name} />

				<Input
					id="quantity"
					name="quantity"
					label="Quantity"
					type="number"
					step="any"
					min="0"
					placeholder="0.00"
					required
				/>

				<Input
					id="averageCostBasis"
					name="averageCostBasis"
					label="Average Cost Basis (USD per unit)"
					type="number"
					step="any"
					min="0"
					placeholder="0.00"
					required
				/>

				<div>
					<label for="exchange" class="block text-sm font-medium text-surface-300">
						Exchange
					</label>
					<select
						id="exchange"
						name="exchange"
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="manual">Manual Entry</option>
						<option value="coinbase">Coinbase</option>
						<option value="binance">Binance</option>
						<option value="kraken">Kraken</option>
					</select>
				</div>

				<Input
					id="walletAddress"
					name="walletAddress"
					label="Wallet Address (optional)"
					placeholder="0x..."
				/>

				<Input id="notes" name="notes" label="Notes (optional)" placeholder="Any notes..." />
			{/if}

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button
					variant="secondary"
					type="button"
					onclick={() => {
						showAddHolding = false;
						selectedCoin = null;
						addCoinSearch = '';
					}}
				>
					Cancel
				</Button>
				{#if selectedCoin}
					<Button type="submit">Add Holding</Button>
				{/if}
			</div>
		</div>
	</form>
</Modal>

<!-- Edit Holding Modal -->
<Modal open={showEditHolding} onclose={() => (showEditHolding = false)} title="Edit Holding">
	{#if selectedHolding}
		<form method="POST" action="?/updateHolding" use:enhance>
			<input type="hidden" name="id" value={selectedHolding.id} />
			<div class="space-y-4">
				<div
					class="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-700/50 px-4 py-3"
				>
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
					>
						{selectedHolding.symbol.slice(0, 3)}
					</div>
					<div>
						<p class="text-sm font-medium text-white">{selectedHolding.symbol}</p>
						<p class="text-xs text-surface-400">{selectedHolding.name}</p>
					</div>
				</div>

				<Input
					id="editQuantity"
					name="quantity"
					label="Quantity"
					type="number"
					step="any"
					min="0"
					value={selectedHolding.quantity}
				/>

				<Input
					id="editCostBasis"
					name="averageCostBasis"
					label="Average Cost Basis (USD)"
					type="number"
					step="any"
					min="0"
					value={selectedHolding.averageCostBasis}
				/>

				<div>
					<label for="editExchange" class="block text-sm font-medium text-surface-300">
						Exchange
					</label>
					<select
						id="editExchange"
						name="exchange"
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						value={selectedHolding.exchange || 'manual'}
					>
						<option value="manual">Manual Entry</option>
						<option value="coinbase">Coinbase</option>
						<option value="binance">Binance</option>
						<option value="kraken">Kraken</option>
					</select>
				</div>

				<Input
					id="editNotes"
					name="notes"
					label="Notes (optional)"
					value={selectedHolding.notes || ''}
				/>

				{#if form && 'error' in form && form.error}
					<p class="text-sm text-red-400">{form.error}</p>
				{/if}

				<div class="flex justify-end gap-3 pt-2">
					<Button variant="secondary" type="button" onclick={() => (showEditHolding = false)}>
						Cancel
					</Button>
					<Button type="submit">Save Changes</Button>
				</div>
			</div>
		</form>
	{/if}
</Modal>

<!-- Delete Confirm Modal -->
<Modal
	open={showDeleteConfirm}
	onclose={() => (showDeleteConfirm = false)}
	title="Delete Holding"
>
	<form method="POST" action="?/deleteHolding" use:enhance>
		<input type="hidden" name="id" value={deleteHoldingId} />
		<p class="text-sm text-surface-300">
			Are you sure you want to delete this holding? This will also remove all associated
			transactions. This action cannot be undone.
		</p>

		<div class="mt-6 flex justify-end gap-3">
			<Button
				variant="secondary"
				type="button"
				onclick={() => (showDeleteConfirm = false)}
			>
				Cancel
			</Button>
			<Button variant="danger" type="submit">Delete</Button>
		</div>
	</form>
</Modal>

<!-- Record Transaction Modal -->
<Modal
	open={showRecordTx}
	onclose={() => (showRecordTx = false)}
	title="Record Transaction"
>
	<form method="POST" action="?/recordTransaction" use:enhance>
		<div class="space-y-4">
			<div>
				<label for="txHolding" class="block text-sm font-medium text-surface-300">
					Holding
				</label>
				<select
					id="txHolding"
					name="holdingId"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					value={txHoldingId}
					required
				>
					<option value="">Select a holding...</option>
					{#each data.holdings || [] as holding}
						<option value={holding.id}>
							{holding.symbol} - {holding.name}
						</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="txType" class="block text-sm font-medium text-surface-300">Type</label>
				<select
					id="txType"
					name="type"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					required
				>
					<option value="buy">Buy</option>
					<option value="sell">Sell</option>
					<option value="transfer">Transfer</option>
					<option value="staking_reward">Staking Reward</option>
					<option value="airdrop">Airdrop</option>
				</select>
			</div>

			<Input
				id="txQuantity"
				name="quantity"
				label="Quantity"
				type="number"
				step="any"
				min="0"
				placeholder="0.00"
				required
			/>

			<Input
				id="txPrice"
				name="pricePerUnit"
				label="Price Per Unit (USD)"
				type="number"
				step="any"
				min="0"
				placeholder="0.00"
				required
			/>

			<Input
				id="txFee"
				name="fee"
				label="Fee (USD, optional)"
				type="number"
				step="any"
				min="0"
				placeholder="0.00"
			/>

			<Input id="txDate" name="date" label="Date" type="date" />

			<div>
				<label for="txExchange" class="block text-sm font-medium text-surface-300">
					Exchange (optional)
				</label>
				<select
					id="txExchange"
					name="exchange"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="">Same as holding</option>
					<option value="coinbase">Coinbase</option>
					<option value="binance">Binance</option>
					<option value="kraken">Kraken</option>
					<option value="manual">Manual</option>
				</select>
			</div>

			<Input
				id="txHash"
				name="txHash"
				label="Transaction Hash (optional)"
				placeholder="0x..."
			/>

			<Input id="txNotes" name="notes" label="Notes (optional)" />

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" type="button" onclick={() => (showRecordTx = false)}>
					Cancel
				</Button>
				<Button type="submit">Record Transaction</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- Add to Watchlist Modal -->
<Modal
	open={showAddWatchlist}
	onclose={() => { showAddWatchlist = false; addCoinSearch = ''; }}
	title="Add to Watchlist"
>
	<form method="POST" action="?/addToWatchlist" use:enhance>
		<div class="space-y-4">
			<div>
				<label for="watchlistSearch" class="block text-sm font-medium text-surface-300">
					Search Coin
				</label>
				<input
					id="watchlistSearch"
					type="text"
					bind:value={addCoinSearch}
					placeholder="Search by name or symbol..."
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<input type="hidden" name="symbol" value={watchlistSymbol} />
			<input type="hidden" name="name" value={watchlistName} />

			<div class="max-h-48 overflow-y-auto rounded-lg border border-surface-700">
				{#each filteredCoins as coin}
					<button
						type="submit"
						class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-700"
						onclick={() => {
							watchlistSymbol = coin.symbol;
							watchlistName = coin.name;
						}}
					>
						<div
							class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-600 text-xs font-bold text-white"
						>
							{coin.symbol.slice(0, 2)}
						</div>
						<div>
							<p class="text-sm font-medium text-white">{coin.name}</p>
							<p class="text-xs text-surface-400">{coin.symbol}</p>
						</div>
					</button>
				{/each}
				{#if filteredCoins.length === 0}
					<p class="px-4 py-3 text-sm text-surface-400">No coins found.</p>
				{/if}
			</div>

			{#if form && 'error' in form && form.error}
				<p class="text-sm text-red-400">{form.error}</p>
			{/if}

			<div class="flex justify-end pt-2">
				<Button
					variant="secondary"
					type="button"
					onclick={() => { showAddWatchlist = false; addCoinSearch = ''; }}
				>
					Close
				</Button>
			</div>
		</div>
	</form>
</Modal>

<!-- Price Chart Modal -->
<Modal
	open={showPriceChart}
	onclose={() => (showPriceChart = false)}
	title="{selectedChartName} ({selectedChartSymbol}) Price Chart"
>
	<div class="space-y-4">
		<!-- Period selector -->
		<div class="flex gap-2">
			{#each [
				{ days: 7, label: '7D' },
				{ days: 30, label: '30D' },
				{ days: 90, label: '90D' },
				{ days: 365, label: '1Y' }
			] as period}
				<button
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition {chartPeriod ===
					period.days
						? 'bg-primary-600 text-white'
						: 'bg-surface-700 text-surface-400 hover:bg-surface-600 hover:text-white'}"
					onclick={() => loadChartData(period.days)}
				>
					{period.label}
				</button>
			{/each}
		</div>

		<!-- Chart -->
		{#if chartLoading}
			<div class="flex items-center justify-center py-12">
				{#await import('$lib/components/ui/Spinner.svelte') then { default: Spinner }}
					<Spinner />
				{/await}
			</div>
		{:else if priceChartData.length > 0}
			{#await import('$lib/components/charts/LineChart.svelte') then { default: LineChart }}
				<LineChart
					labels={priceChartLabels}
					datasets={[
						{
							label: `${selectedChartSymbol} Price`,
							data: priceChartData,
							borderColor: '#8b5cf6',
							fill: true
						}
					]}
					height={280}
				/>
			{/await}
		{:else}
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<p class="text-sm text-surface-400">
					Price history unavailable. CoinGecko may be rate-limiting requests.
				</p>
			</div>
		{/if}
	</div>
</Modal>
