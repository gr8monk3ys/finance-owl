<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showCreateModal = $state(false);
	let showAllocateModal = $state(false);
	let showTransferModal = $state(false);
	let editingEnvelope = $state<any>(null);
	let allocatingEnvelope = $state<any>(null);

	// Predefined envelope colors
	const envelopeColors = [
		'#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
		'#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1'
	];

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showCreateModal = false;
			showAllocateModal = false;
			showTransferModal = false;
			editingEnvelope = null;
			allocatingEnvelope = null;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function getProgressColor(percentUsed: number): string {
		if (percentUsed >= 100) return 'bg-red-500';
		if (percentUsed >= 80) return 'bg-yellow-500';
		return 'bg-emerald-500';
	}

	function getProgressTextColor(percentUsed: number): string {
		if (percentUsed >= 100) return 'text-red-400';
		if (percentUsed >= 80) return 'text-yellow-400';
		return 'text-emerald-400';
	}

	function getUnallocatedColor(amount: number): string {
		if (amount < 0) return 'text-red-400';
		if (amount === 0) return 'text-emerald-400';
		return 'text-amber-400';
	}

	function getUnallocatedLabel(amount: number): string {
		if (amount < 0) return 'Overspent';
		if (amount === 0) return 'Fully Assigned';
		return 'Ready to Assign';
	}

	const goalEnvelopes = $derived(data.envelopes.filter((e: any) => e.isGoal));
	const spendingEnvelopes = $derived(data.envelopes.filter((e: any) => !e.isGoal));
</script>

