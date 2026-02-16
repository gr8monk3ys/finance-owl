<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showCreateModal = $state(false);
	let selectedTemplate = $state<any>(null);
	let entryChallenge = $state<any>(null);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showCreateModal = false;
			selectedTemplate = null;
			entryChallenge = null;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function getProgressPercent(current: number, target: number): number {
		if (target <= 0) return 0;
		return Math.min((current / target) * 100, 100);
	}

	function getStatusColor(status: string): string {
		if (status === 'completed') return 'bg-green-900/50 text-green-400';
		if (status === 'abandoned') return 'bg-red-900/50 text-red-400';
		return 'bg-primary-900/50 text-primary-400';
	}

	function getDaysRemaining(endDate: string): number {
		const end = new Date(endDate + 'T00:00:00');
		const now = new Date();
		const diff = end.getTime() - now.getTime();
		return Math.max(0, Math.ceil(diff / 86400000));
	}

	const typeLabels: Record<string, string> = {
		no_spend: 'No-Spend',
		round_up: 'Round-Up',
		'52_week': '52-Week',
		penny: 'Penny',
		custom: 'Custom'
	};

	const activeChallenges = $derived(
		data.challenges.filter((c: any) => c.status === 'active')
	);
	const pastChallenges = $derived(
		data.challenges.filter((c: any) => c.status !== 'active')
	);
</script>

