<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showCreateModal = $state(false);
	let editingBudget = $state<any>(null);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showCreateModal = false;
			editingBudget = null;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtCompact(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(amount);
	}

	function getProgressGradient(percentUsed: number): string {
		if (percentUsed >= 100) return 'linear-gradient(90deg, var(--fo-danger-500), var(--fo-danger-400))';
		if (percentUsed >= 80) return 'linear-gradient(90deg, var(--fo-accent-500), var(--fo-danger-400))';
		if (percentUsed >= 50) return 'linear-gradient(90deg, var(--fo-primary-500), var(--fo-accent-500))';
		return 'linear-gradient(90deg, var(--fo-primary-600), var(--fo-primary-400))';
	}

	function getStatusBadge(percentUsed: number): { label: string; class: string } {
		if (percentUsed >= 100) return {
			label: 'Over Budget',
			class: 'bg-red-500/10 text-red-400 ring-red-500/20'
		};
		if (percentUsed >= 80) return {
			label: 'Near Limit',
			class: 'bg-accent-500/10 text-accent-400 ring-accent-500/20'
		};
		if (percentUsed >= 50) return {
			label: 'On Track',
			class: 'bg-primary-500/10 text-primary-400 ring-primary-500/20'
		};
		return {
			label: 'Under Budget',
			class: 'bg-primary-500/10 text-primary-400 ring-primary-500/20'
		};
	}

	function getProgressTextColor(percentUsed: number): string {
		if (percentUsed >= 100) return 'text-red-400';
		if (percentUsed >= 80) return 'text-accent-400';
		return 'text-primary-400';
	}

	function getCategoryIcon(categoryName: string | null): string {
		if (!categoryName) return '?';
		const name = categoryName.toLowerCase();
		if (name.includes('food') || name.includes('grocery') || name.includes('dining') || name.includes('restaurant')) return 'F';
		if (name.includes('transport') || name.includes('gas') || name.includes('auto') || name.includes('car')) return 'T';
		if (name.includes('shop') || name.includes('cloth') || name.includes('retail')) return 'S';
		if (name.includes('entertainment') || name.includes('movie') || name.includes('game')) return 'E';
		if (name.includes('health') || name.includes('medical') || name.includes('doctor')) return 'H';
		if (name.includes('home') || name.includes('rent') || name.includes('mortgage') || name.includes('housing')) return 'R';
		if (name.includes('util') || name.includes('electric') || name.includes('water') || name.includes('internet')) return 'U';
		if (name.includes('travel') || name.includes('hotel') || name.includes('flight')) return 'V';
		if (name.includes('education') || name.includes('school') || name.includes('book')) return 'B';
		if (name.includes('subscription') || name.includes('software')) return 'W';
		return categoryName.charAt(0).toUpperCase();
	}

	// Build category hierarchy for select dropdown
	function getCategoryTree(categories: any[]) {
		const parents = categories.filter((c: any) => !c.parentId);
		return parents.map((parent: any) => ({
			...parent,
			children: categories.filter((c: any) => c.parentId === parent.id)
		}));
	}

	// Filter out categories that already have a budget
	const availableCategories = $derived(
		data.categories.filter(
			(c: any) => !data.budgets.some((b: any) => b.categoryId === c.id)
		)
	);

	// Summary stats
	const onTrackCount = $derived(data.budgets.filter((b: any) => b.percentUsed < 80).length);
	const nearLimitCount = $derived(data.budgets.filter((b: any) => b.percentUsed >= 80 && b.percentUsed < 100).length);
	const overBudgetCount = $derived(data.budgets.filter((b: any) => b.percentUsed >= 100).length);
</script>

<svelte:head>
	<title>Budgets - FinanceOwl</title>
</svelte:head>

