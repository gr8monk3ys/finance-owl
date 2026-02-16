<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let saving = $state(false);
	let processing = $state(false);

	// Form state bound to config values
	let enabled = $state(false);
	let roundTo = $state(1);
	let multiplier = $state(1);
	let maxDailyRoundUp = $state(10);
	let savingsGoalId = $state('');
	let accountId = $state('');

	// Sync form state when data changes
	$effect(() => {
		if (data.config) {
			enabled = data.config.enabled ?? false;
			roundTo = data.config.roundTo ?? 1;
			multiplier = data.config.multiplier ?? 1;
			maxDailyRoundUp = data.config.maxDailyRoundUp ?? 10;
			savingsGoalId = data.config.savingsGoalId ?? '';
			accountId = data.config.accountId ?? '';
		}
	});

	const stats = $derived(data.stats);
	const pending = $derived(data.pending ?? []);
	const savingsGoals = $derived(data.savingsGoals ?? []);
	const accounts = $derived(data.accounts ?? []);

	// Filter to checking/savings accounts for the account selector
	const spendingAccounts = $derived(
		accounts.filter((a: any) => ['checking', 'savings', 'credit_card'].includes(a.type))
	);

	const pendingTotal = $derived(
		pending.reduce((sum: number, p: any) => sum + p.roundUpAmount, 0)
	);

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	// Example calculation for preview
	const exampleOriginal = $derived.by(() => {
		const examples: Record<number, number> = { 1: 4.5, 5: 4.5, 10: 4.5 };
		return examples[roundTo] ?? 4.5;
	});

	const exampleRounded = $derived(Math.ceil(exampleOriginal / roundTo) * roundTo);
	const exampleRoundUp = $derived(
		Math.round((exampleRounded - exampleOriginal) * multiplier * 100) / 100
	);
</script>