<svelte:head>
	<title>Savings Challenges - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Savings Challenges</h2>
			<p class="mt-1 text-sm text-surface-400">
				Gamify your savings with fun challenges
			</p>
		</div>
		<Button onclick={() => (showCreateModal = true)}>Start Challenge</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Stats -->
	<div class="grid gap-4 sm:grid-cols-4">
		<Card>
			<p class="text-sm text-surface-400">Active</p>
			<p class="mt-1 text-2xl font-bold text-primary-400">{data.stats.activeChallenges}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Completed</p>
			<p class="mt-1 text-2xl font-bold text-green-400">{data.stats.totalCompleted}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Saved</p>
			<p class="mt-1 text-2xl font-bold text-white">{fmt(data.stats.totalSaved)}</p>
		</Card>
		<Card>
			<div class="flex items-center gap-2">
				<p class="text-sm text-surface-400">Best Streak</p>
			</div>
			<p class="mt-1 text-2xl font-bold text-yellow-400">
				{data.stats.longestStreak} days
			</p>
		</Card>
	</div>

	<!-- Active Challenges -->
	{#if activeChallenges.length === 0}
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
						d="M13 10V3L4 14h7v7l9-11h-7z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No active challenges</p>
				<p class="mt-1 text-sm text-surface-500">
					Start a challenge to begin saving with purpose.
				</p>
			</div>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each activeChallenges as challenge}
				{@const progress = getProgressPercent(challenge.currentAmount, challenge.targetAmount)}
				{@const daysLeft = getDaysRemaining(challenge.endDate)}
				<Card>
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h3 class="font-semibold text-white">{challenge.name}</h3>
								<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(challenge.status)}">
									{typeLabels[challenge.type] ?? challenge.type}
								</span>
							</div>
							{#if challenge.description}
								<p class="mt-1 text-sm text-surface-400">{challenge.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							{#if challenge.streakDays > 0}
								<div class="text-center">
									<p class="text-lg font-bold text-yellow-400">{challenge.streakDays}</p>
									<p class="text-xs text-surface-500">day streak</p>
								</div>
							{/if}
							<div class="text-center">
								<p class="text-lg font-bold text-surface-300">{daysLeft}</p>
								<p class="text-xs text-surface-500">days left</p>
							</div>
						</div>
					</div>

					<div class="mt-4">
						<div class="flex items-end justify-between">
							<span class="text-sm text-surface-300">
								{fmt(challenge.currentAmount)} of {fmt(challenge.targetAmount)}
							</span>
							<span class="text-sm font-semibold text-primary-400">
								{progress.toFixed(0)}%
							</span>
						</div>
						<div class="mt-1.5 h-3 overflow-hidden rounded-full bg-surface-700">
							<div
								class="h-full rounded-full bg-primary-500 transition-all"
								style="width: {progress}%"
							></div>
						</div>
					</div>

					<div class="mt-4 flex gap-2 border-t border-surface-700 pt-3">
						<Button size="sm" onclick={() => (entryChallenge = challenge)}>
							Log Entry
						</Button>
						<form method="POST" action="?/abandon" use:enhance>
							<input type="hidden" name="id" value={challenge.id} />
							<Button type="submit" variant="ghost" size="sm">Abandon</Button>
						</form>
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<!-- Past Challenges -->
	{#if pastChallenges.length > 0}
		<div>
			<h3 class="mb-3 text-lg font-semibold text-white">Past Challenges</h3>
			<div class="space-y-2">
				{#each pastChallenges as challenge}
					<Card>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(challenge.status)}">
									{challenge.status}
								</span>
								<div>
									<p class="font-medium text-white">{challenge.name}</p>
									<p class="text-xs text-surface-500">
										{fmt(challenge.currentAmount)} saved
										{#if challenge.streakDays > 0}
											&middot; {challenge.streakDays} day streak
										{/if}
									</p>
								</div>
							</div>
							<p class="text-sm text-surface-400">
								{typeLabels[challenge.type] ?? challenge.type}
							</p>
						</div>
					</Card>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Start Challenge Modal -->
<Modal open={showCreateModal} onclose={() => { showCreateModal = false; selectedTemplate = null; }} title="Start a Challenge">
	{#if !selectedTemplate}
		<div class="space-y-3">
			<p class="text-sm text-surface-400">Choose a challenge template:</p>
			{#each data.templates as template}
				<button
					class="w-full rounded-lg border border-surface-600 bg-surface-700/50 p-4 text-left transition hover:border-primary-500 hover:bg-surface-700"
					onclick={() => (selectedTemplate = template)}
				>
					<p class="font-medium text-white">{template.name}</p>
					<p class="mt-1 text-sm text-surface-400">{template.description}</p>
					{#if template.targetAmount > 0}
						<p class="mt-2 text-xs text-primary-400">
							Target: {fmt(template.targetAmount)} &middot; {template.durationDays} days
						</p>
					{/if}
				</button>
			{/each}
		</div>
	{:else}
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
			<input type="hidden" name="type" value={selectedTemplate.type} />

			<div>
				<label for="challengeName" class="block text-sm font-medium text-surface-300">
					Name
				</label>
				<input
					id="challengeName"
					name="name"
					type="text"
					value={selectedTemplate.name}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			<div>
				<label for="challengeDescription" class="block text-sm font-medium text-surface-300">
					Description
				</label>
				<input
					id="challengeDescription"
					name="description"
					type="text"
					value={selectedTemplate.description}
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>

			{#if selectedTemplate.type === 'custom'}
				<div>
					<label for="challengeTarget" class="block text-sm font-medium text-surface-300">
						Target Amount
					</label>
					<input
						id="challengeTarget"
						name="targetAmount"
						type="number"
						step="0.01"
						min="0"
						value={selectedTemplate.targetAmount}
						required
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					/>
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (selectedTemplate = null)}>
					Back
				</Button>
				<Button type="submit">Start Challenge</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Log Entry Modal -->
<Modal open={entryChallenge !== null} onclose={() => (entryChallenge = null)} title="Log Entry">
	{#if entryChallenge}
		<form
			method="POST"
			action="?/addEntry"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="challengeId" value={entryChallenge.id} />

			<p class="text-sm text-surface-400">
				Adding entry to <span class="font-medium text-white">{entryChallenge.name}</span>
			</p>

			<div>
				<label for="entryAmount" class="block text-sm font-medium text-surface-300">
					Amount
				</label>
				<input
					id="entryAmount"
					name="amount"
					type="number"
					step="0.01"
					min="0"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="25.00"
				/>
			</div>

			<div>
				<label for="entryNote" class="block text-sm font-medium text-surface-300">
					Note (optional)
				</label>
				<input
					id="entryNote"
					name="note"
					type="text"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Week 3 savings"
				/>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="ghost" type="button" onclick={() => (entryChallenge = null)}>
					Cancel
				</Button>
				<Button type="submit">Add Entry</Button>
			</div>
		</form>
	{/if}
</Modal>
