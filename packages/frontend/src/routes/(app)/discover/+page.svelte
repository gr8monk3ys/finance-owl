<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let activeSection = $state<'unclaimed' | 'recommendations'>('unclaimed');
	let searchLoading = $state(false);
	let generateLoading = $state(false);
	let filterType = $state<string>('all');

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			searchLoading = false;
			generateLoading = false;
		}
		if (form?.error) {
			searchLoading = false;
			generateLoading = false;
		}
	});

	function fmt(amount: number | null | undefined): string {
		if (amount === null || amount === undefined) return 'Unknown';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtDate(date: string | null): string {
		if (!date) return '--';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function propertyTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			bank_account: 'Bank Account',
			insurance: 'Insurance',
			utility_deposit: 'Utility Deposit',
			tax_refund: 'Tax Refund',
			payroll: 'Payroll',
			other: 'Other'
		};
		return labels[type] || type;
	}

	function productTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			credit_card: 'Credit Card',
			savings_account: 'Savings Account',
			checking_account: 'Checking Account',
			personal_loan: 'Personal Loan',
			auto_loan: 'Auto Loan',
			mortgage: 'Mortgage',
			investment_account: 'Investment Account'
		};
		return labels[type] || type;
	}

	function rewardTypeLabel(type: string | null): string {
		if (!type) return '';
		const labels: Record<string, string> = {
			cashback: 'Cashback',
			points: 'Points',
			miles: 'Miles'
		};
		return labels[type] || type;
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'found':
				return 'bg-blue-500/20 text-blue-400';
			case 'claimed':
				return 'bg-green-500/20 text-green-400';
			case 'dismissed':
				return 'bg-surface-600/50 text-surface-400';
			default:
				return 'bg-surface-600/50 text-surface-400';
		}
	}

	function matchScoreColor(score: number): string {
		if (score >= 80) return 'text-green-400';
		if (score >= 60) return 'text-yellow-400';
		return 'text-surface-400';
	}

	function matchScoreBg(score: number): string {
		if (score >= 80) return 'bg-green-500';
		if (score >= 60) return 'bg-yellow-500';
		return 'bg-surface-500';
	}

	const productTypes = $derived(() => {
		const types = new Set<string>();
		(data.recommendations ?? []).forEach((r: any) => types.add(r.productType));
		return Array.from(types);
	});

	const filteredRecommendations = $derived(
		filterType === 'all'
			? data.recommendations ?? []
			: (data.recommendations ?? []).filter((r: any) => r.productType === filterType)
	);

	const foundResults = $derived(
		(data.unclaimedResults ?? []).filter((r: any) => r.status === 'found')
	);
	const claimedResults = $derived(
		(data.unclaimedResults ?? []).filter((r: any) => r.status === 'claimed')
	);
	const dismissedResults = $derived(
		(data.unclaimedResults ?? []).filter((r: any) => r.status === 'dismissed')
	);

	const totalUnclaimedAmount = $derived(
		foundResults.reduce(
			(sum: number, r: any) => sum + (r.reportedAmount ?? 0),
			0
		)
	);
</script>