<svelte:head>
	<title>Envelopes - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-white">Envelope Budget</h2>
			<p class="mt-1 text-sm text-surface-400">
				Give every dollar a job. Allocate your income into envelopes.
			</p>
		</div>
		<div class="flex gap-2">
			<Button variant="ghost" onclick={() => (showTransferModal = true)}>Transfer</Button>
			<Button onclick={() => (showCreateModal = true)}>New Envelope</Button>
		</div>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Ready to Assign Banner -->
	<div class="rounded-xl border border-surface-700 bg-surface-800 p-5">
		<div class="flex flex-col items-center justify-center text-center sm:flex-row sm:justify-between sm:text-left">
			<div>
				<p class="text-sm font-medium text-surface-400">
					{getUnallocatedLabel(data.summary.unallocatedAmount)}
				</p>
				<p class="mt-1 text-3xl font-bold {getUnallocatedColor(data.summary.unallocatedAmount)}">
					{fmt(Math.abs(data.summary.unallocatedAmount))}
				</p>
			</div>
			<div class="mt-4 grid grid-cols-3 gap-6 sm:mt-0">
				<div class="text-center">
					<p class="text-xs text-surface-500">Income</p>
					<p class="text-sm font-semibold text-white">{fmt(data.summary.totalIncome)}</p>
				</div>
				<div class="text-center">
					<p class="text-xs text-surface-500">Allocated</p>
					<p class="text-sm font-semibold text-white">{fmt(data.summary.totalAllocated)}</p>
				</div>
				<div class="text-center">
					<p class="text-xs text-surface-500">Spent</p>
					<p class="text-sm font-semibold text-white">{fmt(data.summary.totalSpent)}</p>
				</div>
			</div>
		</div>

		<!-- Overall progress bar -->
		{#if data.summary.totalIncome > 0}
			<div class="mt-4">
				<div class="h-2 overflow-hidden rounded-full bg-surface-700">
					<div
						class="h-full rounded-full bg-emerald-500/80 transition-all"
						style="width: {Math.min((data.summary.totalAllocated / data.summary.totalIncome) * 100, 100)}%"
					></div>
				</div>
				<p class="mt-1 text-right text-xs text-surface-500">
					{((data.summary.totalAllocated / data.summary.totalIncome) * 100).toFixed(0)}% of income allocated
				</p>
			</div>
		{/if}
	</div>

	<!-- Spending Envelopes -->
	{#if data.envelopes.length === 0}
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
						d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No envelopes yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Create envelopes to start your zero-based budget. Give every dollar a job!
				</p>
				<Button class="mt-4" onclick={() => (showCreateModal = true)}>
					Create Your First Envelope
				</Button>
			</div>
		</Card>
	{:else}
		<!-- Spending section -->
		{#if spendingEnvelopes.length > 0}
			<div>
				<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-400">
					Spending Envelopes
				</h3>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each spendingEnvelopes as envelope}
						<button
							type="button"
							class="rounded-xl border border-surface-700 bg-surface-800 p-4 text-left transition hover:border-surface-600 hover:bg-surface-750 focus:outline-none focus:ring-2 focus:ring-primary-500"
							onclick={() => (editingEnvelope = envelope)}
						>
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-2.5">
									<div
										class="h-3.5 w-3.5 rounded-full"
										style="background-color: {envelope.color || envelope.categoryColor || '#6366f1'}"
									></div>
									<div>
										<p class="font-medium text-white">{envelope.name}</p>
										{#if envelope.categoryName}
											<p class="text-xs text-surface-500">{envelope.categoryName}</p>
										{/if}
									</div>
								</div>
								{#if envelope.rollover}
									<span class="rounded-full bg-surface-700 px-2 py-0.5 text-[10px] text-surface-400">
										rollover
									</span>
								{/if}
							</div>

							<div class="mt-3">
								<div class="flex items-end justify-between text-sm">
									<span class="text-surface-400">
										{fmt(envelope.spentAmount)} of {fmt(envelope.budgetedAmount)}
									</span>
									<span class="font-semibold {getProgressTextColor(envelope.percentUsed)}">
										{fmt(envelope.remainingAmount)}
									</span>
								</div>
								<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-700">
									<div
										class="{getProgressColor(envelope.percentUsed)} h-full rounded-full transition-all"
										style="width: {Math.min(envelope.percentUsed, 100)}%"
									></div>
								</div>
							</div>

							<!-- Quick allocate button -->
							<div class="mt-3 flex justify-end">
								<span
									role="button"
									tabindex="0"
									class="text-xs text-primary-400 hover:text-primary-300"
									onclick={(e: MouseEvent) => { e.stopPropagation(); allocatingEnvelope = envelope; showAllocateModal = true; }}
									onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); allocatingEnvelope = envelope; showAllocateModal = true; } }}
								>
									+ Assign Funds
								</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Goal Envelopes -->
		{#if goalEnvelopes.length > 0}
			<div>
				<h3 class="mb-3 text-sm font-semibold uppercase tracking-wider text-surface-400">
					Savings Goals
				</h3>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each goalEnvelopes as envelope}
						<button
							type="button"
							class="rounded-xl border border-surface-700 bg-surface-800 p-4 text-left transition hover:border-surface-600 hover:bg-surface-750 focus:outline-none focus:ring-2 focus:ring-primary-500"
							onclick={() => (editingEnvelope = envelope)}
						>
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-2.5">
									<div
										class="h-3.5 w-3.5 rounded-full"
										style="background-color: {envelope.color || '#22c55e'}"
									></div>
									<div>
										<p class="font-medium text-white">{envelope.name}</p>
										{#if envelope.targetAmount}
											<p class="text-xs text-surface-500">
												Goal: {fmt(envelope.targetAmount)}
											</p>
										{/if}
									</div>
								</div>
								<svg class="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
								</svg>
							</div>

							<div class="mt-3">
								<div class="flex items-end justify-between text-sm">
									<span class="text-surface-400">
										{fmt(envelope.remainingAmount)} saved
									</span>
									{#if envelope.targetAmount}
										<span class="font-semibold text-emerald-400">
											{(envelope.goalProgress ?? 0).toFixed(0)}%
										</span>
									{/if}
								</div>
								{#if envelope.targetAmount}
									<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-700">
										<div
											class="h-full rounded-full bg-emerald-500 transition-all"
											style="width: {Math.min(envelope.goalProgress ?? 0, 100)}%"
										></div>
									</div>
								{/if}
							</div>

							<div class="mt-3 flex justify-end">
								<span
									role="button"
									tabindex="0"
									class="text-xs text-primary-400 hover:text-primary-300"
									onclick={(e: MouseEvent) => { e.stopPropagation(); allocatingEnvelope = envelope; showAllocateModal = true; }}
									onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.stopPropagation(); allocatingEnvelope = envelope; showAllocateModal = true; } }}
								>
									+ Assign Funds
								</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}

	<!-- Rollover action -->
	{#if data.envelopes.length > 0}
		<div class="flex justify-end border-t border-surface-700 pt-4">
			<form method="POST" action="?/rollover" use:enhance>
				<Button variant="ghost" type="submit" size="sm">
					Roll Over to Next Period
				</Button>
			</form>
		</div>
	{/if}
</div>

<!-- ── Create Envelope Modal ──────────────────────────────────────── -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Create Envelope">
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
			<label for="envelopeName" class="block text-sm font-medium text-surface-300">
				Name
			</label>
			<input
				id="envelopeName"
				name="name"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="e.g. Groceries, Rent, Emergency Fund"
			/>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="envelopeAmount" class="block text-sm font-medium text-surface-300">
					Budget Amount
				</label>
				<input
					id="envelopeAmount"
					name="budgetedAmount"
					type="number"
					step="0.01"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="0.00"
				/>
			</div>
			<div>
				<label for="envelopePeriod" class="block text-sm font-medium text-surface-300">
					Period
				</label>
				<select
					id="envelopePeriod"
					name="period"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="monthly">Monthly</option>
					<option value="weekly">Weekly</option>
					<option value="yearly">Yearly</option>
				</select>
			</div>
		</div>

		<div>
			<label for="envelopeCategory" class="block text-sm font-medium text-surface-300">
				Link to Category (optional)
			</label>
			<select
				id="envelopeCategory"
				name="categoryId"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="">None</option>
				{#each data.categories as cat}
					<option value={cat.id}>{cat.name}</option>
				{/each}
			</select>
		</div>

		<!-- Color picker -->
		<div>
			<p class="block text-sm font-medium text-surface-300">Color</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each envelopeColors as color, i}
					<label class="cursor-pointer">
						<input
							type="radio"
							name="color"
							value={color}
							checked={i === 0}
							class="peer sr-only"
						/>
						<div
							class="h-7 w-7 rounded-full border-2 border-transparent transition peer-checked:border-white peer-checked:ring-2 peer-checked:ring-primary-500"
							style="background-color: {color}"
						></div>
					</label>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap gap-4">
			<label class="flex items-center gap-2">
				<input
					name="rollover"
					type="checkbox"
					class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
				/>
				<span class="text-sm text-surface-300">Roll over unused</span>
			</label>
			<label class="flex items-center gap-2">
				<input
					name="isGoal"
					type="checkbox"
					class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
				/>
				<span class="text-sm text-surface-300">Savings goal</span>
			</label>
		</div>

		<div>
			<label for="targetAmount" class="block text-sm font-medium text-surface-300">
				Target Amount (for goals)
			</label>
			<input
				id="targetAmount"
				name="targetAmount"
				type="number"
				step="0.01"
				min="0"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Optional"
			/>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Create Envelope</Button>
		</div>
	</form>
</Modal>

<!-- ── Allocate Funds Modal ───────────────────────────────────────── -->
<Modal
	open={showAllocateModal}
	onclose={() => { showAllocateModal = false; allocatingEnvelope = null; }}
	title="Assign Funds"
>
	{#if allocatingEnvelope}
		<form
			method="POST"
			action="?/allocate"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="envelopeId" value={allocatingEnvelope.id} />

			<div class="rounded-lg bg-surface-700/50 p-3">
				<div class="flex items-center gap-2">
					<div
						class="h-3 w-3 rounded-full"
						style="background-color: {allocatingEnvelope.color || '#6366f1'}"
					></div>
					<p class="font-medium text-white">{allocatingEnvelope.name}</p>
				</div>
				<p class="mt-1 text-sm text-surface-400">
					Currently: {fmt(allocatingEnvelope.budgetedAmount)} budgeted,
					{fmt(allocatingEnvelope.remainingAmount)} remaining
				</p>
			</div>

			{#if data.summary.unallocatedAmount > 0}
				<p class="text-sm text-emerald-400">
					{fmt(data.summary.unallocatedAmount)} available to assign
				</p>
			{/if}

			<div>
				<label for="allocateAmount" class="block text-sm font-medium text-surface-300">
					Amount to Assign
				</label>
				<input
					id="allocateAmount"
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="0.00"
				/>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => { showAllocateModal = false; allocatingEnvelope = null; }}>
					Cancel
				</Button>
				<Button type="submit">Assign</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- ── Transfer Modal ─────────────────────────────────────────────── -->
<Modal
	open={showTransferModal}
	onclose={() => (showTransferModal = false)}
	title="Transfer Between Envelopes"
>
	<form
		method="POST"
		action="?/transfer"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="transferFrom" class="block text-sm font-medium text-surface-300">
				From Envelope
			</label>
			<select
				id="transferFrom"
				name="fromEnvelopeId"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="">Select...</option>
				{#each data.envelopes as env}
					<option value={env.id}>
						{env.name} ({fmt(env.remainingAmount)} available)
					</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="transferTo" class="block text-sm font-medium text-surface-300">
				To Envelope
			</label>
			<select
				id="transferTo"
				name="toEnvelopeId"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="">Select...</option>
				{#each data.envelopes as env}
					<option value={env.id}>{env.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="transferAmount" class="block text-sm font-medium text-surface-300">
				Amount
			</label>
			<input
				id="transferAmount"
				name="amount"
				type="number"
				step="0.01"
				min="0.01"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="0.00"
			/>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showTransferModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Transfer</Button>
		</div>
	</form>
</Modal>

<!-- ── Edit Envelope Modal ────────────────────────────────────────── -->
<Modal
	open={editingEnvelope !== null}
	onclose={() => (editingEnvelope = null)}
	title="Edit Envelope"
>
	{#if editingEnvelope}
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
			<input type="hidden" name="id" value={editingEnvelope.id} />

			<div>
				<label for="editName" class="block text-sm font-medium text-surface-300">
					Name
				</label>
				<input
					id="editName"
					name="name"
					type="text"
					required
					value={editingEnvelope.name}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="editBudgetedAmount" class="block text-sm font-medium text-surface-300">
					Budget Amount
				</label>
				<input
					id="editBudgetedAmount"
					name="budgetedAmount"
					type="number"
					step="0.01"
					min="0"
					value={editingEnvelope.budgetedAmount}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<!-- Color picker -->
			<div>
				<p class="block text-sm font-medium text-surface-300">Color</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each envelopeColors as color}
						<label class="cursor-pointer">
							<input
								type="radio"
								name="color"
								value={color}
								checked={editingEnvelope.color === color}
								class="peer sr-only"
							/>
							<div
								class="h-7 w-7 rounded-full border-2 border-transparent transition peer-checked:border-white peer-checked:ring-2 peer-checked:ring-primary-500"
								style="background-color: {color}"
							></div>
						</label>
					{/each}
				</div>
			</div>

			<div class="flex flex-wrap gap-4">
				<label class="flex items-center gap-2">
					<input
						name="rollover"
						type="checkbox"
						checked={editingEnvelope.rollover}
						class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
					/>
					<span class="text-sm text-surface-300">Roll over unused</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						name="isGoal"
						type="checkbox"
						checked={editingEnvelope.isGoal}
						class="h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
					/>
					<span class="text-sm text-surface-300">Savings goal</span>
				</label>
			</div>

			<div>
				<label for="editTargetAmount" class="block text-sm font-medium text-surface-300">
					Target Amount (for goals)
				</label>
				<input
					id="editTargetAmount"
					name="targetAmount"
					type="number"
					step="0.01"
					min="0"
					value={editingEnvelope.targetAmount ?? ''}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Optional"
				/>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (editingEnvelope = null)}>
					Cancel
				</Button>
				<Button type="submit">Save</Button>
			</div>
		</form>

		<form method="POST" action="?/delete" use:enhance class="mt-3 border-t border-surface-700 pt-3">
			<input type="hidden" name="id" value={editingEnvelope.id} />
			<Button type="submit" variant="danger" size="sm">Delete Envelope</Button>
		</form>
	{/if}
</Modal>
