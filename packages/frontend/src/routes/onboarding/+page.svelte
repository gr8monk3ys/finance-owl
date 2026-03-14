<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Step management
	let currentStep = $state(0);
	const totalSteps = 6;

	// Step 1: Welcome - user name (from auth)
	let userName = $state('');

	// Step 2: Link bank
	let bankLinked = $state(false);
	let linkingBank = $state(false);

	// Step 3: Manual accounts
	interface ManualAccount {
		name: string;
		type: 'checking' | 'savings' | 'credit';
		balance: string;
	}
	let manualAccounts = $state<ManualAccount[]>([
		{ name: '', type: 'checking', balance: '' }
	]);

	// Step 4: Budget
	interface BudgetCategory {
		name: string;
		amount: number;
		max: number;
		color: string;
	}
	let budgetCategories = $state<BudgetCategory[]>([
		{ name: 'Housing', amount: 1500, max: 3000, color: 'emerald' },
		{ name: 'Food & Dining', amount: 500, max: 1500, color: 'amber' },
		{ name: 'Transportation', amount: 300, max: 1000, color: 'blue' },
		{ name: 'Entertainment', amount: 150, max: 500, color: 'violet' },
		{ name: 'Shopping', amount: 200, max: 1000, color: 'rose' },
		{ name: 'Utilities', amount: 200, max: 500, color: 'cyan' }
	]);

	// Step 5: Goals
	interface Goal {
		id: string;
		label: string;
		description: string;
		checked: boolean;
	}
	let goals = $state<Goal[]>([
		{ id: 'subscriptions', label: 'Track subscriptions', description: 'Find and cancel unused subscriptions', checked: false },
		{ id: 'save', label: 'Save more money', description: 'Automate savings and build an emergency fund', checked: false },
		{ id: 'debt', label: 'Pay off debt', description: 'Create a debt payoff strategy', checked: false },
		{ id: 'invest', label: 'Build investments', description: 'Track and grow your portfolio', checked: false },
		{ id: 'budget', label: 'Stay on budget', description: 'Zero-based budgeting with envelopes', checked: false }
	]);

	// Step 6: Celebration
	let showConfetti = $state(false);

	// Progress percentage
	let progress = $derived(((currentStep + 1) / totalSteps) * 100);

	// Step labels
	const stepLabels = ['Welcome', 'Link Bank', 'Add Accounts', 'Set Budget', 'Choose Goals', 'All Set!'];

	function nextStep() {
		if (currentStep < totalSteps - 1) {
			currentStep++;
			if (currentStep === totalSteps - 1) {
				// Trigger confetti on final step
				setTimeout(() => { showConfetti = true; }, 300);
			}
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	function skipStep() {
		nextStep();
	}

	function addManualAccount() {
		manualAccounts = [...manualAccounts, { name: '', type: 'checking', balance: '' }];
	}

	function removeManualAccount(index: number) {
		manualAccounts = manualAccounts.filter((_, i) => i !== index);
	}

	function simulatePlaidLink() {
		linkingBank = true;
		setTimeout(() => {
			linkingBank = false;
			bankLinked = true;
		}, 2000);
	}

	function toggleGoal(id: string) {
		goals = goals.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g));
	}

	function goToDashboard() {
		goto('/dashboard');
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	onMount(() => {
		// Try to get user name from page data or localStorage
		userName = 'there';
	});
</script>

<svelte:head>
	<title>Get Started - Finance Owl</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-surface-900">
	<!-- Progress bar -->
	<div class="fixed left-0 right-0 top-0 z-50 bg-surface-900/90 backdrop-blur-sm">
		<div class="mx-auto max-w-2xl px-4 py-4">
			<div class="flex items-center justify-between">
				<!-- Step indicator -->
				<div class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600/20">
						<svg class="h-4 w-4 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5 3.5 5.5 2.5 7C1.5 8.5 2 10.5 3 11.5C2 12.5 1.5 14.5 2.5 16C3.5 17.5 5.5 18 7 17.5C7.5 19.5 9.5 21 12 21C14.5 21 16.5 19.5 17 17.5C18.5 18 20.5 17.5 21.5 16C22.5 14.5 22 12.5 21 11.5C22 10.5 22.5 8.5 21.5 7C20.5 5.5 18.5 5 17 5.5C16.5 3.5 14.5 2 12 2Z"/>
							<circle cx="9.5" cy="10" r="1.5" fill="#064e3b"/>
							<circle cx="14.5" cy="10" r="1.5" fill="#064e3b"/>
						</svg>
					</div>
					<span class="text-sm font-medium text-surface-300">
						Step {currentStep + 1} of {totalSteps}
					</span>
				</div>
				<span class="text-xs text-surface-500">{stepLabels[currentStep]}</span>
			</div>
			<!-- Progress track -->
			<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-800">
				<div
					class="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500 ease-out"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Step content -->
	<div class="flex flex-1 items-center justify-center px-4 pt-24 pb-8">
		<div class="w-full max-w-2xl">

			<!-- =============== STEP 0: Welcome =============== -->
			{#if currentStep === 0}
				<div class="step-content text-center">
					<!-- Owl animation -->
					<div class="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 ring-1 ring-primary-500/20">
						<svg class="h-14 w-14 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5 3.5 5.5 2.5 7C1.5 8.5 2 10.5 3 11.5C2 12.5 1.5 14.5 2.5 16C3.5 17.5 5.5 18 7 17.5C7.5 19.5 9.5 21 12 21C14.5 21 16.5 19.5 17 17.5C18.5 18 20.5 17.5 21.5 16C22.5 14.5 22 12.5 21 11.5C22 10.5 22.5 8.5 21.5 7C20.5 5.5 18.5 5 17 5.5C16.5 3.5 14.5 2 12 2Z"/>
							<circle cx="9.5" cy="10" r="1.5" fill="#064e3b"/>
							<circle cx="14.5" cy="10" r="1.5" fill="#064e3b"/>
							<path d="M9 14.5C9 14.5 10 16 12 16C14 16 15 14.5 15 14.5" stroke="#064e3b" stroke-width="1.5" stroke-linecap="round" fill="none"/>
						</svg>
					</div>

					<h1 class="mt-8 text-3xl font-bold text-white sm:text-4xl">
						Welcome to Finance Owl, {userName}!
					</h1>
					<p class="mt-4 text-lg text-surface-400">
						Your personal finance command center is almost ready. Let us get you set up in about 2 minutes.
					</p>

					<div class="mt-10 grid gap-4 sm:grid-cols-3">
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4 text-center">
							<div class="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
								<svg class="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
								</svg>
							</div>
							<p class="mt-3 text-sm font-medium text-white">Link accounts</p>
							<p class="mt-1 text-xs text-surface-500">Securely connect banks</p>
						</div>
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4 text-center">
							<div class="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
								<svg class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
								</svg>
							</div>
							<p class="mt-3 text-sm font-medium text-white">Set budgets</p>
							<p class="mt-1 text-xs text-surface-500">Customize your plan</p>
						</div>
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4 text-center">
							<div class="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
								<svg class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
								</svg>
							</div>
							<p class="mt-3 text-sm font-medium text-white">Set goals</p>
							<p class="mt-1 text-xs text-surface-500">Personalize your experience</p>
						</div>
					</div>

					<button
						onclick={nextStep}
						class="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:-translate-y-0.5"
					>
						Let's Go
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- =============== STEP 1: Link Bank =============== -->
			{#if currentStep === 1}
				<div class="step-content">
					<div class="text-center">
						<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500/10 ring-1 ring-primary-500/20">
							<svg class="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
							</svg>
						</div>
						<h2 class="mt-6 text-2xl font-bold text-white">Link Your Bank Account</h2>
						<p class="mt-3 text-surface-400">
							Securely connect your bank for automatic transaction tracking and insights.
						</p>
					</div>

					{#if bankLinked}
						<div class="mt-8 rounded-xl border border-primary-500/30 bg-primary-950/30 p-6 text-center">
							<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/20">
								<svg class="h-6 w-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<p class="mt-3 text-lg font-semibold text-primary-300">Bank Connected!</p>
							<p class="mt-1 text-sm text-surface-400">Your accounts will sync automatically.</p>
						</div>
					{:else}
						<button
							onclick={simulatePlaidLink}
							disabled={linkingBank}
							class="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-surface-600 bg-surface-800 px-6 py-4 text-white transition hover:border-primary-500/30 hover:bg-surface-750 disabled:opacity-50"
						>
							{#if linkingBank}
								<div class="h-5 w-5 animate-spin rounded-full border-2 border-primary-400 border-t-transparent"></div>
								<span>Connecting...</span>
							{:else}
								<svg class="h-6 w-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
								</svg>
								<span class="font-semibold">Connect with Plaid</span>
							{/if}
						</button>
					{/if}

					<!-- Security badges -->
					<div class="mt-6 flex flex-wrap items-center justify-center gap-4">
						<div class="flex items-center gap-1.5 text-xs text-surface-500">
							<svg class="h-3.5 w-3.5 text-primary-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
							</svg>
							256-bit encryption
						</div>
						<div class="flex items-center gap-1.5 text-xs text-surface-500">
							<svg class="h-3.5 w-3.5 text-primary-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
							Read-only access
						</div>
						<div class="flex items-center gap-1.5 text-xs text-surface-500">
							<svg class="h-3.5 w-3.5 text-primary-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
							</svg>
							Used by 10,000+ apps
						</div>
					</div>

					<!-- Navigation -->
					<div class="mt-10 flex items-center justify-between">
						<button
							onclick={prevStep}
							class="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-surface-400 transition hover:text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<div class="flex gap-3">
							<button
								onclick={skipStep}
								class="rounded-lg border border-surface-700 px-5 py-2.5 text-sm font-medium text-surface-400 transition hover:border-surface-600 hover:text-white"
							>
								Skip for now
							</button>
							{#if bankLinked}
								<button
									onclick={nextStep}
									class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500"
								>
									Continue
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- =============== STEP 2: Manual Accounts =============== -->
			{#if currentStep === 2}
				<div class="step-content">
					<div class="text-center">
						<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
							<svg class="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
							</svg>
						</div>
						<h2 class="mt-6 text-2xl font-bold text-white">Add Your Accounts</h2>
						<p class="mt-3 text-surface-400">
							Manually add accounts to track. You can link banks later for automatic sync.
						</p>
					</div>

					<div class="mt-8 space-y-4">
						{#each manualAccounts as account, i}
							<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
								<div class="flex items-start gap-3">
									<div class="flex-1 space-y-3">
										<input
											type="text"
											bind:value={account.name}
											placeholder="Account name (e.g., Chase Checking)"
											class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
										/>
										<div class="flex gap-3">
											<select
												bind:value={account.type}
												class="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
											>
												<option value="checking">Checking</option>
												<option value="savings">Savings</option>
												<option value="credit">Credit Card</option>
											</select>
											<input
												type="text"
												bind:value={account.balance}
												placeholder="$0.00"
												class="w-32 rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
											/>
										</div>
									</div>
									{#if manualAccounts.length > 1}
										<button
											aria-label="Remove account"
											onclick={() => removeManualAccount(i)}
											class="mt-1 rounded-lg p-1.5 text-surface-500 transition hover:bg-surface-700 hover:text-red-400"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					<button
						onclick={addManualAccount}
						class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-surface-600 py-3 text-sm text-surface-400 transition hover:border-primary-500/30 hover:text-primary-400"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						Add another account
					</button>

					<!-- Navigation -->
					<div class="mt-10 flex items-center justify-between">
						<button
							onclick={prevStep}
							class="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-surface-400 transition hover:text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<div class="flex gap-3">
							<button
								onclick={skipStep}
								class="rounded-lg border border-surface-700 px-5 py-2.5 text-sm font-medium text-surface-400 transition hover:border-surface-600 hover:text-white"
							>
								Skip
							</button>
							<button
								onclick={nextStep}
								class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500"
							>
								Continue
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- =============== STEP 3: Budget =============== -->
			{#if currentStep === 3}
				<div class="step-content">
					<div class="text-center">
						<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20">
							<svg class="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
							</svg>
						</div>
						<h2 class="mt-6 text-2xl font-bold text-white">Set Your Monthly Budget</h2>
						<p class="mt-3 text-surface-400">
							Adjust the sliders to match your spending. You can customize these later.
						</p>
					</div>

					<div class="mt-8 space-y-5">
						{#each budgetCategories as category, i}
							<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium text-white">{category.name}</span>
									<span class="text-sm font-semibold text-primary-400">{formatCurrency(category.amount)}</span>
								</div>
								<input
									type="range"
									min="0"
									max={category.max}
									step="25"
									bind:value={budgetCategories[i].amount}
									class="mt-3 w-full accent-primary-500"
								/>
								<div class="mt-1 flex justify-between text-xs text-surface-500">
									<span>$0</span>
									<span>{formatCurrency(category.max)}</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Total -->
					<div class="mt-6 rounded-xl border border-primary-800/30 bg-primary-950/20 p-4 text-center">
						<p class="text-sm text-surface-400">Monthly budget total</p>
						<p class="mt-1 text-2xl font-bold text-white">
							{formatCurrency(budgetCategories.reduce((sum, c) => sum + c.amount, 0))}
						</p>
					</div>

					<!-- Navigation -->
					<div class="mt-10 flex items-center justify-between">
						<button
							onclick={prevStep}
							class="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-surface-400 transition hover:text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<div class="flex gap-3">
							<button
								onclick={skipStep}
								class="rounded-lg border border-surface-700 px-5 py-2.5 text-sm font-medium text-surface-400 transition hover:border-surface-600 hover:text-white"
							>
								Skip
							</button>
							<button
								onclick={nextStep}
								class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500"
							>
								Continue
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- =============== STEP 4: Goals =============== -->
			{#if currentStep === 4}
				<div class="step-content">
					<div class="text-center">
						<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20">
							<svg class="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
							</svg>
						</div>
						<h2 class="mt-6 text-2xl font-bold text-white">What Are Your Goals?</h2>
						<p class="mt-3 text-surface-400">
							Select what matters most to you. We will personalize your dashboard accordingly.
						</p>
					</div>

					<div class="mt-8 space-y-3">
						{#each goals as goal}
							<button
								onclick={() => toggleGoal(goal.id)}
								class="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all
									{goal.checked
										? 'border-primary-500/30 bg-primary-950/20'
										: 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'}"
							>
								<!-- Checkbox -->
								<div
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all
										{goal.checked
											? 'border-primary-500 bg-primary-500'
											: 'border-surface-600'}"
								>
									{#if goal.checked}
										<svg class="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</div>
								<div>
									<p class="text-sm font-medium text-white">{goal.label}</p>
									<p class="text-xs text-surface-500">{goal.description}</p>
								</div>
							</button>
						{/each}
					</div>

					<!-- Navigation -->
					<div class="mt-10 flex items-center justify-between">
						<button
							onclick={prevStep}
							class="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-surface-400 transition hover:text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
							</svg>
							Back
						</button>
						<div class="flex gap-3">
							<button
								onclick={skipStep}
								class="rounded-lg border border-surface-700 px-5 py-2.5 text-sm font-medium text-surface-400 transition hover:border-surface-600 hover:text-white"
							>
								Skip
							</button>
							<button
								onclick={nextStep}
								class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500"
							>
								Continue
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- =============== STEP 5: All Set! =============== -->
			{#if currentStep === 5}
				<div class="step-content text-center">
					<!-- Confetti animation -->
					{#if showConfetti}
						<div class="confetti-container pointer-events-none fixed inset-0 z-50">
							{#each Array(50) as _, i}
								<div
									class="confetti-piece"
									style="
										--x: {Math.random() * 100}vw;
										--delay: {Math.random() * 1}s;
										--color: {['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'][Math.floor(Math.random() * 5)]};
										--duration: {2 + Math.random() * 2}s;
										--rotation: {Math.random() * 360}deg;
									"
								></div>
							{/each}
						</div>
					{/if}

					<!-- Success icon -->
					<div class="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 ring-1 ring-primary-500/20">
						<svg class="h-14 w-14 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
						</svg>
					</div>

					<h2 class="mt-8 text-3xl font-bold text-white">You're All Set!</h2>
					<p class="mt-4 text-lg text-surface-400">
						Your dashboard is personalized and ready. Start exploring your financial overview.
					</p>

					<!-- Quick summary -->
					<div class="mt-8 grid gap-3 sm:grid-cols-3">
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
							<p class="text-2xl font-bold text-primary-400">{bankLinked ? '1' : '0'}</p>
							<p class="text-xs text-surface-500">Banks linked</p>
						</div>
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
							<p class="text-2xl font-bold text-amber-400">{budgetCategories.length}</p>
							<p class="text-xs text-surface-500">Budget categories</p>
						</div>
						<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
							<p class="text-2xl font-bold text-blue-400">{goals.filter((g) => g.checked).length}</p>
							<p class="text-xs text-surface-500">Goals selected</p>
						</div>
					</div>

					<button
						onclick={goToDashboard}
						class="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500 hover:-translate-y-0.5"
					>
						Go to Dashboard
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Step content transition */
	.step-content {
		animation: step-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes step-enter {
		from {
			opacity: 0;
			transform: translateX(20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	/* Range slider styling */
	input[type='range'] {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 9999px;
		background: rgb(51 65 85 / 0.8);
		outline: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #10b981;
		cursor: pointer;
		border: 3px solid #064e3b;
		box-shadow: 0 0 10px rgb(16 185 129 / 0.3);
		transition: transform 0.15s, box-shadow 0.15s;
	}

	input[type='range']::-webkit-slider-thumb:hover {
		transform: scale(1.15);
		box-shadow: 0 0 15px rgb(16 185 129 / 0.5);
	}

	input[type='range']::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #10b981;
		cursor: pointer;
		border: 3px solid #064e3b;
		box-shadow: 0 0 10px rgb(16 185 129 / 0.3);
	}

	/* Confetti animation */
	.confetti-container {
		overflow: hidden;
	}

	.confetti-piece {
		position: absolute;
		width: 10px;
		height: 10px;
		background: var(--color);
		left: var(--x);
		top: -20px;
		border-radius: 2px;
		animation: confetti-fall var(--duration) var(--delay) ease-out forwards;
		transform: rotate(var(--rotation));
	}

	@keyframes confetti-fall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(100vh) rotate(720deg);
			opacity: 0;
		}
	}
</style>
