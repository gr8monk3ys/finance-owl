<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal, Badge } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showCreateModal = $state(false);
	let editingSubscription = $state<any>(null);
	let viewMode = $state<'monthly' | 'annual'>('monthly');
	let searchQuery = $state('');
	let sortBy = $state<'amount' | 'name' | 'date' | 'category'>('amount');
	let filterCategory = $state<string>('all');
	let activeTab = $state<'subscriptions' | 'calendar' | 'insights'>('subscriptions');

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showCreateModal = false;
			editingSubscription = null;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function daysUntil(dateStr: string): number {
		const target = new Date(dateStr + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function getStatusLabel(sub: any): string {
		if (!sub.isActive) return 'Dismissed';
		if (sub.isConfirmed) return 'Confirmed';
		return 'Detected';
	}

	function getStatusColor(sub: any): string {
		if (!sub.isActive) return 'bg-surface-600 text-surface-300';
		if (sub.isConfirmed) return 'bg-emerald-900/50 text-emerald-400';
		return 'bg-yellow-900/50 text-yellow-400';
	}

	function getFrequencyLabel(frequency: string): string {
		const labels: Record<string, string> = {
			weekly: 'Weekly',
			biweekly: 'Biweekly',
			monthly: 'Monthly',
			quarterly: 'Quarterly',
			annual: 'Annual'
		};
		return labels[frequency] ?? frequency;
	}

	function getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			streaming: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
			music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
			fitness: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
			software: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
			food_delivery: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
			news: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
			gaming: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
			productivity: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
			cloud_storage: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
		};
		return icons[category] || 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
	}

	function getCategoryColor(category: string): string {
		const colors: Record<string, string> = {
			streaming: 'text-purple-400',
			music: 'text-green-400',
			fitness: 'text-rose-400',
			software: 'text-blue-400',
			food_delivery: 'text-orange-400',
			news: 'text-yellow-400',
			gaming: 'text-indigo-400',
			productivity: 'text-cyan-400',
			cloud_storage: 'text-teal-400'
		};
		return colors[category] || 'text-surface-400';
	}

	function getCategoryBgColor(category: string): string {
		const colors: Record<string, string> = {
			streaming: 'bg-purple-600/20',
			music: 'bg-green-600/20',
			fitness: 'bg-rose-600/20',
			software: 'bg-blue-600/20',
			food_delivery: 'bg-orange-600/20',
			news: 'bg-yellow-600/20',
			gaming: 'bg-indigo-600/20',
			productivity: 'bg-cyan-600/20',
			cloud_storage: 'bg-teal-600/20'
		};
		return colors[category] || 'bg-surface-700';
	}

	// Derived data
	const activeSubscriptions = $derived(
		data.subscriptions.filter((s: any) => s.isActive)
	);

	const unconfirmedSubscriptions = $derived(
		data.subscriptions.filter((s: any) => s.isActive && !s.isConfirmed)
	);

	const confirmedSubscriptions = $derived(
		data.subscriptions.filter((s: any) => s.isActive && s.isConfirmed)
	);

	const displayTotal = $derived(
		viewMode === 'monthly' ? data.summary.monthlyTotal : data.summary.annualTotal
	);

	// Previous month comparison (simple estimate)
	const monthChangePercent = $derived.by(() => {
		if (!data.summary.monthlyTotal) return 0;
		const byCategory = data.summary.byCategory || [];
		const total = byCategory.reduce((sum: number, c: any) => sum + (c.monthlyAmount || 0), 0);
		if (total === 0) return 0;
		return ((data.summary.monthlyTotal - total) / total) * 100;
	});

	// Category breakdown
	const categoryBreakdown = $derived.by(() => {
		const catMap = new Map<string, { name: string; amount: number; count: number }>();
		for (const sub of activeSubscriptions) {
			const catName = sub.categoryName || 'Other';
			const existing = catMap.get(catName) || { name: catName, amount: 0, count: 0 };
			const monthlyAmount =
				sub.frequency === 'annual'
					? sub.estimatedAmount / 12
					: sub.frequency === 'quarterly'
						? sub.estimatedAmount / 3
						: sub.frequency === 'biweekly'
							? sub.estimatedAmount * 2
							: sub.frequency === 'weekly'
								? sub.estimatedAmount * 4.33
								: sub.estimatedAmount;
			existing.amount += monthlyAmount;
			existing.count += 1;
			catMap.set(catName, existing);
		}
		return Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
	});

	const totalCategoryAmount = $derived(
		categoryBreakdown.reduce((s: number, c: any) => s + c.amount, 0)
	);

	// Filtered and sorted subscriptions
	const filteredSubscriptions = $derived.by(() => {
		let subs = [...confirmedSubscriptions];

		// Search filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			subs = subs.filter(
				(s: any) =>
					(s.merchantName || s.name).toLowerCase().includes(q) ||
					(s.categoryName || '').toLowerCase().includes(q)
			);
		}

		// Category filter
		if (filterCategory !== 'all') {
			subs = subs.filter((s: any) => (s.categoryName || 'Other') === filterCategory);
		}

		// Sorting
		subs.sort((a: any, b: any) => {
			switch (sortBy) {
				case 'amount':
					return b.estimatedAmount - a.estimatedAmount;
				case 'name':
					return (a.merchantName || a.name).localeCompare(b.merchantName || b.name);
				case 'date':
					return (a.nextExpectedDate || '').localeCompare(b.nextExpectedDate || '');
				case 'category':
					return (a.categoryName || 'Other').localeCompare(b.categoryName || 'Other');
				default:
					return 0;
			}
		});

		return subs;
	});

	// Calendar data for upcoming charges
	const calendarDays = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const days: { date: Date; dateStr: string; bills: any[]; isToday: boolean }[] = [];

		for (let i = 0; i < 30; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() + i);
			const dateStr = d.toISOString().split('T')[0];
			const bills = data.upcoming.filter((b: any) => b.expectedDate === dateStr);
			days.push({ date: d, dateStr, bills, isToday: i === 0 });
		}

		return days.filter((d) => d.bills.length > 0);
	});

	// Unique categories for filter
	const uniqueCategories = $derived.by(() => {
		const cats = new Set<string>();
		for (const sub of activeSubscriptions) {
			cats.add(sub.categoryName || 'Other');
		}
		return Array.from(cats).sort();
	});

	// Category ring segments for the donut
	const donutSegments = $derived.by(() => {
		if (totalCategoryAmount === 0) return [];
		const colors = [
			'#a78bfa',
			'#34d399',
			'#fb7185',
			'#60a5fa',
			'#fb923c',
			'#fbbf24',
			'#818cf8',
			'#22d3ee',
			'#2dd4bf'
		];
		let cumulative = 0;
		return categoryBreakdown.map((cat, i) => {
			const pct = (cat.amount / totalCategoryAmount) * 100;
			const start = cumulative;
			cumulative += pct;
			return { ...cat, pct, start, color: colors[i % colors.length] };
		});
	});