<div class="page-enter space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-3xl font-bold tracking-tight text-white">Budgets</h2>
			<p class="mt-1 text-sm text-surface-400">
				{#if data.budgets.length > 0}
					{data.budgets.length} budget{data.budgets.length !== 1 ? 's' : ''} this period
				{:else}
					Set spending limits for your categories
				{/if}
			</p>
		</div>
		<Button onclick={() => (showCreateModal = true)}>
			<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
			Create Budget
		</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/50 p-3 text-sm text-red-300">
			<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
			</svg>
			{form.error}
		</div>
	{/if}

	<!-- Summary strip -->
	<div class="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Budget -->
		<div class="relative overflow-hidden rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-5">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/10">
					<svg class="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
					</svg>
				</div>
				<span class="text-sm font-medium text-surface-400">Total Budget</span>
			</div>
			<p class="count-up mt-2 text-2xl font-bold text-white">{fmtCompact(data.summary.totalBudgeted)}</p>
		</div>

		<!-- Total Spent -->
		<div class="relative overflow-hidden rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-5">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
					<svg class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
					</svg>
				</div>
				<span class="text-sm font-medium text-surface-400">Total Spent</span>
			</div>
			<p class="count-up mt-2 text-2xl font-bold text-white">{fmtCompact(data.summary.totalSpent)}</p>
		</div>

		<!-- Remaining -->
		<div class="relative overflow-hidden rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-5">
			<div class="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-xl {data.summary.totalRemaining >= 0 ? 'bg-primary-500/5' : 'bg-red-500/5'}"></div>
			<div class="relative">
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg {data.summary.totalRemaining >= 0 ? 'bg-primary-500/10' : 'bg-red-500/10'}">
						<svg class="h-4 w-4 {data.summary.totalRemaining >= 0 ? 'text-primary-400' : 'text-red-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<span class="text-sm font-medium text-surface-400">Remaining</span>
				</div>
				<p class="count-up mt-2 text-2xl font-bold {data.summary.totalRemaining >= 0 ? 'text-primary-400' : 'text-red-400'}">
					{fmtCompact(data.summary.totalRemaining)}
				</p>
			</div>
		</div>

		<!-- Overall progress -->
		<div class="relative overflow-hidden rounded-xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850 p-5">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10">
					<svg class="h-4 w-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
					</svg>
				</div>
				<span class="text-sm font-medium text-surface-400">Overall</span>
			</div>
			<div class="mt-3">
				<div class="h-2.5 overflow-hidden rounded-full bg-surface-700">
					<div
						class="progress-fill h-full rounded-full"
						style="width: {Math.min(data.summary.percentUsed, 100)}%;
							background: {getProgressGradient(data.summary.percentUsed)}"
					></div>
				</div>
				<div class="mt-1.5 flex items-center justify-between">
					<span class="text-xs {getProgressTextColor(data.summary.percentUsed)} font-semibold">
						{data.summary.percentUsed.toFixed(0)}% used
					</span>
					<div class="flex gap-2 text-xs text-surface-500">
						{#if onTrackCount > 0}
							<span class="text-primary-400">{onTrackCount} on track</span>
						{/if}
						{#if nearLimitCount > 0}
							<span class="text-accent-400">{nearLimitCount} near</span>
						{/if}
						{#if overBudgetCount > 0}
							<span class="text-red-400">{overBudgetCount} over</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Budget list -->
	{#if data.budgets.length === 0}
		<div class="relative overflow-hidden rounded-2xl border border-surface-700/50 bg-gradient-to-br from-surface-800 to-surface-850">
			<div class="absolute inset-0 bg-gradient-to-br from-primary-500/3 via-transparent to-accent-500/3"></div>
			<div class="relative flex flex-col items-center justify-center py-16 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-700/50">
					<svg
						class="h-8 w-8 text-surface-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<p class="mt-5 text-lg font-semibold text-white">No budgets yet</p>
				<p class="mt-1.5 max-w-sm text-sm text-surface-400">
					Create budgets to track your spending by category and stay on top of your finances.
				</p>
				<button
					class="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:shadow-xl hover:shadow-primary-900/40"
					onclick={() => (showCreateModal = true)}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Create Your First Budget
				</button>
			</div>
		</div>
	{:else}
		<div class="stagger-children space-y-3">
			{#each data.budgets as budget}
				{@const status = getStatusBadge(budget.percentUsed)}
				<div class="group relative overflow-hidden rounded-xl border border-surface-700/30 bg-surface-800 transition-all duration-200 hover:border-surface-600/50 hover:shadow-md hover:shadow-black/10">
					<div class="p-5">
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-center gap-3">
								<!-- Category icon -->
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white/90"
									style="background: linear-gradient(135deg, {budget.categoryColor || '#64748b'}66, {budget.categoryColor || '#64748b'}22)"
								>
									{getCategoryIcon(budget.categoryName)}
								</div>
								<div>
									<div class="flex items-center gap-2">
										<p class="font-semibold text-white">
											{budget.categoryName || 'Unknown Category'}
										</p>
										<!-- Status badge -->
										<span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset {status.class}">
											{status.label}
										</span>
									</div>
									<p class="mt-0.5 text-xs capitalize text-surface-500">{budget.period}</p>
								</div>
							</div>
							<button
								class="rounded-lg border border-surface-700/50 px-2.5 py-1 text-xs text-surface-400 opacity-0 transition-all hover:border-surface-600 hover:bg-surface-750 hover:text-white group-hover:opacity-100"
								onclick={() => (editingBudget = budget)}
							>
								Edit
							</button>
						</div>

						<!-- Progress section -->
						<div class="mt-4">
							<!-- Amounts row -->
							<div class="flex items-end justify-between">
								<div class="flex items-baseline gap-1.5">
									<span class="text-lg font-bold tabular-nums text-white">{fmt(budget.spent)}</span>
									<span class="text-sm text-surface-500">of {fmt(budget.amount)}</span>
									{#if budget.rolloverAmount > 0}
										<span class="ml-1 text-xs text-surface-600">(+{fmtCompact(budget.rolloverAmount)} rollover)</span>
									{/if}
								</div>
								<div class="text-right">
									<span class="text-sm font-semibold tabular-nums {getProgressTextColor(budget.percentUsed)}">
										{#if budget.remaining >= 0}
											{fmt(budget.remaining)} left
										{:else}
											{fmt(Math.abs(budget.remaining))} over
										{/if}
									</span>
								</div>
							</div>

							<!-- Progress bar with gradient -->
							<div class="mt-2.5 h-3 overflow-hidden rounded-full bg-surface-700/60">
								<div
									class="progress-fill h-full rounded-full transition-all duration-500"
									style="width: {Math.min(budget.percentUsed, 100)}%;
										background: {getProgressGradient(budget.percentUsed)}"
								></div>
							</div>

							<!-- Bottom stats -->
							<div class="mt-2 flex items-center justify-between text-xs">
								<span class="{getProgressTextColor(budget.percentUsed)} font-medium">
									{budget.percentUsed.toFixed(0)}% used
								</span>
								{#if budget.percentUsed >= 100}
									<span class="flex items-center gap-1 text-red-400">
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
										</svg>
										Over by {fmt(budget.spent - budget.amount)}
									</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Budget Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Create Budget">
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
			<label for="budgetCategory" class="block text-sm font-medium text-surface-300"
				>Category</label
			>
			<select
				id="budgetCategory"
				name="categoryId"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
			>
				{#each getCategoryTree(availableCategories) as parent}
					<option value={parent.id}>{parent.name}</option>
					{#each parent.children as child}
						<option value={child.id}>&nbsp;&nbsp;{child.name}</option>
					{/each}
				{/each}
			</select>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="budgetAmount" class="block text-sm font-medium text-surface-300"
					>Amount</label
				>
				<div class="relative mt-1">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">$</span>
					<input
						id="budgetAmount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						required
						class="block w-full rounded-lg border border-surface-600/50 bg-surface-750 py-2.5 pl-7 pr-3 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
						placeholder="500.00"
					/>
				</div>
			</div>
			<div>
				<label for="budgetPeriod" class="block text-sm font-medium text-surface-300"
					>Period</label
				>
				<select
					id="budgetPeriod"
					name="period"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600/50 bg-surface-750 px-3 py-2.5 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
				>
					<option value="monthly">Monthly</option>
					<option value="quarterly">Quarterly</option>
					<option value="annual">Annual</option>
				</select>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<input
				id="budgetRollover"
				name="rollover"
				type="checkbox"
				class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
			/>
			<label for="budgetRollover" class="text-sm text-surface-300">
				Roll over unused budget to next period
			</label>
		</div>

		<div class="flex justify-end gap-3 border-t border-surface-700/50 pt-4">
			<Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Create Budget</Button>
		</div>
	</form>
</Modal>

<!-- Edit Budget Modal -->
<Modal
	open={editingBudget !== null}
	onclose={() => (editingBudget = null)}
	title="Edit Budget"
>
	{#if editingBudget}
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
			<input type="hidden" name="id" value={editingBudget.id} />

			<div class="flex items-center gap-3 rounded-lg bg-surface-750/50 p-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white/80"
					style="background: linear-gradient(135deg, {editingBudget.categoryColor || '#64748b'}66, {editingBudget.categoryColor || '#64748b'}22)"
				>
					{getCategoryIcon(editingBudget.categoryName)}
				</div>
				<div>
					<p class="text-sm font-medium text-white">{editingBudget.categoryName}</p>
					<p class="text-xs text-surface-500">
						Currently {editingBudget.percentUsed.toFixed(0)}% used ({fmt(editingBudget.spent)} spent)
					</p>
				</div>
			</div>

			<div>
				<label for="editAmount" class="block text-sm font-medium text-surface-300"
					>Amount</label
				>
				<div class="relative mt-1">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">$</span>
					<input
						id="editAmount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						required
						value={editingBudget.amount}
						class="block w-full rounded-lg border border-surface-600/50 bg-surface-750 py-2.5 pl-7 pr-3 text-white transition-colors focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
					/>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<input
					id="editRollover"
					name="rollover"
					type="checkbox"
					checked={editingBudget.rollover}
					class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
				/>
				<label for="editRollover" class="text-sm text-surface-300">
					Roll over unused budget
				</label>
			</div>

			<div class="flex justify-end gap-3 border-t border-surface-700/50 pt-4">
				<Button variant="ghost" type="button" onclick={() => (editingBudget = null)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>

		<form method="POST" action="?/delete" use:enhance class="mt-3 border-t border-surface-700/50 pt-3">
			<input type="hidden" name="id" value={editingBudget.id} />
			<Button type="submit" variant="danger" size="sm">Delete Budget</Button>
		</form>
	{/if}
</Modal>