<svelte:head>
	<title>Discover - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-white">Discover</h2>
		<p class="mt-1 text-sm text-surface-400">
			Find unclaimed money and get personalized financial product recommendations.
		</p>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Section Tabs -->
	<div class="flex gap-1 rounded-lg bg-surface-800 p-1">
		<button
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition {activeSection === 'unclaimed'
				? 'bg-surface-700 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeSection = 'unclaimed')}
		>
			Unclaimed Money
		</button>
		<button
			class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition {activeSection === 'recommendations'
				? 'bg-surface-700 text-white'
				: 'text-surface-400 hover:text-white'}"
			onclick={() => (activeSection = 'recommendations')}
		>
			Recommendations
		</button>
	</div>

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- UNCLAIMED MONEY SECTION -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{#if activeSection === 'unclaimed'}
		<!-- Summary Cards -->
		<div class="grid gap-4 sm:grid-cols-3">
			<Card>
				<p class="text-sm text-surface-400">Found</p>
				<p class="mt-1 text-xl font-bold text-blue-400">{foundResults.length}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Potential Amount</p>
				<p class="mt-1 text-xl font-bold text-green-400">{fmt(totalUnclaimedAmount)}</p>
			</Card>
			<Card>
				<p class="text-sm text-surface-400">Claimed</p>
				<p class="mt-1 text-xl font-bold text-emerald-400">{claimedResults.length}</p>
			</Card>
		</div>

		<!-- Search Form -->
		<Card>
			<h3 class="mb-4 text-lg font-semibold text-white">Search for Unclaimed Money</h3>
			<p class="mb-4 text-sm text-surface-400">
				Search state databases for unclaimed property, forgotten bank accounts, insurance
				payouts, and more.
			</p>
			<form
				method="POST"
				action="?/search"
				use:enhance={() => {
					searchLoading = true;
					return async ({ update }) => {
						await update();
					};
				}}
				class="space-y-4"
			>
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<label for="firstName" class="block text-sm font-medium text-surface-300">
							First Name
						</label>
						<input
							id="firstName"
							name="firstName"
							type="text"
							required
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="John"
						/>
					</div>
					<div>
						<label for="lastName" class="block text-sm font-medium text-surface-300">
							Last Name
						</label>
						<input
							id="lastName"
							name="lastName"
							type="text"
							required
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
							placeholder="Doe"
						/>
					</div>
					<div>
						<label for="state" class="block text-sm font-medium text-surface-300">
							State
						</label>
						<select
							id="state"
							name="state"
							required
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="">Select a state...</option>
							{#each data.states ?? [] as st}
								<option value={st.abbreviation}>{st.name}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="flex justify-end">
					<Button type="submit" loading={searchLoading}>Search</Button>
				</div>
			</form>
		</Card>

		<!-- Found Results -->
		{#if foundResults.length > 0}
			<div>
				<h3 class="mb-3 text-lg font-semibold text-white">Found Properties</h3>
				<div class="space-y-3">
					{#each foundResults as result}
						<Card>
							<div class="flex items-start justify-between gap-4">
								<div class="flex-1">
									<div class="flex items-center gap-2">
										<span
											class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColor(result.status)}"
										>
											{result.status}
										</span>
										<span class="text-xs text-surface-500">
											{propertyTypeLabel(result.propertyType)}
										</span>
									</div>
									<p class="mt-1 font-medium text-white">{result.holderName}</p>
									<div class="mt-1 flex items-center gap-4 text-sm text-surface-400">
										<span>{result.state}</span>
										{#if result.reportedAmount}
											<span class="font-semibold text-green-400">
												{fmt(result.reportedAmount)}
											</span>
										{:else}
											<span class="text-surface-500">Amount unknown</span>
										{/if}
									</div>
								</div>
								<div class="flex flex-col gap-2">
									{#if result.claimUrl}
										<a
											href={result.claimUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700"
										>
											Claim
										</a>
									{/if}
									<form method="POST" action="?/updateResultStatus" use:enhance>
										<input type="hidden" name="id" value={result.id} />
										<input type="hidden" name="status" value="claimed" />
										<Button variant="secondary" size="sm" type="submit">
											Mark Claimed
										</Button>
									</form>
									<form method="POST" action="?/updateResultStatus" use:enhance>
										<input type="hidden" name="id" value={result.id} />
										<input type="hidden" name="status" value="dismissed" />
										<Button variant="ghost" size="sm" type="submit">Dismiss</Button>
									</form>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Claimed Results -->
		{#if claimedResults.length > 0}
			<div>
				<h3 class="mb-3 text-lg font-semibold text-white">Claimed</h3>
				<div class="space-y-3">
					{#each claimedResults as result}
						<Card>
							<div class="flex items-center gap-3">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {statusColor(result.status)}"
								>
									{result.status}
								</span>
								<div class="flex-1">
									<p class="font-medium text-surface-300">{result.holderName}</p>
									<div class="flex items-center gap-4 text-sm text-surface-500">
										<span>{propertyTypeLabel(result.propertyType)}</span>
										<span>{result.state}</span>
										{#if result.reportedAmount}
											<span>{fmt(result.reportedAmount)}</span>
										{/if}
									</div>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Empty State -->
		{#if (data.unclaimedResults ?? []).length === 0}
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
							d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
						/>
					</svg>
					<p class="mt-4 text-lg text-surface-300">No searches yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Search above to find unclaimed money in your name.
					</p>
				</div>
			</Card>
		{/if}

	<!-- ═══════════════════════════════════════════════════════════════ -->
	<!-- RECOMMENDATIONS SECTION -->
	<!-- ═══════════════════════════════════════════════════════════════ -->
	{:else}
		<!-- Generate / Refresh -->
		<div class="flex items-center justify-between">
			<p class="text-sm text-surface-400">
				{#if filteredRecommendations.length > 0}
					{filteredRecommendations.length} recommendation{filteredRecommendations.length !== 1 ? 's' : ''}
				{:else}
					No recommendations yet
				{/if}
			</p>
			<form
				method="POST"
				action="?/generateRecommendations"
				use:enhance={() => {
					generateLoading = true;
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<Button type="submit" loading={generateLoading}>
					{(data.recommendations ?? []).length > 0 ? 'Refresh' : 'Generate'} Recommendations
				</Button>
			</form>
		</div>

		<!-- Type Filter -->
		{#if (data.recommendations ?? []).length > 0}
			<div class="flex flex-wrap gap-2">
				<button
					class="rounded-full px-3 py-1 text-sm font-medium transition {filterType === 'all'
						? 'bg-primary-600 text-white'
						: 'bg-surface-700 text-surface-400 hover:text-white'}"
					onclick={() => (filterType = 'all')}
				>
					All
				</button>
				{#each productTypes() as pType}
					<button
						class="rounded-full px-3 py-1 text-sm font-medium transition {filterType === pType
							? 'bg-primary-600 text-white'
							: 'bg-surface-700 text-surface-400 hover:text-white'}"
						onclick={() => (filterType = pType)}
					>
						{productTypeLabel(pType)}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Recommendation Cards -->
		{#if filteredRecommendations.length > 0}
			<div class="space-y-4">
				{#each filteredRecommendations as rec}
					<Card>
						<div class="flex items-start gap-4">
							<!-- Match Score -->
							<div class="flex flex-col items-center">
								<div
									class="flex h-14 w-14 items-center justify-center rounded-full border-2 {rec.matchScore >= 80
										? 'border-green-500'
										: rec.matchScore >= 60
											? 'border-yellow-500'
											: 'border-surface-500'}"
								>
									<span class="text-lg font-bold {matchScoreColor(rec.matchScore)}">
										{rec.matchScore}
									</span>
								</div>
								<span class="mt-1 text-xs text-surface-500">Match</span>
							</div>

							<!-- Content -->
							<div class="flex-1">
								<div class="flex items-start justify-between">
									<div>
										<div class="flex items-center gap-2">
											<h4 class="font-semibold text-white">{rec.productName}</h4>
											{#if rec.rewardType}
												<span
													class="inline-flex rounded-full bg-primary-900/50 px-2 py-0.5 text-xs font-medium text-primary-300"
												>
													{rewardTypeLabel(rec.rewardType)}
												</span>
											{/if}
										</div>
										<p class="text-sm text-surface-400">{rec.provider}</p>
										<span
											class="mt-1 inline-flex rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-400"
										>
											{productTypeLabel(rec.productType)}
										</span>
									</div>

									<!-- Dismiss -->
									<form method="POST" action="?/dismissRecommendation" use:enhance>
										<input type="hidden" name="id" value={rec.id} />
										<button
											type="submit"
											class="rounded-lg p-1 text-surface-500 transition hover:bg-surface-700 hover:text-surface-300"
											title="Dismiss recommendation"
										>
											<svg
												class="h-5 w-5"
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

								<p class="mt-2 text-sm text-surface-300">{rec.description}</p>

								<!-- Key Features -->
								<div class="mt-3 flex flex-wrap gap-3 text-sm">
									{#if rec.interestRate !== null && rec.interestRate !== undefined}
										<span class="text-surface-400">
											{#if rec.productType === 'savings_account' || rec.productType === 'checking_account'}
												<span class="font-semibold text-green-400">{rec.interestRate}%</span> APY
											{:else if rec.productType === 'credit_card'}
												<span class="font-semibold text-surface-300">{rec.interestRate}%</span> APR
											{:else}
												<span class="font-semibold text-surface-300">{rec.interestRate}%</span> Rate
											{/if}
										</span>
									{/if}
									{#if rec.annualFee !== null && rec.annualFee !== undefined}
										<span class="text-surface-400">
											{#if rec.annualFee === 0}
												<span class="font-semibold text-green-400">No annual fee</span>
											{:else}
												<span class="font-semibold text-surface-300">{fmt(rec.annualFee)}</span> annual fee
											{/if}
										</span>
									{/if}
								</div>

								<!-- Match Reason -->
								<div class="mt-3 rounded-lg bg-surface-900/50 px-3 py-2">
									<p class="text-xs font-medium text-surface-500">Why this matches you</p>
									<p class="mt-0.5 text-sm text-surface-300">{rec.matchReason}</p>
								</div>

								<!-- Match Score Bar -->
								<div class="mt-3">
									<div class="h-1.5 w-full rounded-full bg-surface-700">
										<div
											class="h-1.5 rounded-full transition-all {matchScoreBg(rec.matchScore)}"
											style="width: {rec.matchScore}%"
										></div>
									</div>
								</div>

								<!-- Apply Button -->
								{#if rec.applyUrl}
									<div class="mt-3">
										<a
											href={rec.applyUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
										>
											Learn More
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
													d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
												/>
											</svg>
										</a>
									</div>
								{/if}
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
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
							d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
						/>
					</svg>
					<p class="mt-4 text-lg text-surface-300">No recommendations yet</p>
					<p class="mt-1 text-sm text-surface-500">
						Generate personalized recommendations based on your financial profile.
					</p>
				</div>
			</Card>
		{/if}
	{/if}
</div>
