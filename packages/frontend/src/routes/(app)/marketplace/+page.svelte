<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	function fmt(amount: number | null | undefined): string {
		if (amount === null || amount === undefined) return '--';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function fmtPercent(value: number | null | undefined): string {
		if (value === null || value === undefined) return '--';
		return `${value.toFixed(2)}%`;
	}

	function categoryLabel(cat: string): string {
		const labels: Record<string, string> = {
			credit_card: 'Credit Cards',
			savings_account: 'Savings Accounts',
			cd: 'CDs',
			loan: 'Loans',
			insurance: 'Insurance',
			investment: 'Investments'
		};
		return labels[cat] || cat;
	}

	function handleCategoryFilter(category: string) {
		const params = new URLSearchParams();
		if (category) params.set('category', category);
		if (data.sort) params.set('sort', data.sort);
		const queryString = params.toString();
		goto(`/marketplace${queryString ? `?${queryString}` : ''}`);
	}

	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const params = new URLSearchParams();
		if (data.category) params.set('category', data.category);
		params.set('sort', target.value);
		goto(`/marketplace?${params.toString()}`);
	}

	function renderStars(rating: number | null): string {
		if (rating === null || rating === undefined) return '';
		const full = Math.floor(rating);
		const half = rating - full >= 0.5 ? 1 : 0;
		const empty = 5 - full - half;
		return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
	}

	const categories = [
		'',
		'credit_card',
		'savings_account',
		'cd',
		'loan',
		'insurance',
		'investment'
	];
</script>