</script>

<svelte:head>
	<title>Subscriptions - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Subscriptions</h2>
			<p class="mt-1 text-sm text-surface-400">
				Track and manage all your recurring charges
			</p>
		</div>
		<div class="flex items-center gap-3">
			<form method="POST" action="?/detect" use:enhance>
				<Button type="submit" variant="secondary" size="sm">Detect Subscriptions</Button>
			</form>
			<Button onclick={() => (showCreateModal = true)}>Add Subscription</Button>
		</div>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Summary cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<div class="flex items-center justify-between">
				<p class="text-sm text-surface-400">
					{viewMode === 'monthly' ? 'Monthly' : 'Annual'} Cost
				</p>
				<div class="flex rounded-lg bg-surface-700 p-0.5">
					<button
						class="rounded-md px-2 py-1 text-xs transition {viewMode === 'monthly'
							? 'bg-emerald-600 text-white'
							: 'text-surface-400 hover:text-white'}"
						onclick={() => (viewMode = 'monthly')}
					>
						Mo
					</button>
					<button
						class="rounded-md px-2 py-1 text-xs transition {viewMode === 'annual'
							? 'bg-emerald-600 text-white'
							: 'text-surface-400 hover:text-white'}"
						onclick={() => (viewMode = 'annual')}
					>
						Yr
					</button>
				</div>
			</div>
			<p class="mt-2 text-2xl font-bold text-white">{fmt(displayTotal)}</p>
			{#if monthChangePercent !== 0}
				<p class="mt-1 text-xs {monthChangePercent > 0 ? 'text-rose-400' : 'text-emerald-400'}">
					{monthChangePercent > 0 ? '+' : ''}{monthChangePercent.toFixed(1)}% vs last period
				</p>
			{/if}
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Active Subscriptions</p>
			<p class="mt-2 text-2xl font-bold text-white">{data.summary.activeCount}</p>
			{#if unconfirmedSubscriptions.length > 0}
				<p class="mt-1 text-xs text-yellow-400">
					{unconfirmedSubscriptions.length} unconfirmed
				</p>
			{/if}
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Upcoming (30 days)</p>
			<p class="mt-2 text-2xl font-bold text-white">
				{fmt(data.upcoming.reduce((sum: number, b: any) => sum + b.estimatedAmount, 0))}
			</p>
			<p class="mt-1 text-xs text-surface-500">
				{data.upcoming.length} bill{data.upcoming.length !== 1 ? 's' : ''}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Avg per Subscription</p>
			<p class="mt-2 text-2xl font-bold text-white">
				{data.summary.activeCount > 0
					? fmt(data.summary.monthlyTotal / data.summary.activeCount)
					: fmt(0)}
			</p>
			<p class="mt-1 text-xs text-surface-500">monthly average</p>
		</Card>
	</div>

	<!-- Price Alerts -->
	{#if data.priceChanges && data.priceChanges.length > 0}
		<Card>
			<div class="flex items-center gap-2 mb-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600/20">
					<svg class="h-4 w-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-rose-400">Price Alerts</h3>
			</div>
			<div class="space-y-2">
				{#each data.priceChanges as change}
					<div class="flex items-center justify-between rounded-lg bg-surface-800/50 p-3">
						<div>
							<p class="text-sm font-medium text-white">{change.merchantName || change.name}</p>
							<p class="text-xs text-surface-400">
								{change.direction === 'increase' ? 'Price increased' : 'Price decreased'}
								by {Math.abs(change.changePercent).toFixed(1)}%
							</p>
						</div>
						<div class="text-right">
							<p class="text-sm font-medium {change.direction === 'increase' ? 'text-rose-400' : 'text-emerald-400'}">
								{fmt(change.previousAmount)} -> {fmt(change.currentAmount)}
							</p>
							<p class="text-xs {change.direction === 'increase' ? 'text-rose-400' : 'text-emerald-400'}">
								{change.direction === 'increase' ? '+' : ''}{change.changePercent.toFixed(1)}%
							</p>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Duplicate Alerts -->
	{#if data.duplicates && data.duplicates.length > 0}
		<Card>
			<div class="flex items-center gap-2 mb-3">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600/20">
					<svg class="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
					</svg>
				</div>
				<h3 class="text-lg font-semibold text-amber-400">Possible Duplicates</h3>
			</div>
			<p class="mb-3 text-sm text-surface-400">
				These subscriptions may be duplicates across different accounts.
			</p>
			<div class="space-y-3">
				{#each data.duplicates as group}
					<div class="rounded-lg bg-surface-800/50 p-3">
						<p class="mb-2 text-sm font-medium text-white capitalize">{group.normalizedName}</p>
						<div class="space-y-1">
							{#each group.subscriptions as sub}
								<div class="flex items-center justify-between text-xs">
									<span class="text-surface-400">{sub.merchantName}</span>
									<span class="text-white">{fmt(sub.estimatedAmount)}/{sub.frequency}</span>
								</div>
							{/each}
						</div>
						<p class="mt-2 text-xs text-amber-400">
							Combined: {fmt(group.subscriptions.reduce((s: number, sub: any) => s + sub.estimatedAmount, 0))}/mo
						</p>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Tab navigation -->
	<div class="flex border-b border-surface-700">
		{#each [
			{ id: 'subscriptions' as const, label: 'Subscriptions' },
			{ id: 'calendar' as const, label: 'Upcoming Calendar' },
			{ id: 'insights' as const, label: 'Category Breakdown' }
		] as tab}
			<button
				class="relative px-4 py-2.5 text-sm font-medium transition {activeTab === tab.id
					? 'text-emerald-400'
					: 'text-surface-400 hover:text-white'}"
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
				{#if activeTab === tab.id}
					<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Tab: Subscriptions -->
	{#if activeTab === 'subscriptions'}
		<!-- Unconfirmed subscriptions -->
		{#if unconfirmedSubscriptions.length > 0}
			<div>
				<h3 class="mb-3 text-lg font-semibold text-yellow-400">
					Newly Detected ({unconfirmedSubscriptions.length})
				</h3>
				<div class="space-y-2">
					{#each unconfirmedSubscriptions as sub, i}
						<div
							class="transform transition-all duration-300"
							style="animation: slideInUp 0.3s ease-out {i * 0.05}s both"
						>
							<Card>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-600/20">
											<svg class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
												<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
											</svg>
										</div>
										<div>
											<p class="font-medium text-white">
												{sub.merchantName || sub.name}
											</p>
											<div class="mt-0.5 flex items-center gap-2">
												<span class="rounded-md px-1.5 py-0.5 text-xs {getStatusColor(sub)}">
													{getStatusLabel(sub)}
												</span>
												<span class="text-xs text-surface-500">
													{getFrequencyLabel(sub.frequency)}
												</span>
											</div>
										</div>
									</div>
									<div class="flex items-center gap-3">
										<div class="text-right">
											<p class="font-semibold text-white">{fmt(sub.estimatedAmount)}</p>
											{#if sub.nextExpectedDate}
												<p class="text-xs text-surface-500">
													Next: {formatDate(sub.nextExpectedDate)}
												</p>
											{/if}
										</div>
										<div class="flex gap-1">
											<form method="POST" action="?/confirm" use:enhance>
												<input type="hidden" name="id" value={sub.id} />
												<Button type="submit" size="sm" variant="primary">Confirm</Button>
											</form>
											<form method="POST" action="?/dismiss" use:enhance>
												<input type="hidden" name="id" value={sub.id} />
												<Button type="submit" size="sm" variant="ghost">Dismiss</Button>
											</form>
										</div>
									</div>
								</div>
							</Card>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Search and filters -->
		{#if confirmedSubscriptions.length > 0}
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<!-- Search -->
				<div class="relative flex-1">
					<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Search subscriptions..."
						bind:value={searchQuery}
						class="w-full rounded-lg border border-surface-600 bg-surface-800 py-2 pl-10 pr-3 text-sm text-white placeholder-surface-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>

				<!-- Sort -->
				<select
					bind:value={sortBy}
					class="rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
				>
					<option value="amount">Sort by Amount</option>
					<option value="name">Sort by Name</option>
					<option value="date">Sort by Next Date</option>
					<option value="category">Sort by Category</option>
				</select>

				<!-- Category filter -->
				<select
					bind:value={filterCategory}
					class="rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
				>
					<option value="all">All Categories</option>
					{#each uniqueCategories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Confirmed subscriptions list -->
		{#if filteredSubscriptions.length > 0}
			<div class="space-y-2">
				{#each filteredSubscriptions as sub, i}
					<div
						class="transform transition-all duration-300"
						style="animation: slideInUp 0.3s ease-out {i * 0.03}s both"
					>
						<Card>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg {getCategoryBgColor(sub.detectedCategory || 'other')}">
										<svg class="h-5 w-5 {getCategoryColor(sub.detectedCategory || 'other')}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
											<path stroke-linecap="round" stroke-linejoin="round" d={getCategoryIcon(sub.detectedCategory || 'other')} />
										</svg>
									</div>
									<div>
										<div class="flex items-center gap-2">
											<p class="font-medium text-white">
												{sub.merchantName || sub.name}
											</p>
											{#if sub.isTrial}
												<span class="rounded-full bg-amber-600/20 px-2 py-0.5 text-xs font-medium text-amber-400">
													Trial
												</span>
											{/if}
										</div>
										<div class="mt-0.5 flex flex-wrap items-center gap-2">
											<span class="rounded-md px-1.5 py-0.5 text-xs {getStatusColor(sub)}">
												{getStatusLabel(sub)}
											</span>
											<span class="text-xs text-surface-500">
												{getFrequencyLabel(sub.frequency)}
											</span>
											{#if sub.categoryName}
												<span class="text-xs text-surface-500">
													{sub.categoryName}
												</span>
											{/if}
											{#if sub.confidenceScore}
												<span class="text-xs {sub.confidence === 'high' ? 'text-emerald-400' : sub.confidence === 'medium' ? 'text-yellow-400' : 'text-surface-500'}">
													{sub.confidence === 'high' ? 'High' : sub.confidence === 'medium' ? 'Med' : 'Low'} conf
												</span>
											{/if}
										</div>
									</div>
								</div>
								<div class="flex items-center gap-3">
									<div class="text-right">
										<p class="font-semibold text-white">{fmt(sub.estimatedAmount)}</p>
										{#if sub.nextExpectedDate}
											{@const days = daysUntil(sub.nextExpectedDate)}
											<p class="text-xs {days <= 3 ? 'text-amber-400' : 'text-surface-500'}">
												{#if days === 0}
													Due today
												{:else if days === 1}
													Due tomorrow
												{:else if days < 0}
													{Math.abs(days)}d overdue
												{:else}
													in {days}d
												{/if}
											</p>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										<a
											href="/subscriptions/cancel/{sub.id}"
											class="rounded p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-rose-400"
											title="Cancel"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</a>
										<button
											class="rounded p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-white"
											onclick={() => (editingSubscription = sub)}
											title="Edit"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
											</svg>
										</button>
									</div>
								</div>
							</div>
						</Card>
					</div>
				{/each}
			</div>
		{:else if confirmedSubscriptions.length > 0}
			<Card>
				<div class="py-6 text-center">
					<p class="text-sm text-surface-400">No subscriptions match your filters.</p>
				</div>
			</Card>
		{/if}

		<!-- Empty state -->
		{#if activeSubscriptions.length === 0}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-surface-800">
						<svg class="h-8 w-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
					</div>
					<p class="mt-4 text-lg text-surface-300">No subscriptions yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Add subscriptions manually or click "Detect Subscriptions" to find recurring charges.
					</p>
					<div class="mt-4 flex gap-3">
						<form method="POST" action="?/detect" use:enhance>
							<Button type="submit" variant="secondary">Detect Subscriptions</Button>
						</form>
						<Button onclick={() => (showCreateModal = true)}>Add Manually</Button>
					</div>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Tab: Calendar -->
	{#if activeTab === 'calendar'}
		{#if calendarDays.length > 0}
			<div class="space-y-2">
				{#each calendarDays as day, i}
					<div
						class="transform transition-all duration-300"
						style="animation: slideInUp 0.3s ease-out {i * 0.05}s both"
					>
						<Card>
							<div class="flex items-start gap-4">
								<div class="flex flex-col items-center">
									<span class="text-xs font-medium uppercase text-surface-500">
										{day.date.toLocaleDateString('en-US', { weekday: 'short' })}
									</span>
									<span class="text-2xl font-bold {day.isToday ? 'text-emerald-400' : 'text-white'}">
										{day.date.getDate()}
									</span>
									<span class="text-xs text-surface-500">
										{day.date.toLocaleDateString('en-US', { month: 'short' })}
									</span>
								</div>
								<div class="flex-1 space-y-1.5">
									{#each day.bills as bill}
										<div class="flex items-center justify-between rounded-lg bg-surface-800/50 px-3 py-2">
											<span class="text-sm text-white">{bill.merchantName || bill.name}</span>
											<span class="text-sm font-semibold text-white">{fmt(bill.estimatedAmount)}</span>
										</div>
									{/each}
								</div>
								<div class="text-right">
									<p class="text-sm font-semibold text-emerald-400">
										{fmt(day.bills.reduce((s: number, b: any) => s + b.estimatedAmount, 0))}
									</p>
								</div>
							</div>
						</Card>
					</div>
				{/each}
			</div>
		{:else}
			<Card>
				<div class="py-8 text-center">
					<p class="text-surface-400">No upcoming charges in the next 30 days.</p>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Tab: Category Breakdown -->
	{#if activeTab === 'insights'}
		{#if categoryBreakdown.length > 0}
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Donut chart approximation using CSS conic gradient -->
				<Card>
					<h3 class="mb-4 text-lg font-semibold text-white">Spending by Category</h3>
					<div class="flex items-center justify-center">
						<div class="relative">
							<div
								class="h-48 w-48 rounded-full"
								style="background: conic-gradient({donutSegments
									.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
									.join(', ')})"
							></div>
							<div class="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-surface-900">
								<p class="text-lg font-bold text-white">{fmt(totalCategoryAmount)}</p>
								<p class="text-xs text-surface-400">per month</p>
							</div>
						</div>
					</div>
					<div class="mt-4 space-y-2">
						{#each donutSegments as seg}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="h-3 w-3 rounded-full" style="background-color: {seg.color}"></span>
									<span class="text-sm text-surface-300">{seg.name}</span>
								</div>
								<div class="text-right">
									<span class="text-sm font-medium text-white">{fmt(seg.amount)}</span>
									<span class="ml-1 text-xs text-surface-500">({seg.pct.toFixed(0)}%)</span>
								</div>
							</div>
						{/each}
					</div>
				</Card>

				<!-- Category details -->
				<Card>
					<h3 class="mb-4 text-lg font-semibold text-white">Category Details</h3>
					<div class="space-y-3">
						{#each categoryBreakdown as cat}
							<div class="rounded-lg bg-surface-800/50 p-3">
								<div class="flex items-center justify-between">
									<p class="text-sm font-medium text-white">{cat.name}</p>
									<p class="text-sm font-semibold text-white">{fmt(cat.amount)}/mo</p>
								</div>
								<div class="mt-2 flex items-center gap-2">
									<div class="h-1.5 flex-1 rounded-full bg-surface-700">
										<div
											class="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
											style="width: {totalCategoryAmount > 0 ? (cat.amount / totalCategoryAmount) * 100 : 0}%"
										></div>
									</div>
									<span class="text-xs text-surface-500">
										{cat.count} sub{cat.count !== 1 ? 's' : ''}
									</span>
								</div>
								<p class="mt-1 text-xs text-surface-500">
									{fmt(cat.amount * 12)}/year
								</p>
							</div>
						{/each}
					</div>
				</Card>
			</div>
		{:else}
			<Card>
				<div class="py-8 text-center">
					<p class="text-surface-400">No category data available. Add some subscriptions first.</p>
				</div>
			</Card>
		{/if}
	{/if}
</div>

<!-- Create Subscription Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Add Subscription">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="subName" class="block text-sm font-medium text-surface-300">Name</label>
			<input
				id="subName"
				name="name"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				placeholder="Netflix"
			/>
		</div>

		<div>
			<label for="subMerchant" class="block text-sm font-medium text-surface-300">
				Merchant Name (optional)
			</label>
			<input
				id="subMerchant"
				name="merchantName"
				type="text"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				placeholder="Netflix Inc"
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="subAmount" class="block text-sm font-medium text-surface-300">
					Amount
				</label>
				<input
					id="subAmount"
					name="estimatedAmount"
					type="number"
					step="0.01"
					min="0"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					placeholder="15.99"
				/>
			</div>
			<div>
				<label for="subFrequency" class="block text-sm font-medium text-surface-300">
					Frequency
				</label>
				<select
					id="subFrequency"
					name="frequency"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				>
					<option value="weekly">Weekly</option>
					<option value="biweekly">Biweekly</option>
					<option value="monthly" selected>Monthly</option>
					<option value="quarterly">Quarterly</option>
					<option value="annual">Annual</option>
				</select>
			</div>
		</div>

		<div>
			<label for="subCategory" class="block text-sm font-medium text-surface-300">
				Category (optional)
			</label>
			<select
				id="subCategory"
				name="categoryId"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
			>
				<option value="">None</option>
				{#each data.categories as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="subNextDate" class="block text-sm font-medium text-surface-300">
				Next Expected Date (optional)
			</label>
			<input
				id="subNextDate"
				name="nextExpectedDate"
				type="date"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
			/>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Add Subscription</Button>
		</div>
	</form>
</Modal>

<!-- Edit Subscription Modal -->
<Modal
	open={editingSubscription !== null}
	onclose={() => (editingSubscription = null)}
	title="Edit Subscription"
>
	{#if editingSubscription}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={editingSubscription.id} />

			<div>
				<label for="editSubName" class="block text-sm font-medium text-surface-300">
					Name
				</label>
				<input
					id="editSubName"
					name="name"
					type="text"
					required
					value={editingSubscription.merchantName || editingSubscription.name}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="editSubAmount" class="block text-sm font-medium text-surface-300">
						Amount
					</label>
					<input
						id="editSubAmount"
						name="estimatedAmount"
						type="number"
						step="0.01"
						min="0"
						required
						value={editingSubscription.estimatedAmount}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>
				<div>
					<label for="editSubFreq" class="block text-sm font-medium text-surface-300">
						Frequency
					</label>
					<select
						id="editSubFreq"
						name="frequency"
						required
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					>
						{#each ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as freq}
							<option value={freq} selected={editingSubscription.frequency === freq}>
								{freq.charAt(0).toUpperCase() + freq.slice(1)}
							</option>
						{/each}
					</select>
				</div>
			</div>

			<div>
				<label for="editSubCategory" class="block text-sm font-medium text-surface-300">
					Category
				</label>
				<select
					id="editSubCategory"
					name="categoryId"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				>
					<option value="">None</option>
					{#each data.categories as cat}
						<option
							value={cat.id}
							selected={editingSubscription.categoryId === cat.id}
						>
							{cat.name}
						</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="editSubDate" class="block text-sm font-medium text-surface-300">
					Next Expected Date
				</label>
				<input
					id="editSubDate"
					name="nextExpectedDate"
					type="date"
					value={editingSubscription.nextExpectedDate ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (editingSubscription = null)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>

		<form
			method="POST"
			action="?/delete"
			use:enhance
			class="mt-3 border-t border-surface-700 pt-3"
		>
			<input type="hidden" name="id" value={editingSubscription.id} />
			<Button type="submit" variant="danger" size="sm">Delete Subscription</Button>
		</form>
	{/if}
</Modal>

<style>
	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