<svelte:head>
	<title>Round-Up Savings - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<div class="flex items-center gap-3">
				<a
					href="/smart-savings"
					class="text-surface-500 transition hover:text-white"
					aria-label="Back to Smart Savings"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</a>
				<h2 class="text-2xl font-bold text-white">Round-Up Savings</h2>
			</div>
			<p class="mt-1 text-sm text-surface-400">
				Automatically round up your purchases and save the difference
			</p>
		</div>
	</div>

	<!-- Stats Cards -->
	{#if stats}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
						<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">All-Time Saved</p>
						<p class="text-xl font-bold text-green-400">{fmt(stats.allTimeTotal)}</p>
						<p class="text-xs text-surface-500">{stats.allTimeCount} round-up{stats.allTimeCount !== 1 ? 's' : ''}</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
						<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">This Month</p>
						<p class="text-xl font-bold text-primary-400">{fmt(stats.thisMonthTotal)}</p>
						<p class="text-xs text-surface-500">{stats.thisMonthCount} round-up{stats.thisMonthCount !== 1 ? 's' : ''}</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
						<svg class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Average Round-Up</p>
						<p class="text-xl font-bold text-purple-400">{fmt(stats.averageRoundUp)}</p>
						<p class="text-xs text-surface-500">per transaction</p>
					</div>
				</div>
			</Card>
			<Card>
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-600/20">
						<svg class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-surface-400">Largest Round-Up</p>
						<p class="text-xl font-bold text-yellow-400">{fmt(stats.largestRoundUp)}</p>
						<p class="text-xs text-surface-500">single transaction</p>
					</div>
				</div>
			</Card>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Configuration Card -->
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Round-Up Configuration</h3>

			<form
				method="POST"
				action="?/updateConfig"
				class="space-y-5"
				use:enhance={() => {
					saving = true;
					return async ({ update }) => {
						saving = false;
						await update();
						await invalidateAll();
					};
				}}
			>
				<!-- Enable/Disable Toggle -->
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-white">Enable Round-Ups</p>
						<p class="text-xs text-surface-500">
							Automatically track round-ups on your purchases
						</p>
					</div>
					<button
						type="button"
						onclick={() => (enabled = !enabled)}
						class="relative h-6 w-11 rounded-full transition {enabled
							? 'bg-primary-600'
							: 'bg-surface-600'}"
						aria-label="Toggle round-ups"
					>
						<span
							class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {enabled
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
					<input type="hidden" name="enabled" value={enabled.toString()} />
				</div>

				<!-- Round To Amount -->
				<div>
					<label class="mb-1.5 block text-sm font-medium text-surface-300" for="roundTo">
						Round up to nearest
					</label>
					<div class="grid grid-cols-3 gap-2">
						{#each [1, 5, 10] as value}
							<button
								type="button"
								onclick={() => (roundTo = value)}
								class="rounded-lg border px-3 py-2 text-center text-sm transition {roundTo ===
								value
									? 'border-primary-500 bg-primary-600/10 text-primary-400'
									: 'border-surface-700 bg-surface-800 text-surface-300 hover:border-surface-600'}"
							>
								${value}.00
							</button>
						{/each}
					</div>
					<input type="hidden" name="roundTo" value={roundTo} />
				</div>

				<!-- Multiplier -->
				<div>
					<label class="mb-1.5 block text-sm font-medium text-surface-300" for="multiplier">
						Multiplier
					</label>
					<div class="grid grid-cols-3 gap-2">
						{#each [1, 2, 3] as value}
							<button
								type="button"
								onclick={() => (multiplier = value)}
								class="rounded-lg border px-3 py-2 text-center text-sm transition {multiplier ===
								value
									? 'border-primary-500 bg-primary-600/10 text-primary-400'
									: 'border-surface-700 bg-surface-800 text-surface-300 hover:border-surface-600'}"
							>
								{value}x
							</button>
						{/each}
					</div>
					<p class="mt-1 text-xs text-surface-500">
						Multiply your round-up amount for faster savings
					</p>
					<input type="hidden" name="multiplier" value={multiplier} />
				</div>

				<!-- Savings Goal -->
				<div>
					<label class="mb-1.5 block text-sm font-medium text-surface-300" for="savingsGoalId">
						Save to Goal
					</label>
					<select
						id="savingsGoalId"
						name="savingsGoalId"
						bind:value={savingsGoalId}
						class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="">No specific goal</option>
						{#each savingsGoals as goal (goal.id)}
							<option value={goal.id}>{goal.name}</option>
						{/each}
					</select>
				</div>

				<!-- Account to Watch -->
				<div>
					<label class="mb-1.5 block text-sm font-medium text-surface-300" for="accountId">
						Watch Account
					</label>
					<select
						id="accountId"
						name="accountId"
						bind:value={accountId}
						class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="">All accounts</option>
						{#each spendingAccounts as acct (acct.id)}
							<option value={acct.id}>
								{acct.name}
								{#if acct.institutionName}({acct.institutionName}){/if}
							</option>
						{/each}
					</select>
				</div>

				<!-- Daily Cap -->
				<div>
					<label class="mb-1.5 block text-sm font-medium text-surface-300" for="maxDailyRoundUp">
						Daily Cap
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-500">$</span>
						<input
							id="maxDailyRoundUp"
							name="maxDailyRoundUp"
							type="number"
							min="1"
							step="1"
							bind:value={maxDailyRoundUp}
							class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
					<p class="mt-1 text-xs text-surface-500">
						Maximum round-up amount per day to avoid surprises
					</p>
				</div>

				<!-- Example Preview -->
				<div class="rounded-lg border border-surface-700 bg-surface-800/50 p-3">
					<p class="text-xs font-medium text-surface-400">Preview</p>
					<div class="mt-2 flex items-center gap-2 text-sm">
						<span class="text-surface-300">{fmt(exampleOriginal)} purchase</span>
						<svg class="h-4 w-4 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
						<span class="text-surface-300">rounded to {fmt(exampleRounded)}</span>
						<svg class="h-4 w-4 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
						<span class="font-medium text-green-400">save {fmt(exampleRoundUp)}</span>
					</div>
				</div>

				<Button type="submit" class="w-full" loading={saving}>
					Save Configuration
				</Button>
			</form>
		</Card>

		<!-- Pending Round-Ups -->
		<div class="space-y-6">
			<Card>
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h3 class="text-lg font-semibold text-white">Pending Round-Ups</h3>
						<p class="text-sm text-surface-400">
							{pending.length} transaction{pending.length !== 1 ? 's' : ''} ready to process
						</p>
					</div>
					{#if pending.length > 0}
						<form
							method="POST"
							action="?/processRoundUps"
							use:enhance={() => {
								processing = true;
								return async ({ update }) => {
									processing = false;
									await update();
									await invalidateAll();
								};
							}}
						>
							<Button type="submit" size="sm" loading={processing}>
								Process All ({fmt(pendingTotal)})
							</Button>
						</form>
					{/if}
				</div>

				{#if pending.length > 0}
					<div class="space-y-2">
						{#each pending as roundUp (roundUp.transactionId)}
							<div class="flex items-center justify-between rounded-lg bg-surface-800/50 p-3">
								<div>
									<p class="text-sm font-medium text-white">{roundUp.transactionName}</p>
									<p class="text-xs text-surface-500">{roundUp.transactionDate}</p>
								</div>
								<div class="text-right">
									<p class="text-xs text-surface-400">
										{fmt(roundUp.originalAmount)} &rarr; {fmt(roundUp.roundedAmount)}
									</p>
									<p class="text-sm font-medium text-green-400">+{fmt(roundUp.roundUpAmount)}</p>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<svg
							class="mx-auto h-10 w-10 text-surface-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<p class="mt-2 text-sm text-surface-400">No pending round-ups</p>
						<p class="text-xs text-surface-500">
							{#if enabled}
								New round-ups will appear as you make purchases
							{:else}
								Enable round-ups to start saving automatically
							{/if}
						</p>
					</div>
				{/if}
			</Card>

			<!-- How It Works -->
			<Card>
				<h3 class="mb-3 text-lg font-semibold text-white">How Round-Ups Work</h3>
				<div class="space-y-3">
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-400">
							1
						</div>
						<div>
							<p class="text-sm font-medium text-white">You make a purchase</p>
							<p class="text-xs text-surface-500">Like a $4.50 coffee</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-400">
							2
						</div>
						<div>
							<p class="text-sm font-medium text-white">We round it up</p>
							<p class="text-xs text-surface-500">
								To the nearest ${roundTo} = ${exampleRounded.toFixed(2)}
							</p>
						</div>
					</div>
					<div class="flex items-start gap-3">
						<div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-400">
							3
						</div>
						<div>
							<p class="text-sm font-medium text-white">The difference goes to savings</p>
							<p class="text-xs text-surface-500">
								{fmt(exampleRoundUp)} saved automatically
								{#if multiplier > 1}
									({multiplier}x multiplier applied)
								{/if}
							</p>
						</div>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
