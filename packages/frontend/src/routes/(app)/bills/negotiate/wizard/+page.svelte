<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	// ─── Wizard State ──────────────────────────────────────────────────────────

	let wizardStep = $state(1);
	let selectedBillType = $state('');
	let selectedProvider = $state('');
	let currentAmount = $state(0);
	let targetAmount = $state(0);
	let selectedMethod = $state<'phone' | 'email' | 'chat'>('phone');

	// Strategy & script
	let strategy = $state<any>(null);
	let emailTemplate = $state<any>(null);
	let loadingStrategy = $state(false);
	let loadingEmail = $state(false);

	// Outcome tracking
	let showOutcomeModal = $state(false);
	let selectedAttemptId = $state<string | null>(null);

	// Copy state
	let copiedIndex = $state<number | null>(null);
	let copiedEmail = $state(false);

	// ─── Derived ───────────────────────────────────────────────────────────────

	const savings = $derived(data.savings);
	const attempts = $derived(data.attempts ?? []);
	const providers = $derived(data.providers ?? {});

	const allProviders = $derived.by(() => {
		const result: { key: string; name: string; category: string; successRate: number; avgSavingsPercent: number; difficulty: string }[] = [];
		for (const [category, items] of Object.entries(providers)) {
			for (const item of items as any[]) {
				result.push({ ...item, category });
			}
		}
		return result;
	});

	const filteredProviders = $derived(
		selectedBillType
			? allProviders.filter((p) => p.category === selectedBillType)
			: allProviders
	);

	const estimatedSavingsMin = $derived(
		currentAmount > 0 ? Math.round(currentAmount * 0.15 * 100) / 100 : 0
	);

	const estimatedSavingsMax = $derived(
		currentAmount > 0 ? Math.round(currentAmount * 0.3 * 100) / 100 : 0
	);

	const succeededAttempts = $derived(
		attempts.filter((a: any) => a.status === 'succeeded')
	);

	const activeAttempts = $derived(
		attempts.filter((a: any) => a.status === 'planned' || a.status === 'in_progress')
	);

	// ─── Helpers ───────────────────────────────────────────────────────────────

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function difficultyBadge(difficulty: string): string {
		switch (difficulty) {
			case 'easy':
				return 'bg-green-500/20 text-green-400';
			case 'medium':
				return 'bg-yellow-500/20 text-yellow-400';
			case 'hard':
				return 'bg-red-500/20 text-red-400';
			default:
				return 'bg-surface-500/20 text-surface-400';
		}
	}

	function statusBadge(status: string): string {
		switch (status) {
			case 'planned':
				return 'bg-surface-500/20 text-surface-400';
			case 'in_progress':
				return 'bg-blue-500/20 text-blue-400';
			case 'succeeded':
				return 'bg-green-500/20 text-green-400';
			case 'failed':
				return 'bg-red-500/20 text-red-400';
			case 'pending_confirmation':
				return 'bg-yellow-500/20 text-yellow-400';
			default:
				return 'bg-surface-500/20 text-surface-400';
		}
	}

	function categoryLabel(cat: string): string {
		const labels: Record<string, string> = {
			internet: 'Internet',
			cable: 'Cable TV',
			phone: 'Phone / Wireless',
			insurance: 'Insurance',
			medical: 'Medical',
			utility: 'Utility',
			streaming: 'Streaming',
			utilities: 'Utilities',
			other: 'Other'
		};
		return labels[cat] ?? cat;
	}

	function methodIcon(method: string): string {
		switch (method) {
			case 'phone':
				return 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z';
			case 'email':
				return 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75';
			case 'chat':
				return 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z';
			default:
				return 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function copyToClipboard(text: string, index: number): Promise<void> {
		await navigator.clipboard.writeText(text);
		copiedIndex = index;
		setTimeout(() => (copiedIndex = null), 2000);
	}

	async function copyEmailToClipboard(): Promise<void> {
		if (!emailTemplate) return;
		const text = `Subject: ${emailTemplate.subject}\n\n${emailTemplate.body}`;
		await navigator.clipboard.writeText(text);
		copiedEmail = true;
		setTimeout(() => (copiedEmail = false), 2000);
	}

	function goToStep(step: number): void {
		wizardStep = step;
	}

	function resetWizard(): void {
		wizardStep = 1;
		selectedBillType = '';
		selectedProvider = '';
		currentAmount = 0;
		targetAmount = 0;
		selectedMethod = 'phone';
		strategy = null;
		emailTemplate = null;
	}

	// Update from form actions
	$effect(() => {
		if (form?.success && form?.strategy) {
			strategy = form.strategy;
			loadingStrategy = false;
		}
	});

	$effect(() => {
		if (form?.success && form?.email) {
			emailTemplate = form.email;
			loadingEmail = false;
		}
	});

	$effect(() => {
		if (form?.success && form?.started) {
			wizardStep = 4;
		}
	});

	$effect(() => {
		if (form?.success && form?.updated) {
			showOutcomeModal = false;
			selectedAttemptId = null;
		}
	});

	// Auto-calculate target when current amount or bill type changes
	$effect(() => {
		if (currentAmount > 0 && !targetAmount) {
			targetAmount = Math.round(currentAmount * 0.8 * 100) / 100;
		}
	});

	const billTypes = [
		{ value: 'internet', label: 'Internet', icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z' },
		{ value: 'cable', label: 'Cable TV', icon: 'M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z' },
		{ value: 'phone', label: 'Phone / Wireless', icon: 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3' },
		{ value: 'insurance', label: 'Insurance', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
		{ value: 'medical', label: 'Medical', icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z' },
		{ value: 'streaming', label: 'Streaming', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z' },
		{ value: 'utilities', label: 'Utilities', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
		{ value: 'other', label: 'Other', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' }
	];
</script>

<svelte:head>
	<title>Negotiation Wizard - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Negotiation Wizard</h2>
			<p class="mt-1 text-sm text-surface-400">
				AI-powered bill negotiation with step-by-step scripts and strategies
			</p>
		</div>
		<div class="flex items-center gap-3">
			<a href="/bills/negotiate" class="text-sm text-primary-400 hover:text-primary-300">
				Overview
			</a>
			<a href="/bills" class="text-sm text-surface-400 hover:text-surface-300">
				Bills Calendar
			</a>
		</div>
	</div>

	<!-- Savings Dashboard Strip -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20">
					<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Total Saved</p>
					<p class="text-xl font-bold text-green-400">{fmt(savings.totalAnnualSavings)}/yr</p>
					<p class="text-xs text-surface-500">{fmt(savings.totalMonthlySavings)}/month</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20">
					<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Success Rate</p>
					<p class="text-xl font-bold text-white">{savings.successRate}%</p>
					<p class="text-xs text-surface-500">{savings.successfulAttempts} of {savings.totalAttempts}</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
					<svg class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">Active</p>
					<p class="text-xl font-bold text-white">{activeAttempts.length}</p>
					<p class="text-xs text-surface-500">negotiations in progress</p>
				</div>
			</div>
		</Card>

		<Card>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600/20">
					<svg class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
					</svg>
				</div>
				<div>
					<p class="text-sm text-surface-400">AI Strategies</p>
					<p class="text-xl font-bold text-white">{Object.keys(providers).length > 0 ? allProviders.length : 0}</p>
					<p class="text-xs text-surface-500">providers with scripts</p>
				</div>
			</div>
		</Card>
	</div>

	<!-- Wizard Steps Indicator -->
	<Card>
		<div class="flex items-center justify-between">
			{#each [
				{ step: 1, label: 'Select Bill' },
				{ step: 2, label: 'Set Target' },
				{ step: 3, label: 'View Strategy' },
				{ step: 4, label: 'Track Outcome' }
			] as item}
				<button
					type="button"
					class="flex flex-1 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition {wizardStep === item.step
						? 'border-primary-500 text-primary-400'
						: wizardStep > item.step
							? 'border-green-500 text-green-400'
							: 'border-surface-700 text-surface-500'}"
					onclick={() => {
						if (item.step <= wizardStep) goToStep(item.step);
					}}
				>
					<span
						class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold {wizardStep === item.step
							? 'bg-primary-600 text-white'
							: wizardStep > item.step
								? 'bg-green-600 text-white'
								: 'bg-surface-700 text-surface-400'}"
					>
						{#if wizardStep > item.step}
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
							</svg>
						{:else}
							{item.step}
						{/if}
					</span>
					<span class="hidden sm:inline">{item.label}</span>
				</button>
			{/each}
		</div>
	</Card>

	<!-- Step 1: Select Bill Type & Provider -->
	{#if wizardStep === 1}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Step 1: Select Your Bill</h3>
			<p class="mb-6 text-sm text-surface-400">
				Choose the type of bill you want to negotiate and select your provider.
			</p>

			<!-- Bill type selection -->
			<div class="mb-6">
				<span class="mb-2 block text-sm font-medium text-surface-300">Bill Type</span>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each billTypes as bt}
						<button
							type="button"
							class="flex flex-col items-center gap-2 rounded-lg border p-4 transition {selectedBillType === bt.value
								? 'border-primary-500 bg-primary-500/10 text-primary-400'
								: 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600 hover:text-surface-300'}"
							onclick={() => {
								selectedBillType = bt.value;
								selectedProvider = '';
							}}
						>
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d={bt.icon} />
							</svg>
							<span class="text-xs font-medium">{bt.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Provider selection -->
			{#if selectedBillType}
				<div class="mb-6">
					<span class="mb-2 block text-sm font-medium text-surface-300">
						Select Provider
						{#if filteredProviders.length > 0}
							<span class="text-surface-500">({filteredProviders.length} available)</span>
						{/if}
					</span>

					{#if filteredProviders.length > 0}
						<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each filteredProviders as p}
								<button
									type="button"
									class="flex items-center justify-between rounded-lg border p-4 text-left transition {selectedProvider === p.name
										? 'border-primary-500 bg-primary-500/10'
										: 'border-surface-700 bg-surface-800 hover:border-surface-600'}"
									onclick={() => (selectedProvider = p.name)}
								>
									<div>
										<p class="text-sm font-medium text-white">{p.name}</p>
										<div class="mt-1 flex items-center gap-2">
											<span class="inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium {difficultyBadge(p.difficulty)}">
												{p.difficulty}
											</span>
											<span class="text-xs text-surface-500">
												{p.successRate}% success
											</span>
										</div>
									</div>
									<div class="text-right">
										<p class="text-sm font-medium text-green-400">~{p.avgSavingsPercent}%</p>
										<p class="text-xs text-surface-500">avg savings</p>
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="rounded-lg border border-surface-700 bg-surface-800 p-4">
							<input
								type="text"
								placeholder="Enter provider name..."
								bind:value={selectedProvider}
								class="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							/>
							<p class="mt-2 text-xs text-surface-500">
								No pre-configured providers for this category. Enter your provider name above.
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Next button -->
			<div class="flex justify-end pt-4">
				<Button
					disabled={!selectedBillType || !selectedProvider}
					onclick={() => goToStep(2)}
				>
					Next: Set Target Amount
				</Button>
			</div>
		</Card>
	{/if}

	<!-- Step 2: Enter Amount & Target -->
	{#if wizardStep === 2}
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Step 2: Set Your Target</h3>
			<p class="mb-6 text-sm text-surface-400">
				Enter your current monthly payment and desired target. We will calculate estimated savings.
			</p>

			<div class="grid gap-6 sm:grid-cols-2">
				<div>
					<label class="mb-1 block text-sm font-medium text-surface-300" for="wizCurrentAmount">
						Current Monthly Amount
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
						<input
							id="wizCurrentAmount"
							type="number"
							step="0.01"
							min="0"
							bind:value={currentAmount}
							class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="e.g. 120.00"
						/>
					</div>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-surface-300" for="wizTargetAmount">
						Target Monthly Amount
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
						<input
							id="wizTargetAmount"
							type="number"
							step="0.01"
							min="0"
							bind:value={targetAmount}
							class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="e.g. 85.00"
						/>
					</div>
					{#if currentAmount > 0}
						<p class="mt-1 text-xs text-surface-500">
							Estimated savings: {fmt(estimatedSavingsMin)} - {fmt(estimatedSavingsMax)}/mo
						</p>
					{/if}
				</div>
			</div>

			<!-- Estimated Savings Badge -->
			{#if currentAmount > 0 && targetAmount > 0 && targetAmount < currentAmount}
				<div class="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-green-400">Estimated Annual Savings</p>
							<p class="mt-1 text-2xl font-bold text-green-400">
								{fmt((currentAmount - targetAmount) * 12)}/year
							</p>
							<p class="text-sm text-green-400/70">
								{fmt(currentAmount - targetAmount)}/month
								({Math.round(((currentAmount - targetAmount) / currentAmount) * 100)}% reduction)
							</p>
						</div>
						<div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20">
							<svg class="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
							</svg>
						</div>
					</div>
				</div>
			{/if}

			<!-- Method selection -->
			<div class="mt-6">
				<span class="mb-2 block text-sm font-medium text-surface-300">Preferred Negotiation Method</span>
				<div class="flex gap-3">
					{#each (['phone', 'email', 'chat'] as const) as method}
						<button
							type="button"
							class="flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition {selectedMethod === method
								? 'border-primary-500 bg-primary-500/10 text-primary-400'
								: 'border-surface-700 bg-surface-800 text-surface-400 hover:border-surface-600'}"
							onclick={() => (selectedMethod = method)}
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d={methodIcon(method)} />
							</svg>
							<span class="text-sm font-medium capitalize">{method}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Navigation -->
			<div class="flex justify-between pt-6">
				<Button variant="secondary" onclick={() => goToStep(1)}>
					Back
				</Button>
				<form
					method="POST"
					action="?/getStrategy"
					use:enhance={() => {
						loadingStrategy = true;
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<input type="hidden" name="billType" value={selectedBillType} />
					<input type="hidden" name="provider" value={selectedProvider} />
					<input type="hidden" name="currentAmount" value={currentAmount} />
					<Button
						type="submit"
						disabled={currentAmount <= 0 || targetAmount <= 0 || targetAmount >= currentAmount}
						loading={loadingStrategy}
						onclick={() => goToStep(3)}
					>
						Generate Strategy
					</Button>
				</form>
			</div>
		</Card>
	{/if}

	<!-- Step 3: AI Strategy View -->
	{#if wizardStep === 3}
		{#if strategy}
			<!-- Strategy Header -->
			<Card>
				<div class="flex items-start justify-between">
					<div>
						<h3 class="text-lg font-semibold text-white">
							Negotiation Strategy: {strategy.provider}
						</h3>
						<div class="mt-2 flex flex-wrap items-center gap-2">
							<span class="inline-flex rounded-full bg-primary-500/20 px-2.5 py-1 text-xs font-medium text-primary-400">
								{categoryLabel(strategy.billType)}
							</span>
							<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {difficultyBadge(strategy.difficulty)}">
								{strategy.difficulty} difficulty
							</span>
							<span class="inline-flex rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
								{strategy.estimatedSuccessRate}% success rate
							</span>
							<span class="inline-flex rounded-full bg-surface-500/20 px-2.5 py-1 text-xs font-medium text-surface-300">
								Best via {strategy.recommendedApproach}
							</span>
						</div>
					</div>
					<div class="text-right">
						<p class="text-sm text-surface-400">Target Savings</p>
						<p class="text-xl font-bold text-green-400">
							{fmt(currentAmount - strategy.targetAmount)}/mo
						</p>
					</div>
				</div>

				<div class="mt-4 grid gap-3 sm:grid-cols-3">
					<div class="rounded-lg bg-surface-900/50 p-3">
						<p class="text-xs text-surface-500">Best Time to Call</p>
						<p class="mt-1 text-sm font-medium text-white">{strategy.bestTimeToCall}</p>
					</div>
					<div class="rounded-lg bg-surface-900/50 p-3">
						<p class="text-xs text-surface-500">Department</p>
						<p class="mt-1 text-sm font-medium text-white">{strategy.departmentToAsk}</p>
					</div>
					<div class="rounded-lg bg-surface-900/50 p-3">
						<p class="text-xs text-surface-500">Recommended Approach</p>
						<p class="mt-1 text-sm font-medium capitalize text-white">{strategy.recommendedApproach}</p>
					</div>
				</div>
			</Card>

			<!-- Step-by-Step Script -->
			<Card>
				<h4 class="mb-4 text-lg font-semibold text-white">Step-by-Step Script</h4>
				<div class="space-y-4">
					{#each strategy.steps as step, i}
						<div class="rounded-lg border border-surface-700 bg-surface-900/30 p-4">
							<div class="mb-2 flex items-center gap-2">
								<span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
									{step.order}
								</span>
								<h5 class="font-semibold text-white">{step.title}</h5>
							</div>
							<p class="mb-3 text-sm text-surface-400">{step.description}</p>
							{#if step.script}
								<div class="relative rounded-lg bg-surface-800 p-3">
									<p class="pr-8 text-sm italic text-surface-300">{step.script}</p>
									<button
										type="button"
										class="absolute right-2 top-2 rounded p-1 text-surface-500 transition hover:bg-surface-700 hover:text-white"
										onclick={() => copyToClipboard(step.script, i)}
									>
										{#if copiedIndex === i}
											<svg class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
											</svg>
										{:else}
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
											</svg>
										{/if}
									</button>
								</div>
							{/if}
							{#if step.notes}
								<p class="mt-2 text-xs text-surface-500">
									<span class="font-medium text-surface-400">Tip:</span> {step.notes}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</Card>

			<!-- Key Phrases -->
			<Card>
				<h4 class="mb-4 text-lg font-semibold text-white">Key Phrases to Use</h4>
				<div class="grid gap-2 sm:grid-cols-2">
					{#each strategy.keyPhrases as phrase, i}
						<button
							type="button"
							class="group flex items-start gap-2 rounded-lg bg-surface-900/50 p-3 text-left transition hover:bg-surface-800"
							onclick={() => copyToClipboard(phrase, 100 + i)}
						>
							<span class="mt-0.5 flex-shrink-0 text-xs font-bold text-primary-400">{i + 1}.</span>
							<span class="flex-1 text-sm text-surface-300">{phrase}</span>
							{#if copiedIndex === 100 + i}
								<svg class="h-4 w-4 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
							{:else}
								<svg class="h-4 w-4 flex-shrink-0 text-surface-600 transition group-hover:text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			</Card>

			<!-- Competitor Offers -->
			{#if strategy.competitorOffers && strategy.competitorOffers.length > 0}
				<Card>
					<h4 class="mb-4 text-lg font-semibold text-white">Competitor Offers to Mention</h4>
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each strategy.competitorOffers as offer}
							<div class="rounded-lg border border-surface-700 bg-surface-900/50 p-4">
								<div class="flex items-center justify-between">
									<p class="font-medium text-white">{offer.competitor}</p>
									<p class="text-sm font-bold text-primary-400">{offer.price}</p>
								</div>
								<p class="mt-1 text-xs text-surface-500">{offer.details}</p>
								<p class="mt-2 text-xs italic text-surface-400">{offer.useAs}</p>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Provider Tips -->
			{#if strategy.providerTips && strategy.providerTips.length > 0}
				<Card>
					<h4 class="mb-4 text-lg font-semibold text-white">Provider-Specific Tips</h4>
					<div class="space-y-2">
						{#each strategy.providerTips as tip, i}
							<div class="flex gap-2 rounded-lg bg-surface-900/50 p-3">
								<span class="mt-0.5 flex-shrink-0 text-xs font-bold text-primary-400">{i + 1}.</span>
								<p class="text-sm text-surface-300">{tip}</p>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Actions: Email & Start -->
			<Card>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex gap-3">
						<form
							method="POST"
							action="?/generateEmail"
							use:enhance={() => {
								loadingEmail = true;
								return async ({ update }) => {
									loadingEmail = false;
									await update();
								};
							}}
						>
							<input type="hidden" name="provider" value={selectedProvider} />
							<input type="hidden" name="billType" value={selectedBillType} />
							<input type="hidden" name="currentAmount" value={currentAmount} />
							<input type="hidden" name="targetAmount" value={targetAmount} />
							<Button type="submit" variant="secondary" loading={loadingEmail}>
								Generate Email Template
							</Button>
						</form>
						<Button variant="secondary" onclick={() => goToStep(2)}>
							Adjust Target
						</Button>
					</div>
					<form
						method="POST"
						action="?/startAttempt"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								await invalidateAll();
							};
						}}
					>
						<input type="hidden" name="provider" value={selectedProvider} />
						<input type="hidden" name="billType" value={selectedBillType} />
						<input type="hidden" name="originalAmount" value={currentAmount} />
						<input type="hidden" name="targetAmount" value={targetAmount} />
						<input type="hidden" name="method" value={selectedMethod} />
						<Button type="submit">
							Start Negotiation Attempt
						</Button>
					</form>
				</div>
			</Card>

			<!-- Email Template (if generated) -->
			{#if emailTemplate}
				<Card>
					<div class="mb-4 flex items-center justify-between">
						<h4 class="text-lg font-semibold text-white">Email Template</h4>
						<Button size="sm" variant="secondary" onclick={copyEmailToClipboard}>
							{#if copiedEmail}
								Copied!
							{:else}
								Copy Email
							{/if}
						</Button>
					</div>

					<div class="space-y-4">
						<div class="rounded-lg bg-surface-900/50 p-4">
							<p class="text-xs font-medium text-surface-500">Subject</p>
							<p class="mt-1 text-sm font-medium text-white">{emailTemplate.subject}</p>
						</div>
						<div class="rounded-lg bg-surface-900/50 p-4">
							<p class="text-xs font-medium text-surface-500">Body</p>
							<pre class="mt-2 whitespace-pre-wrap text-sm text-surface-300">{emailTemplate.body}</pre>
						</div>
						<div class="rounded-lg border border-surface-700 bg-surface-900/30 p-4">
							<p class="text-xs font-medium text-surface-500">Follow-up Email (send after 5 business days)</p>
							<p class="mt-2 text-xs text-surface-400">Subject: {emailTemplate.followUpSubject}</p>
							<pre class="mt-2 whitespace-pre-wrap text-xs text-surface-400">{emailTemplate.followUpBody}</pre>
						</div>
					</div>
				</Card>
			{/if}
		{:else}
			<Card>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="h-12 w-12 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<p class="mt-4 text-surface-300">Generating your negotiation strategy...</p>
				</div>
			</Card>
		{/if}
	{/if}

	<!-- Step 4: Track Outcome -->
	{#if wizardStep === 4}
		<Card>
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-white">Track Your Negotiations</h3>
				<Button size="sm" onclick={resetWizard}>
					New Negotiation
				</Button>
			</div>

			{#if attempts.length > 0}
				<div class="space-y-3">
					{#each attempts as attempt}
						<div class="rounded-lg border border-surface-700 bg-surface-900/30 p-4">
							<div class="flex items-start justify-between">
								<div>
									<div class="flex items-center gap-2">
										<p class="font-medium text-white">{attempt.provider}</p>
										<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusBadge(attempt.status)}">
											{attempt.status.replace('_', ' ')}
										</span>
									</div>
									<p class="mt-1 text-sm text-surface-400">
										{categoryLabel(attempt.billType)}
										<span class="text-surface-600">|</span>
										{attempt.method}
										<span class="text-surface-600">|</span>
										Started {formatDate(attempt.startedAt)}
									</p>
								</div>
								<div class="text-right">
									<p class="text-sm text-surface-400">
										{fmt(attempt.originalAmount)}
										{#if attempt.negotiatedAmount}
											<span class="mx-1 text-surface-600">-></span>
											<span class="font-medium text-green-400">{fmt(attempt.negotiatedAmount)}</span>
										{:else}
											<span class="mx-1 text-surface-600">-></span>
											<span class="text-surface-500">Target: {fmt(attempt.targetAmount)}</span>
										{/if}
									</p>
									{#if attempt.annualSavings}
										<p class="text-xs text-green-400">Saving {fmt(attempt.annualSavings)}/year</p>
									{/if}
								</div>
							</div>
							{#if attempt.notes}
								<p class="mt-2 text-xs text-surface-500">{attempt.notes}</p>
							{/if}
							{#if attempt.status !== 'succeeded' && attempt.status !== 'failed'}
								<div class="mt-3 flex gap-2">
									<Button
										size="sm"
										variant="secondary"
										onclick={() => {
											selectedAttemptId = attempt.id;
											showOutcomeModal = true;
										}}
									>
										Update Outcome
									</Button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="py-8 text-center">
					<svg class="mx-auto h-12 w-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
					</svg>
					<p class="mt-3 text-surface-400">No negotiation attempts recorded yet.</p>
					<p class="mt-1 text-sm text-surface-500">
						Start a negotiation to track your results here.
					</p>
				</div>
			{/if}
		</Card>

		<!-- Success Stories -->
		{#if succeededAttempts.length > 0}
			<Card>
				<h4 class="mb-4 text-lg font-semibold text-white">Your Success Stories</h4>
				<div class="space-y-3">
					{#each succeededAttempts as attempt}
						<div class="flex items-center justify-between rounded-lg bg-green-500/5 p-4">
							<div class="flex items-center gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/20">
									<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-white">{attempt.provider}</p>
									<p class="text-xs text-surface-500">
										{categoryLabel(attempt.billType)} - {formatDate(attempt.completedAt)}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-sm">
									<span class="text-surface-500 line-through">{fmt(attempt.originalAmount)}</span>
									<span class="ml-1 font-medium text-green-400">{fmt(attempt.negotiatedAmount)}</span>
								</p>
								<p class="text-xs text-green-400">
									Saving {fmt(attempt.annualSavings ?? 0)}/year
								</p>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Tips Section -->
		<Card>
			<h4 class="mb-4 text-lg font-semibold text-white">Negotiation Tips</h4>
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="rounded-lg bg-surface-900/50 p-4">
					<div class="mb-2 flex items-center gap-2">
						<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<h5 class="text-sm font-semibold text-white">Best Time to Call</h5>
					</div>
					<p class="text-sm text-surface-400">
						Call Tuesday through Thursday between 8-10 AM local time. Avoid Mondays (busiest) and Fridays (agents want to wrap up). Early morning agents tend to be more helpful.
					</p>
				</div>
				<div class="rounded-lg bg-surface-900/50 p-4">
					<div class="mb-2 flex items-center gap-2">
						<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<h5 class="text-sm font-semibold text-white">Ask for Retention</h5>
					</div>
					<p class="text-sm text-surface-400">
						Always ask for the "retention" or "loyalty" department. Regular customer service agents have limited discount authority. Retention teams are authorized to offer the best deals.
					</p>
				</div>
				<div class="rounded-lg bg-surface-900/50 p-4">
					<div class="mb-2 flex items-center gap-2">
						<svg class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
						</svg>
						<h5 class="text-sm font-semibold text-white">Be Prepared to Leave</h5>
					</div>
					<p class="text-sm text-surface-400">
						The best offers often come from the "save" team when you confirm cancellation. Be genuinely willing to switch providers for maximum leverage.
					</p>
				</div>
				<div class="rounded-lg bg-surface-900/50 p-4">
					<div class="mb-2 flex items-center gap-2">
						<svg class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
						</svg>
						<h5 class="text-sm font-semibold text-white">Try Again</h5>
					</div>
					<p class="text-sm text-surface-400">
						If you do not get a good offer, call back and try a different agent. Offers vary significantly between representatives. Set a calendar reminder and try again in a few days.
					</p>
				</div>
			</div>
		</Card>
	{/if}
</div>

<!-- Outcome Update Modal -->
<Modal
	open={showOutcomeModal}
	onclose={() => {
		showOutcomeModal = false;
		selectedAttemptId = null;
	}}
	title="Update Negotiation Outcome"
>
	{#if selectedAttemptId}
		<form
			method="POST"
			action="?/updateAttempt"
			class="space-y-4"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					await invalidateAll();
				};
			}}
		>
			<input type="hidden" name="attemptId" value={selectedAttemptId} />

			<div>
				<label class="mb-1 block text-sm font-medium text-surface-300" for="outcomeStatus">
					Outcome
				</label>
				<select
					id="outcomeStatus"
					name="status"
					required
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="in_progress">Still In Progress</option>
					<option value="succeeded">Success - Got a Discount</option>
					<option value="failed">Failed - No Discount</option>
					<option value="pending_confirmation">Pending Confirmation</option>
				</select>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-surface-300" for="outcomeAmount">
					New Monthly Amount (if successful)
				</label>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500">$</span>
					<input
						id="outcomeAmount"
						name="negotiatedAmount"
						type="number"
						step="0.01"
						class="w-full rounded-lg border border-surface-700 bg-surface-800 py-2 pl-7 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						placeholder="Leave blank if not successful"
					/>
				</div>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-surface-300" for="outcomeNotes">
					Notes
				</label>
				<textarea
					id="outcomeNotes"
					name="notes"
					rows="3"
					class="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Agent name, reference number, details about the offer..."
				></textarea>
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button
					variant="secondary"
					type="button"
					onclick={() => {
						showOutcomeModal = false;
						selectedAttemptId = null;
					}}
				>
					Cancel
				</Button>
				<Button type="submit">Save Outcome</Button>
			</div>
		</form>
	{/if}
</Modal>