<svelte:head>
	<title>Marketplace - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h2 class="text-2xl font-bold text-white">Financial Marketplace</h2>
		<p class="mt-1 text-sm text-surface-400">
			Discover financial products tailored to your needs.
		</p>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Recommendations Section -->
	{#if data.recommendations && data.recommendations.length > 0}
		<div>
			<h3 class="mb-3 text-lg font-semibold text-white">Recommended for You</h3>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.recommendations.slice(0, 3) as product}
					<Card>
						<div class="space-y-2">
							<div class="flex items-start justify-between">
								<div>
									<p class="font-semibold text-white">{product.name}</p>
									<p class="text-sm text-surface-400">{product.provider}</p>
								</div>
								<span
									class="inline-flex rounded-full bg-primary-900/50 px-2 py-0.5 text-xs font-medium text-primary-300"
								>
									{categoryLabel(product.category)}
								</span>
							</div>

							{#if product.description}
								<p class="text-sm text-surface-400 line-clamp-2">{product.description}</p>
							{/if}

							<div class="flex flex-wrap gap-3 text-sm">
								{#if product.interestRate !== null && product.interestRate !== undefined}
									<span class="text-surface-400">
										<span class="font-semibold text-white">{fmtPercent(product.interestRate)}</span>
										{#if product.category === 'savings_account' || product.category === 'cd'}
											APY
										{:else}
											APR
										{/if}
									</span>
								{/if}
								{#if product.rewardRate !== null && product.rewardRate !== undefined}
									<span class="text-surface-400">
										<span class="font-semibold text-green-400">{product.rewardRate}%</span> rewards
									</span>
								{/if}
								{#if product.annualFee !== null && product.annualFee !== undefined}
									<span class="text-surface-400">
										{#if product.annualFee === 0}
											<span class="font-semibold text-green-400">No annual fee</span>
										{:else}
											<span class="font-semibold text-surface-300">{fmt(product.annualFee)}</span>
											/yr
										{/if}
									</span>
								{/if}
							</div>

							{#if product.affiliateUrl}
								<form method="POST" action="?/trackClick" use:enhance>
									<input type="hidden" name="productId" value={product.id} />
									<a
										href={product.affiliateUrl}
										target="_blank"
										rel="noopener noreferrer"
										onclick={() => {
											const formEl = document.querySelector(
												`form input[value="${product.id}"]`
											)?.closest('form');
											if (formEl) formEl.requestSubmit();
										}}
										class="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
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
								</form>
							{/if}
						</div>
					</Card>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Category Filter Tabs -->
	<div class="flex flex-wrap gap-2">
		{#each categories as cat}
			<button
				class="rounded-full px-3 py-1 text-sm font-medium transition {data.category === cat
					? 'bg-primary-600 text-white'
					: 'bg-surface-700 text-surface-400 hover:text-white'}"
				onclick={() => handleCategoryFilter(cat)}
			>
				{cat === '' ? 'All' : categoryLabel(cat)}
			</button>
		{/each}
	</div>

	<!-- Sort -->
	<div class="flex items-center justify-between">
		<p class="text-sm text-surface-400">
			{data.products.length} product{data.products.length !== 1 ? 's' : ''}
		</p>
		<select
			value={data.sort}
			onchange={handleSortChange}
			class="rounded-lg border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
		>
			<option value="rating">Top Rated</option>
			<option value="interest_rate">Interest Rate</option>
			<option value="annual_fee">Lowest Fee</option>
			<option value="reward_rate">Best Rewards</option>
		</select>
	</div>

	<!-- Product List -->
	{#if data.products.length === 0}
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
						d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No products found</p>
				<p class="mt-1 text-sm text-surface-500">
					Try a different category or check back later.
				</p>
			</div>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each data.products as product}
				<Card>
					<div class="flex items-start gap-4">
						<div class="flex-1">
							<div class="flex items-start justify-between">
								<div>
									<h4 class="font-semibold text-white">{product.name}</h4>
									<p class="text-sm text-surface-400">{product.provider}</p>
								</div>
								<span
									class="inline-flex rounded-full bg-surface-700 px-2 py-0.5 text-xs text-surface-400"
								>
									{categoryLabel(product.category)}
								</span>
							</div>

							{#if product.description}
								<p class="mt-2 text-sm text-surface-300">{product.description}</p>
							{/if}

							<!-- Key Stats -->
							<div class="mt-3 flex flex-wrap gap-4 text-sm">
								{#if product.interestRate !== null && product.interestRate !== undefined}
									<div>
										<p class="text-xs text-surface-500">
											{#if product.category === 'savings_account' || product.category === 'cd'}
												APY
											{:else}
												APR
											{/if}
										</p>
										<p class="font-semibold text-white">{fmtPercent(product.interestRate)}</p>
									</div>
								{/if}
								{#if product.rewardRate !== null && product.rewardRate !== undefined}
									<div>
										<p class="text-xs text-surface-500">Rewards</p>
										<p class="font-semibold text-green-400">{product.rewardRate}%</p>
									</div>
								{/if}
								{#if product.annualFee !== null && product.annualFee !== undefined}
									<div>
										<p class="text-xs text-surface-500">Annual Fee</p>
										<p class="font-semibold text-white">
											{product.annualFee === 0 ? 'Free' : fmt(product.annualFee)}
										</p>
									</div>
								{/if}
								{#if product.signupBonus}
									<div>
										<p class="text-xs text-surface-500">Signup Bonus</p>
										<p class="font-semibold text-primary-400">{product.signupBonus}</p>
									</div>
								{/if}
								{#if product.rating !== null && product.rating !== undefined}
									<div>
										<p class="text-xs text-surface-500">Rating</p>
										<p class="font-semibold text-yellow-400">
											{renderStars(product.rating)}
											<span class="text-surface-400">({product.rating.toFixed(1)})</span>
										</p>
									</div>
								{/if}
							</div>

							{#if product.terms}
								<p class="mt-2 text-xs text-surface-500">{product.terms}</p>
							{/if}
						</div>

						<!-- CTA -->
						<div class="flex flex-col items-end gap-2">
							{#if product.affiliateUrl}
								<form method="POST" action="?/trackClick" use:enhance>
									<input type="hidden" name="productId" value={product.id} />
									<a
										href={product.affiliateUrl}
										target="_blank"
										rel="noopener noreferrer"
										onclick={() => {
											const formEl = document.querySelector(
												`form input[value="${product.id}"]`
											)?.closest('form');
											if (formEl) formEl.requestSubmit();
										}}
										class="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700"
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
								</form>
							{/if}
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
