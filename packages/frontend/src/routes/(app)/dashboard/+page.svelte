<script lang="ts">
	import { Card, Button, Modal } from '$components/ui';
	import { enhance } from '$app/forms';
	import NetWorthWidget from '$lib/components/dashboard/NetWorthWidget.svelte';
	import SpendingCategoryWidget from '$lib/components/dashboard/SpendingCategoryWidget.svelte';
	import BudgetProgressWidget from '$lib/components/dashboard/BudgetProgressWidget.svelte';
	import RecentTransactionsWidget from '$lib/components/dashboard/RecentTransactionsWidget.svelte';
	import AccountBalancesWidget from '$lib/components/dashboard/AccountBalancesWidget.svelte';
	import UpcomingBillsWidget from '$lib/components/dashboard/UpcomingBillsWidget.svelte';
	import SavingsGoalsWidget from '$lib/components/dashboard/SavingsGoalsWidget.svelte';
	import CashFlowWidget from '$lib/components/dashboard/CashFlowWidget.svelte';
	import CreditScoreWidget from '$lib/components/dashboard/CreditScoreWidget.svelte';
	import QuickActionsWidget from '$lib/components/dashboard/QuickActionsWidget.svelte';
	import SafeToSpendWidget from '$lib/components/dashboard/SafeToSpendWidget.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// Widget type registry
	const widgetMeta: Record<string, { label: string; description: string }> = {
		'net-worth': { label: 'Net Worth', description: 'Net worth summary with trend indicator' },
		'spending-category': {
			label: 'Spending by Category',
			description: 'Donut chart of spending by category'
		},
		'budget-progress': {
			label: 'Budget Progress',
			description: 'Progress bars for top budgets'
		},
		'recent-transactions': {
			label: 'Recent Transactions',
			description: 'Latest transactions list'
		},
		'account-balances': {
			label: 'Account Balances',
			description: 'All account balances at a glance'
		},
		'upcoming-bills': { label: 'Upcoming Bills', description: 'Next upcoming bill payments' },
		'savings-goals': {
			label: 'Savings Goals',
			description: 'Track progress toward savings goals'
		},
		'cash-flow': {
			label: 'Cash Flow',
			description: 'Monthly income vs expenses chart'
		},
		'credit-score': {
			label: 'Credit Score',
			description: 'Credit score gauge display'
		},
		'quick-actions': {
			label: 'Quick Actions',
			description: 'Shortcut buttons for common actions'
		},
		'safe-to-spend': {
			label: 'Safe to Spend',
			description: 'How much you can safely spend with a quick calculator'
		}
	};

	// Default layout
	const defaultWidgets = [
		{ id: 'net-worth', type: 'net-worth', position: { x: 0, y: 0, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'spending-category', type: 'spending-category', position: { x: 1, y: 0, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'budget-progress', type: 'budget-progress', position: { x: 2, y: 0, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'recent-transactions', type: 'recent-transactions', position: { x: 0, y: 1, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'account-balances', type: 'account-balances', position: { x: 1, y: 1, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'upcoming-bills', type: 'upcoming-bills', position: { x: 2, y: 1, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'cash-flow', type: 'cash-flow', position: { x: 0, y: 2, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'savings-goals', type: 'savings-goals', position: { x: 1, y: 2, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'credit-score', type: 'credit-score', position: { x: 2, y: 2, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'safe-to-spend', type: 'safe-to-spend', position: { x: 0, y: 3, w: 1, h: 1 }, config: {}, visible: true },
		{ id: 'quick-actions', type: 'quick-actions', position: { x: 1, y: 3, w: 1, h: 1 }, config: {}, visible: true }
	];

	type Widget = typeof defaultWidgets[number];

	let widgets = $state<Widget[]>([...defaultWidgets]);

	$effect(() => {
		if (data.widgetLayout && Array.isArray(data.widgetLayout)) {
			widgets = data.widgetLayout as Widget[];
		}
	});

	let editMode = $state(false);
	let saving = $state(false);
	let showCustomize = $state(false);

	// Editing copies
	let editWidgets = $state<Widget[]>([]);

	const visibleWidgets = $derived(
		widgets
			.filter((w) => w.visible)
			.sort((a, b) => {
				if (a.position.y !== b.position.y) return a.position.y - b.position.y;
				return a.position.x - b.position.x;
			})
	);

	function openCustomize() {
		editWidgets = widgets.map((w) => ({ ...w, position: { ...w.position } }));
		showCustomize = true;
	}

	function closeCustomize() {
		showCustomize = false;
		editWidgets = [];
	}

	function toggleWidget(id: string) {
		editWidgets = editWidgets.map((w) =>
			w.id === id ? { ...w, visible: !w.visible } : w
		);
	}

	function moveWidgetUp(index: number) {
		if (index <= 0) return;
		const updated = [...editWidgets];
		[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
		// Recalculate positions
		updated.forEach((w, i) => {
			w.position = { x: i % 3, y: Math.floor(i / 3), w: 1, h: 1 };
		});
		editWidgets = updated;
	}

	function moveWidgetDown(index: number) {
		if (index >= editWidgets.length - 1) return;
		const updated = [...editWidgets];
		[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
		updated.forEach((w, i) => {
			w.position = { x: i % 3, y: Math.floor(i / 3), w: 1, h: 1 };
		});
		editWidgets = updated;
	}

	async function saveLayout() {
		saving = true;
		widgets = editWidgets.map((w) => ({ ...w }));
		try {
			const res = await fetch('?/saveLayout', {
				method: 'POST',
				body: new URLSearchParams({ widgets: JSON.stringify(widgets) })
			});
			if (res.ok) {
				showCustomize = false;
			}
		} catch {
			// silent fail - layout still updated locally
		} finally {
			saving = false;
			showCustomize = false;
		}
	}

	async function resetLayout() {
		saving = true;
		try {
			await fetch('?/resetLayout', { method: 'POST' });
			widgets = defaultWidgets.map((w) => ({ ...w, position: { ...w.position } }));
			editWidgets = widgets.map((w) => ({ ...w, position: { ...w.position } }));
		} catch {
			// silent fail
		} finally {
			saving = false;
		}
	}

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtPct(pct: number): string {
		const sign = pct >= 0 ? '+' : '';
		return `${sign}${pct.toFixed(1)}%`;
	}

	const hasData = $derived(
		data.netWorth.accountCount > 0 || data.dashboard.recentTransactions.length > 0
	);
</script>

<svelte:head>
	<title>Dashboard - FinanceOwl</title>
</svelte:head>

<div class="page-enter space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
			<p class="mt-1 text-sm text-surface-400">Your financial overview at a glance</p>
		</div>
		<Button variant="ghost" size="sm" onclick={openCustomize}>
			<svg
				class="mr-1.5 h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
				/>
			</svg>
			Customize
		</Button>
	</div>

	<!-- Summary cards strip -->
	<div class="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Net Worth - hero card with emerald gradient -->
		<div class="relative overflow-hidden rounded-xl border border-primary-800/40 bg-gradient-to-br from-primary-950 via-surface-800 to-surface-800 p-6 shadow-lg sm:col-span-2">
			<div class="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-500/5 blur-2xl"></div>
			<div class="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-primary-400/5 blur-xl"></div>
			<div class="relative">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15">
						<svg class="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-primary-300/80">Net Worth</p>
				</div>
				<p
					class="count-up mt-3 text-4xl font-bold tracking-tight {data.netWorth.netWorth >= 0
						? 'text-white'
						: 'text-red-400'}"
					style={data.netWorth.netWorth >= 0 ? 'text-shadow: 0 0 30px rgba(16, 185, 129, 0.2)' : ''}
				>
					{fmt(data.netWorth.netWorth)}
				</p>
				<div class="mt-2 flex items-center gap-4 text-sm">
					<span class="text-surface-400">
						{data.netWorth.accountCount} account{data.netWorth.accountCount !== 1 ? 's' : ''}
					</span>
					{#if data.netWorth.assets > 0}
						<span class="flex items-center gap-1 text-primary-400">
							<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M12 7a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 12.586V7z" clip-rule="evenodd" transform="rotate(180 10 10)" />
							</svg>
							{fmt(data.netWorth.assets)} assets
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Monthly Spending - blue gradient -->
		<div class="relative overflow-hidden rounded-xl border border-blue-800/30 bg-gradient-to-br from-blue-950/80 via-surface-800 to-surface-800 p-6 shadow-md">
			<div class="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-blue-500/5 blur-xl"></div>
			<div class="relative">
				<div class="flex items-center gap-2">
					<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
						<svg class="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-blue-300/80">Monthly Spending</p>
				</div>
				<p class="count-up mt-2 text-2xl font-bold text-white">
					{fmt(data.dashboard.currentMonthSpending)}
				</p>
				{#if data.dashboard.lastMonthSpending > 0}
					<p
						class="mt-1 flex items-center gap-1 text-xs {data.dashboard.spendingChange > 0
							? 'text-rose-400'
							: 'text-primary-400'}"
					>
						<svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
							{#if data.dashboard.spendingChange > 0}
								<path fill-rule="evenodd" d="M12 13a1 1 0 10-2 0V7.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L12 7.414V13z" clip-rule="evenodd" transform="rotate(180 10 10)" />
							{:else}
								<path fill-rule="evenodd" d="M12 7a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L12 12.586V7z" clip-rule="evenodd" transform="rotate(180 10 10)" />
							{/if}
						</svg>
						{fmtPct(data.dashboard.spendingChange)} vs last month
					</p>
				{:else}
					<p class="mt-1 text-xs text-surface-500">This month</p>
				{/if}
			</div>
		</div>

		<!-- Budget Remaining -->
		<div class="relative overflow-hidden rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-6 shadow-md">
			<div class="relative">
				<div class="flex items-center gap-2">
					<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500/15">
						<svg class="h-3.5 w-3.5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-surface-400">Budget Remaining</p>
				</div>
				{#if data.budgetSummary}
					<p
						class="count-up mt-2 text-2xl font-bold {data.budgetSummary.totalRemaining >= 0
							? 'text-primary-400'
							: 'text-rose-400'}"
					>
						{fmt(data.budgetSummary.totalRemaining)}
					</p>
					<div class="mt-2">
						<div class="h-1.5 overflow-hidden rounded-full bg-surface-700">
							<div
								class="progress-fill h-full rounded-full transition-all"
								style="width: {Math.min(data.budgetSummary.percentUsed, 100)}%;
									background: {data.budgetSummary.percentUsed >= 100
									? 'var(--fo-danger-500)'
									: data.budgetSummary.percentUsed >= 80
										? 'var(--fo-accent-500)'
										: 'var(--fo-primary-500)'}"
							></div>
						</div>
						<p class="mt-1 text-xs text-surface-500">
							{data.budgetSummary.percentUsed.toFixed(0)}% of {fmt(data.budgetSummary.totalBudgeted)}
						</p>
					</div>
				{:else}
					<p class="mt-2 text-2xl font-bold text-surface-500">--</p>
					<p class="mt-1 text-xs text-surface-500">
						<a href="/budgets" class="text-primary-400 hover:text-primary-300 underline decoration-primary-400/30 underline-offset-2">Set up budgets</a>
					</p>
				{/if}
			</div>
		</div>
	</div>

	{#if !hasData}
		<!-- Empty state -->
		<div class="relative overflow-hidden rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-1">
			<div class="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-blue-500/5"></div>
			<div class="relative flex flex-col items-center justify-center rounded-xl py-16 text-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-500/10">
					<svg
						class="h-10 w-10 text-primary-400/60"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
						/>
					</svg>
				</div>
				<p class="mt-6 text-xl font-semibold text-white">Welcome to FinanceOwl</p>
				<p class="mt-2 max-w-sm text-sm leading-relaxed text-surface-400">
					Get started by linking your bank accounts. We will automatically track your spending, net worth, and budget progress.
				</p>
				<a
					href="/accounts"
					class="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:shadow-xl hover:shadow-primary-900/40"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
					</svg>
					Link Your Accounts
				</a>
			</div>
		</div>
	{:else}
		<!-- Widget grid -->
		<div class="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each visibleWidgets as widget (widget.id)}
				<div class="min-h-[280px] {widget.type === 'net-worth' ? 'sm:col-span-2 lg:col-span-1' : ''}">
					{#if widget.type === 'net-worth'}
						<NetWorthWidget
							netWorth={data.netWorth}
							netWorthHistory={data.netWorthHistory}
						/>
					{:else if widget.type === 'spending-category'}
						<SpendingCategoryWidget
							categoryBreakdown={data.dashboard.categoryBreakdown}
						/>
					{:else if widget.type === 'budget-progress'}
						<BudgetProgressWidget budgets={data.budgets} />
					{:else if widget.type === 'recent-transactions'}
						<RecentTransactionsWidget
							transactions={data.dashboard.recentTransactions}
						/>
					{:else if widget.type === 'account-balances'}
						<AccountBalancesWidget accounts={data.accounts} />
					{:else if widget.type === 'upcoming-bills'}
						<UpcomingBillsWidget bills={data.upcomingBills} />
					{:else if widget.type === 'savings-goals'}
						<SavingsGoalsWidget goals={data.savingsGoals} />
					{:else if widget.type === 'cash-flow'}
						<CashFlowWidget monthlyTrend={data.monthlyTrend} />
					{:else if widget.type === 'credit-score'}
						<CreditScoreWidget creditScore={data.creditScore} />
					{:else if widget.type === 'safe-to-spend'}
						<SafeToSpendWidget safeToSpend={data.safeToSpend} />
					{:else if widget.type === 'quick-actions'}
						<QuickActionsWidget />
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Customize Modal -->
<Modal open={showCustomize} onclose={closeCustomize} title="Customize Dashboard">
	<div class="space-y-4">
		<p class="text-sm text-surface-400">
			Toggle widgets on or off, and reorder them using the arrow buttons.
		</p>

		<div class="max-h-96 divide-y divide-surface-700/50 overflow-y-auto">
			{#each editWidgets as widget, i (widget.id)}
				<div class="flex items-center gap-3 py-3 transition-colors hover:bg-surface-750/50 px-2 -mx-2 rounded-lg">
					<!-- Toggle -->
					<button
						type="button"
						class="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 {widget.visible
							? 'bg-primary-600'
							: 'bg-surface-600'}"
						onclick={() => toggleWidget(widget.id)}
						aria-label="Toggle {widgetMeta[widget.type]?.label}"
					>
						<span
							class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 {widget.visible
								? 'translate-x-4'
								: 'translate-x-0'}"
						></span>
					</button>

					<!-- Widget info -->
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-white">
							{widgetMeta[widget.type]?.label || widget.type}
						</p>
						<p class="text-xs text-surface-500">
							{widgetMeta[widget.type]?.description || ''}
						</p>
					</div>

					<!-- Reorder buttons -->
					<div class="flex flex-col gap-0.5">
						<button
							type="button"
							class="rounded p-0.5 text-surface-400 hover:bg-surface-700 hover:text-white disabled:opacity-30 transition-colors"
							disabled={i === 0}
							onclick={() => moveWidgetUp(i)}
							aria-label="Move up"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
							</svg>
						</button>
						<button
							type="button"
							class="rounded p-0.5 text-surface-400 hover:bg-surface-700 hover:text-white disabled:opacity-30 transition-colors"
							disabled={i === editWidgets.length - 1}
							onclick={() => moveWidgetDown(i)}
							aria-label="Move down"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Action buttons -->
		<div class="flex items-center justify-between border-t border-surface-700 pt-4">
			<Button variant="ghost" size="sm" onclick={resetLayout} loading={saving}>
				Reset to Default
			</Button>
			<div class="flex gap-2">
				<Button variant="secondary" size="sm" onclick={closeCustomize}>Cancel</Button>
				<Button variant="primary" size="sm" onclick={saveLayout} loading={saving}>
					Save Layout
				</Button>
			</div>
		</div>
	</div>
</Modal>
