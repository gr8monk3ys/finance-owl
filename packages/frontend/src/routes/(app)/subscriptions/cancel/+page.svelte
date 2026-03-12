<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { Card, Button, Modal, Spinner } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// Wizard state
	let currentStep = $state(0);
	let selectedSubscription = $state<any>(null);
	let selectedProvider = $state<any>(null);
	let providerLookup = $state<any>(null);
	let cancellationReason = $state('');
	let providerSearch = $state('');
	let showEmailModal = $state(false);
	let showScriptModal = $state(false);
	let copiedEmail = $state(false);
	let copiedScript = $state(false);

	$effect(() => {
		if (form?.success && form?.cancellationId) {
			currentStep = 3;
			invalidateAll();
		}
		if (form?.success && form?.providerResult) {
			providerLookup = form.providerResult;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
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

	function getAnnualMultiplier(frequency: string): number {
		const multipliers: Record<string, number> = {
			weekly: 52,
			biweekly: 26,
			monthly: 12,
			quarterly: 4,
			annual: 1
		};
		return multipliers[frequency] ?? 12;
	}

	function getDifficultyColor(difficulty: string): string {
		switch (difficulty) {
			case 'easy':
				return 'bg-green-900/50 text-green-400 border-green-700';
			case 'medium':
				return 'bg-yellow-900/50 text-yellow-400 border-yellow-700';
			case 'hard':
				return 'bg-red-900/50 text-red-400 border-red-700';
			default:
				return 'bg-surface-700 text-surface-300 border-surface-600';
		}
	}

	function getMethodIcon(method: string): string {
		switch (method) {
			case 'online':
				return 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9';
			case 'phone':
				return 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z';
			case 'email':
				return 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
			case 'in_person':
				return 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z';
			case 'chat':
				return 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';
			default:
				return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}

	function getMethodLabel(method: string): string {
		switch (method) {
			case 'online':
				return 'Cancel Online';
			case 'phone':
				return 'Cancel by Phone';
			case 'email':
				return 'Cancel by Email';
			case 'in_person':
				return 'Cancel In Person';
			case 'chat':
				return 'Cancel via Chat';
			default:
				return 'Self-Service';
		}
	}

	function getMethodColor(method: string): string {
		switch (method) {
			case 'online':
				return 'bg-blue-900/30 text-blue-400';
			case 'phone':
				return 'bg-purple-900/30 text-purple-400';
			case 'email':
				return 'bg-amber-900/30 text-amber-400';
			case 'in_person':
				return 'bg-red-900/30 text-red-400';
			case 'chat':
				return 'bg-teal-900/30 text-teal-400';
			default:
				return 'bg-surface-700 text-surface-400';
		}
	}

	function selectSubscription(sub: any) {
		selectedSubscription = sub;
		const name = (sub.merchantName || sub.name).toLowerCase();
		selectedProvider = data.providers.find(
			(p: any) =>
				p.name.toLowerCase().includes(name) ||
				name.includes(p.name.toLowerCase())
		) ?? null;
		currentStep = 1;
	}

	function goToStep(step: number) {
		currentStep = step;
	}

	async function copyToClipboard(text: string, type: 'email' | 'script') {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'email') {
				copiedEmail = true;
				setTimeout(() => (copiedEmail = false), 2000);
			} else {
				copiedScript = true;
				setTimeout(() => (copiedScript = false), 2000);
			}
		} catch {
			// Fallback: select all text
		}
	}

	const filteredProviders = $derived(
		providerSearch
			? data.providers.filter((p: any) =>
					p.name.toLowerCase().includes(providerSearch.toLowerCase())
				)
			: data.providers
	);

	const estimatedAnnualSaving = $derived(
		selectedSubscription
			? selectedSubscription.estimatedAmount *
				getAnnualMultiplier(selectedSubscription.frequency)
			: 0
	);

	const estimatedMonthlySaving = $derived(
		Math.round((estimatedAnnualSaving / 12) * 100) / 100
	);

	const statusLabels: Record<string, { label: string; color: string }> = {
		pending: { label: 'Pending', color: 'bg-yellow-900/50 text-yellow-400' },
		in_progress: { label: 'In Progress', color: 'bg-blue-900/50 text-blue-400' },
		completed: { label: 'Completed', color: 'bg-green-900/50 text-green-400' },
		failed: { label: 'Failed', color: 'bg-red-900/50 text-red-400' }
	};
</script>

<svelte:head>
	<title>Cancel Subscriptions - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Back link -->
	<a
		href="/subscriptions"
		class="inline-flex items-center gap-1 text-sm text-surface-400 hover:text-white transition"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Subscriptions
	</a>

	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Cancel Subscriptions</h2>
			<p class="mt-1 text-surface-400">
				Step-by-step guidance to cancel any subscription
			</p>
		</div>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 border border-red-800 p-4 text-sm text-red-300">
			{form.error}
		</div>
	{/if}

	<!-- Savings Summary -->
	{#if data.savings.totalCancelled > 0}
		<Card>
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-900/30">
					<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div class="flex-1">
					<p class="text-sm text-surface-400">Total Savings from Cancellations</p>
					<div class="mt-1 flex items-baseline gap-4">
						<span class="text-2xl font-bold text-green-400">
							{fmt(data.savings.estimatedAnnualSavings)}
						</span>
						<span class="text-sm text-surface-500">per year</span>
						<span class="text-surface-600">|</span>
						<span class="text-lg font-semibold text-green-400">
							{fmt(data.savings.estimatedMonthlySavings)}
						</span>
						<span class="text-sm text-surface-500">per month</span>
					</div>
				</div>
				<div class="text-right">
					<p class="text-2xl font-bold text-white">{data.savings.totalCancelled}</p>
					<p class="text-xs text-surface-500">cancelled</p>
				</div>
			</div>
		</Card>
	{/if}

	<!-- Step indicators -->
	<div class="flex items-center justify-center gap-2">
		{#each ['Select Subscription', 'Review Provider', 'Confirm', 'Done'] as step, i}
			<div class="flex items-center">
				<button
					onclick={() => { if (i < currentStep) goToStep(i); }}
					class="flex items-center gap-2 {i <= currentStep ? 'text-white' : 'text-surface-500'}"
					disabled={i > currentStep}
				>
					<div
						class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition
						{i < currentStep
							? 'bg-primary-600 text-white'
							: i === currentStep
								? 'bg-primary-600 text-white ring-2 ring-primary-400/30'
								: 'bg-surface-700 text-surface-400'}"
					>
						{#if i < currentStep}
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							{i + 1}
						{/if}
					</div>
					<span class="hidden text-sm sm:inline">{step}</span>
				</button>
				{#if i < 3}
					<div class="mx-2 h-px w-8 {i < currentStep ? 'bg-primary-600' : 'bg-surface-700'}"></div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Step 0: Select a subscription to cancel -->
	{#if currentStep === 0}
		<div class="space-y-4">
			{#if data.subscriptions.length > 0}
				<Card>
					<h3 class="mb-4 text-lg font-semibold text-white">Select a Subscription to Cancel</h3>
					<div class="space-y-2">
						{#each data.subscriptions as sub}
							<button
								onclick={() => selectSubscription(sub)}
								class="flex w-full items-center justify-between rounded-lg border border-surface-700 p-4 text-left transition hover:border-primary-600/50 hover:bg-surface-700/50"
							>
								<div class="flex items-center gap-3">
									{#if sub.categoryColor}
										<span
											class="h-3 w-3 rounded-full"
											style="background-color: {sub.categoryColor}"
										></span>
									{/if}
									<div>
										<p class="font-medium text-white">
											{sub.merchantName || sub.name}
										</p>
										<p class="mt-0.5 text-xs text-surface-500">
											{getFrequencyLabel(sub.frequency)}
											{#if sub.categoryName}
												&middot; {sub.categoryName}
											{/if}
										</p>
									</div>
								</div>
								<div class="flex items-center gap-3">
									<div class="text-right">
										<p class="font-semibold text-white">{fmt(sub.estimatedAmount)}</p>
										<p class="text-xs text-surface-500">
											{fmt(sub.estimatedAmount * getAnnualMultiplier(sub.frequency))}/yr
										</p>
									</div>
									<svg class="h-5 w-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</div>
							</button>
						{/each}
					</div>
				</Card>
			{:else}
				<Card>
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p class="mt-4 text-lg text-surface-300">No active subscriptions</p>
						<p class="mt-1 text-sm text-surface-500">
							You do not have any active subscriptions to cancel.
						</p>
					</div>
				</Card>
			{/if}

			<!-- Provider Directory -->
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Provider Directory</h3>
				<p class="mb-3 text-sm text-surface-400">
					Look up cancellation info for any service, even if it is not in your subscriptions.
				</p>
				<input
					type="text"
					placeholder="Search providers (Netflix, Spotify, Planet Fitness...)"
					bind:value={providerSearch}
					class="mb-4 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredProviders.slice(0, 12) as provider}
						<a
							href="/subscriptions/cancel/{encodeURIComponent('lookup')}?provider={encodeURIComponent(provider.name)}"
							class="rounded-lg border border-surface-700 p-3 transition hover:border-primary-600/50 hover:bg-surface-700/50"
							onclick={(e) => {
								e.preventDefault();
								selectedProvider = provider;
								selectedSubscription = null;
								currentStep = 1;
							}}
						>
							<div class="flex items-center justify-between">
								<p class="text-sm font-medium text-white">{provider.name}</p>
								<span
									class="rounded-md border px-1.5 py-0.5 text-xs {getDifficultyColor(provider.difficulty)}"
								>
									{provider.difficulty}
								</span>
							</div>
							<div class="mt-1 flex items-center gap-1.5">
								<div class="flex h-4 w-4 items-center justify-center rounded {getMethodColor(provider.cancellationMethod)}">
									<svg class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d={getMethodIcon(provider.cancellationMethod)} />
									</svg>
								</div>
								<span class="text-xs text-surface-500">
									{getMethodLabel(provider.cancellationMethod)}
								</span>
							</div>
						</a>
					{/each}
				</div>
				{#if filteredProviders.length > 12}
					<p class="mt-3 text-center text-xs text-surface-500">
						Showing 12 of {filteredProviders.length} providers. Refine your search to find more.
					</p>
				{/if}
			</Card>
		</div>
	{/if}

	<!-- Step 1: Review provider info -->
	{#if currentStep === 1}
		<div class="space-y-4">
			{#if selectedSubscription}
				<!-- Subscription + savings summary -->
				<div class="grid gap-4 sm:grid-cols-2">
					<Card>
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-900/30">
								<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</div>
							<div>
								<p class="font-semibold text-white">
									{selectedSubscription.merchantName || selectedSubscription.name}
								</p>
								<p class="text-xs text-surface-400">
									{fmt(selectedSubscription.estimatedAmount)} / {getFrequencyLabel(selectedSubscription.frequency).toLowerCase()}
								</p>
							</div>
						</div>
					</Card>
					<Card>
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/30">
								<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<div>
								<p class="text-sm text-surface-400">You will save</p>
								<p class="text-lg font-bold text-green-400">{fmt(estimatedAnnualSaving)}/yr</p>
							</div>
						</div>
					</Card>
				</div>
			{/if}

			{#if selectedProvider}
				<!-- Provider details -->
				<Card>
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-lg font-semibold text-white">{selectedProvider.name}</h3>
						<span
							class="rounded-md border px-2 py-1 text-xs font-medium {getDifficultyColor(selectedProvider.difficulty)}"
						>
							{selectedProvider.difficulty === 'easy'
								? 'Easy to Cancel'
								: selectedProvider.difficulty === 'medium'
									? 'Moderate Difficulty'
									: 'Difficult to Cancel'}
						</span>
					</div>

					<!-- Cancellation method -->
					<div class="mb-4 rounded-lg border border-surface-700 p-4">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg {getMethodColor(selectedProvider.cancellationMethod)}">
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d={getMethodIcon(selectedProvider.cancellationMethod)} />
								</svg>
							</div>
							<div>
								<p class="font-medium text-white">
									{getMethodLabel(selectedProvider.cancellationMethod)}
								</p>
								<p class="text-xs text-surface-500">
									{selectedProvider.cancellationMethod === 'online'
										? 'Cancel directly on their website'
										: selectedProvider.cancellationMethod === 'phone'
											? 'Call customer support to cancel'
											: selectedProvider.cancellationMethod === 'email'
												? 'Send a cancellation email'
												: selectedProvider.cancellationMethod === 'in_person'
													? 'Visit in person or send a letter'
													: 'Contact via live chat support'}
								</p>
							</div>
						</div>

						<div class="mt-3 flex flex-wrap gap-2">
							{#if selectedProvider.url}
								<a
									href={selectedProvider.url}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition"
								>
									Open Cancellation Page
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</a>
							{/if}
							{#if selectedProvider.phoneNumber}
								<a
									href="tel:{selectedProvider.phoneNumber}"
									class="inline-flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-surface-600 transition"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
									</svg>
									{selectedProvider.phoneNumber}
								</a>
							{/if}
							<button
								onclick={() => (showEmailModal = true)}
								class="inline-flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-surface-600 transition"
							>
								<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
								Email Template
							</button>
							{#if selectedProvider.phoneNumber || selectedProvider.cancellationMethod === 'phone'}
								<button
									onclick={() => (showScriptModal = true)}
									class="inline-flex items-center gap-1.5 rounded-lg bg-surface-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-surface-600 transition"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									Phone Script
								</button>
							{/if}
						</div>
					</div>

					<!-- Steps -->
					<div class="mb-4">
						<h4 class="mb-3 text-sm font-semibold text-surface-300">Step-by-Step Instructions</h4>
						<ol class="space-y-2">
							{#each selectedProvider.steps as step, i}
								<li class="flex gap-3">
									<div
										class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-bold text-surface-300"
									>
										{i + 1}
									</div>
									<p class="text-sm text-surface-300 leading-relaxed pt-0.5">{step}</p>
								</li>
							{/each}
						</ol>
					</div>

					<!-- Tips -->
					{#if selectedProvider.tips.length > 0}
						<div class="rounded-lg bg-amber-900/20 border border-amber-800/50 p-4">
							<div class="flex items-start gap-3">
								<svg class="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<div>
									<p class="text-sm font-medium text-amber-300">Tips</p>
									<ul class="mt-1.5 space-y-1">
										{#each selectedProvider.tips as tip}
											<li class="text-xs text-amber-400/80">{tip}</li>
										{/each}
									</ul>
								</div>
							</div>
						</div>
					{/if}
				</Card>

				<!-- Navigation -->
				<div class="flex justify-between">
					<Button variant="ghost" onclick={() => goToStep(0)}>
						Back
					</Button>
					{#if selectedSubscription}
						<Button onclick={() => goToStep(2)}>
							Continue to Cancellation
						</Button>
					{/if}
				</div>
			{:else}
				<!-- No provider match -->
				<Card>
					<div class="text-center py-8">
						<svg class="mx-auto h-12 w-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p class="mt-4 text-lg text-surface-300">Provider not found</p>
						<p class="mt-1 text-sm text-surface-500">
							We do not have specific instructions for this provider yet. You can still proceed with generic cancellation guidance.
						</p>
						{#if selectedSubscription}
							<div class="mt-4">
								<Button onclick={() => goToStep(2)}>
									Continue Anyway
								</Button>
							</div>
						{/if}
					</div>
				</Card>
				<div class="flex justify-start">
					<Button variant="ghost" onclick={() => goToStep(0)}>
						Back
					</Button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Step 2: Confirm and initiate -->
	{#if currentStep === 2 && selectedSubscription}
		<div class="space-y-4">
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Confirm Cancellation</h3>

				<div class="mb-4 rounded-lg bg-green-900/20 border border-green-800/50 p-4">
					<div class="flex gap-3">
						<svg class="h-5 w-5 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<p class="text-sm font-medium text-green-300">
								You will save {fmt(estimatedMonthlySaving)}/month ({fmt(estimatedAnnualSaving)}/year)
							</p>
							<p class="mt-1 text-xs text-green-400/80">
								By cancelling {selectedSubscription.merchantName || selectedSubscription.name}
							</p>
						</div>
					</div>
				</div>

				<form
					method="POST"
					action="?/initiate"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
					class="space-y-4"
				>
					<input type="hidden" name="subscriptionId" value={selectedSubscription.id} />

					<div>
						<label for="cancelReason" class="block text-sm font-medium text-surface-300">
							Reason for cancelling (optional)
						</label>
						<select
							id="cancelReason"
							name="reason"
							bind:value={cancellationReason}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="">Select a reason...</option>
							<option value="Too expensive">Too expensive</option>
							<option value="Not using it enough">Not using it enough</option>
							<option value="Found a better alternative">Found a better alternative</option>
							<option value="Poor service quality">Poor service quality</option>
							<option value="Temporary financial constraints">Temporary financial constraints</option>
							<option value="No longer needed">No longer needed</option>
							<option value="Other">Other</option>
						</select>
					</div>

					<div class="flex justify-between pt-2">
						<Button variant="ghost" type="button" onclick={() => goToStep(1)}>
							Back
						</Button>
						<div class="flex gap-3">
							<a href="/subscriptions">
								<Button variant="secondary" type="button">Keep Subscription</Button>
							</a>
							<Button type="submit" variant="danger">
								Start Cancellation
							</Button>
						</div>
					</div>
				</form>
			</Card>
		</div>
	{/if}

	<!-- Step 3: Done / Tracking -->
	{#if currentStep === 3}
		<Card>
			<div class="flex flex-col items-center justify-center py-8 text-center">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
					<svg class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="mt-4 text-lg font-semibold text-white">Cancellation Initiated</p>
				<p class="mt-1 text-sm text-surface-400">
					Follow the provider instructions to complete your cancellation, then confirm it in Finance Owl.
				</p>
				{#if selectedSubscription}
					<div class="mt-4">
						<a href="/subscriptions/cancel/{selectedSubscription.id}">
							<Button>Track This Cancellation</Button>
						</a>
					</div>
				{/if}
				<div class="mt-3">
					<Button variant="ghost" onclick={() => { currentStep = 0; selectedSubscription = null; selectedProvider = null; }}>
						Cancel Another Subscription
					</Button>
				</div>
			</div>
		</Card>
	{/if}

	<!-- Cancellation History -->
	{#if data.history.length > 0}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Cancellation History</h3>
			<div class="divide-y divide-surface-700">
				{#each data.history as req}
					<div class="flex items-center justify-between py-3">
						<div class="min-w-0 flex-1">
							<a
								href="/subscriptions/cancel/{req.subscriptionId}"
								class="text-sm font-medium text-white hover:text-primary-400 transition"
							>
								{req.merchantName || req.subscriptionName || 'Unknown'}
							</a>
							<div class="mt-0.5 flex items-center gap-2">
								<span
									class="rounded-md px-1.5 py-0.5 text-xs {statusLabels[req.status]?.color ?? 'bg-surface-700 text-surface-300'}"
								>
									{statusLabels[req.status]?.label ?? req.status}
								</span>
								<span class="text-xs text-surface-500">
									{new Date(req.createdAt).toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</span>
								{#if req.reason}
									<span class="text-xs text-surface-500">&middot; {req.reason}</span>
								{/if}
							</div>
						</div>
						{#if req.estimatedAmount}
							<div class="ml-4 text-right">
								<p class="text-sm font-semibold {req.status === 'completed' ? 'text-green-400' : 'text-white'}">
									{fmt(req.estimatedAmount)}
								</p>
								<p class="text-xs text-surface-500">
									{getFrequencyLabel(req.frequency ?? 'monthly')}
								</p>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>

<!-- Email Template Modal -->
<Modal open={showEmailModal} onclose={() => (showEmailModal = false)} title="Cancellation Email Template">
	{#if selectedProvider}
		<div class="space-y-4">
			<p class="text-sm text-surface-400">
				Copy this email and send it to {selectedProvider.name} customer support to request cancellation.
			</p>
			<div class="rounded-lg border border-surface-600 bg-surface-900 p-4">
				<pre class="whitespace-pre-wrap text-sm text-surface-300 font-mono leading-relaxed">{selectedProvider.emailTemplate || `Subject: Subscription Cancellation Request - ${selectedProvider.name}

Dear ${selectedProvider.name} Customer Support,

I am writing to formally request the immediate cancellation of my ${selectedProvider.name} subscription.

Account Details:
- Service: ${selectedProvider.name}
- Account Email: [YOUR ACCOUNT EMAIL]
- Date of Request: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Please process this cancellation and confirm in writing that:
1. My subscription has been cancelled
2. No further charges will be applied to my payment method
3. The effective date of cancellation

Thank you,
[YOUR NAME]`}</pre>
			</div>
			<div class="flex justify-end gap-3">
				<Button
					variant="ghost"
					onclick={() => (showEmailModal = false)}
				>
					Close
				</Button>
				<Button
					onclick={() => {
						const text = selectedProvider.emailTemplate || `Subject: Subscription Cancellation Request - ${selectedProvider.name}\n\nDear ${selectedProvider.name} Customer Support,\n\nI am writing to formally request the immediate cancellation of my ${selectedProvider.name} subscription.\n\nPlease process this cancellation and confirm in writing.\n\nThank you,\n[YOUR NAME]`;
						copyToClipboard(text, 'email');
					}}
				>
					{copiedEmail ? 'Copied!' : 'Copy to Clipboard'}
				</Button>
			</div>
		</div>
	{/if}
</Modal>

<!-- Phone Script Modal -->
<Modal open={showScriptModal} onclose={() => (showScriptModal = false)} title="Phone Cancellation Script">
	{#if selectedProvider}
		<div class="space-y-4">
			<p class="text-sm text-surface-400">
				Use this script when calling {selectedProvider.name} to cancel your subscription.
			</p>
			{#if selectedProvider.phoneNumber}
				<div class="flex items-center gap-2 rounded-lg bg-surface-700 p-3">
					<svg class="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
					</svg>
					<a href="tel:{selectedProvider.phoneNumber}" class="text-sm font-medium text-primary-400 hover:text-primary-300">
						{selectedProvider.phoneNumber}
					</a>
				</div>
			{/if}
			{#if selectedProvider.difficulty === 'hard'}
				<div class="rounded-lg bg-red-900/20 border border-red-800/50 p-3">
					<p class="text-xs text-red-300">
						This provider is known for aggressive retention tactics. Be firm and polite.
						Budget 20-30 minutes for this call.
					</p>
				</div>
			{/if}
			<div class="max-h-80 overflow-y-auto rounded-lg border border-surface-600 bg-surface-900 p-4">
				<div class="space-y-3 text-sm text-surface-300">
					<div>
						<p class="font-semibold text-white">Opening:</p>
						<p class="italic">"Hello, I would like to cancel my {selectedProvider.name} subscription, please."</p>
					</div>
					<div>
						<p class="font-semibold text-white">When asked why:</p>
						<p class="italic">"I have decided to cancel. Please process my cancellation."</p>
					</div>
					{#if selectedProvider.difficulty !== 'easy'}
						<div>
							<p class="font-semibold text-white">If offered a discount:</p>
							<p class="italic">"I appreciate the offer, but I have made my decision and would like to proceed with the cancellation."</p>
						</div>
						<div>
							<p class="font-semibold text-white">If offered a pause:</p>
							<p class="italic">"Thank you, but I would prefer a full cancellation."</p>
						</div>
					{/if}
					<div>
						<p class="font-semibold text-white">Confirm:</p>
						<p class="italic">"Please confirm: my subscription is cancelled, no further charges will be made, and please send a confirmation email to my address on file."</p>
					</div>
					<div>
						<p class="font-semibold text-white">Get reference:</p>
						<p class="italic">"Could I get a confirmation number for this cancellation?"</p>
					</div>
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<Button
					variant="ghost"
					onclick={() => (showScriptModal = false)}
				>
					Close
				</Button>
				<Button
					onclick={() => {
						const text = `Phone Cancellation Script for ${selectedProvider.name}\n\nOpening: "Hello, I would like to cancel my ${selectedProvider.name} subscription, please."\n\nWhen asked why: "I have decided to cancel. Please process my cancellation."\n\nIf offered a discount: "I appreciate the offer, but I have made my decision."\n\nConfirm: "Please confirm my subscription is cancelled and no further charges will be made. Send a confirmation email to my address on file."\n\nGet reference: "Could I get a confirmation number?"`;
						copyToClipboard(text, 'script');
					}}
				>
					{copiedScript ? 'Copied!' : 'Copy Script'}
				</Button>
			</div>
		</div>
	{/if}
</Modal>
