<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { Button, Card, Badge } from '$components/ui';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let billingInterval = $state<'month' | 'year'>('month');
	let checkoutLoading = $state<string | null>(null);

	const currentPlanName = $derived(data.features?.plan || 'free');

	interface PlanDisplay {
		name: string;
		title: string;
		description: string;
		monthlyPrice: number;
		yearlyPrice: number;
		features: string[];
		highlighted: boolean;
		badge?: string;
		gradient: string;
		iconColor: string;
	}

	const planDisplays: PlanDisplay[] = [
		{
			name: 'free',
			title: 'Free',
			description: 'For getting started with personal finance tracking.',
			monthlyPrice: 0,
			yearlyPrice: 0,
			features: [
				'2 linked bank accounts',
				'Basic budgets & analytics',
				'Manual accounts',
				'5 AI chat messages / day',
				'3 months transaction history'
			],
			highlighted: false,
			gradient: 'from-surface-700/50 to-surface-800',
			iconColor: 'text-surface-400'
		},
		{
			name: 'pro',
			title: 'Pro',
			description: 'Full-featured finance management for power users.',
			monthlyPrice: 9.99,
			yearlyPrice: 99.99,
			features: [
				'Unlimited linked accounts',
				'Unlimited AI chat & insights',
				'Subscription tracking',
				'Bill negotiation tools',
				'Smart savings automation',
				'Investment tracking',
				'Advanced reports & analytics',
				'CSV export',
				'Custom categories',
				'Unlimited transaction history',
				'Priority support'
			],
			highlighted: true,
			badge: 'Most Popular',
			gradient: 'from-emerald-900/40 to-surface-800',
			iconColor: 'text-emerald-400'
		},
		{
			name: 'premium',
			title: 'Premium',
			description: 'Share finances and budgets with your household.',
			monthlyPrice: 19.99,
			yearlyPrice: 199.99,
			features: [
				'Everything in Pro',
				'Household sharing (up to 10 members)',
				'Family budgets',
				'Shared financial goals',
				'Advisor sharing',
				'API access',
				'Dedicated support'
			],
			highlighted: false,
			badge: 'Best Value',
			gradient: 'from-purple-900/30 to-surface-800',
			iconColor: 'text-purple-400'
		}
	];

	function getPrice(plan: PlanDisplay): string {
		if (plan.name === 'free') return '$0';
		const price = billingInterval === 'month' ? plan.monthlyPrice : plan.yearlyPrice;
		return `$${price.toFixed(2)}`;
	}

	function getPeriod(plan: PlanDisplay): string {
		if (plan.name === 'free') return 'forever';
		return billingInterval === 'month' ? '/mo' : '/yr';
	}

	function getYearlySavings(plan: PlanDisplay): string | null {
		if (plan.name === 'free' || billingInterval !== 'year') return null;
		const monthlyCost = plan.monthlyPrice * 12;
		const savings = monthlyCost - plan.yearlyPrice;
		if (savings <= 0) return null;
		const pct = Math.round((savings / monthlyCost) * 100);
		return `Save ${pct}%`;
	}

	function getPlanId(planName: string): string | undefined {
		const plan = data.plans?.find((p: any) => p.name === planName);
		return plan?.id;
	}

	// Feature comparison data
	const comparisonFeatures = [
		{ name: 'Linked Bank Accounts', free: '2', pro: 'Unlimited', premium: 'Unlimited' },
		{ name: 'AI Chat Messages', free: '5 / day', pro: 'Unlimited', premium: 'Unlimited' },
		{
			name: 'Transaction History',
			free: '3 months' as boolean | string,
			pro: 'Unlimited' as boolean | string,
			premium: 'Unlimited' as boolean | string
		},
		{
			name: 'AI Insights',
			free: false as boolean | string,
			pro: true as boolean | string,
			premium: true as boolean | string
		},
		{ name: 'Subscription Tracking', free: false, pro: true, premium: true },
		{ name: 'Bill Negotiation', free: false, pro: true, premium: true },
		{ name: 'Smart Savings', free: false, pro: true, premium: true },
		{ name: 'Investment Tracking', free: false, pro: true, premium: true },
		{ name: 'Reports & Analytics', free: 'Basic', pro: 'Advanced', premium: 'Advanced' },
		{ name: 'CSV Export', free: false, pro: true, premium: true },
		{ name: 'Custom Categories', free: false, pro: true, premium: true },
		{ name: 'Household Sharing', free: false, pro: false, premium: 'Up to 10' },
		{ name: 'Family Budgets & Goals', free: false, pro: false, premium: true },
		{ name: 'Advisor Sharing', free: false, pro: false, premium: true },
		{ name: 'API Access', free: false, pro: false, premium: true },
		{ name: 'Priority Support', free: false, pro: true, premium: true },
		{ name: 'Dedicated Support', free: false, pro: false, premium: true }
	];
</script>

<svelte:head>
	<title>Pricing - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-12 pb-12">
	<!-- Header -->
	<div class="text-center">
		<h1
			class="bg-gradient-to-r from-emerald-400 via-primary-400 to-emerald-300 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl"
		>
			Simple, transparent pricing
		</h1>
		<p class="mx-auto mt-4 max-w-2xl text-lg text-surface-400">
			Start free, upgrade when you need more, and choose monthly or yearly billing on paid plans.
		</p>
	</div>

	{#if form?.error}
		<div
			class="mx-auto max-w-md rounded-lg bg-red-900/50 px-4 py-3 text-center text-sm text-red-300"
		>
			{form.error}
		</div>
	{/if}

	<!-- Billing Toggle -->
	<div class="flex items-center justify-center gap-3">
		<button
			class="rounded-lg px-4 py-2 text-sm font-medium transition-all {billingInterval === 'month'
				? 'bg-surface-700 text-white shadow-lg shadow-black/20'
				: 'text-surface-400 hover:text-surface-200'}"
			onclick={() => (billingInterval = 'month')}
		>
			Monthly
		</button>
		<button
			class="relative rounded-lg px-4 py-2 text-sm font-medium transition-all {billingInterval ===
			'year'
				? 'bg-surface-700 text-white shadow-lg shadow-black/20'
				: 'text-surface-400 hover:text-surface-200'}"
			onclick={() => (billingInterval = 'year')}
		>
			Yearly
			<span
				class="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg"
			>
				Save 17%
			</span>
		</button>
	</div>

	<!-- Pricing Cards -->
	<div class="grid gap-6 sm:grid-cols-3">
		{#each planDisplays as plan}
			<div
				class="relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b transition-all duration-300 {plan.highlighted
					? 'border-emerald-500/50 shadow-xl shadow-emerald-900/20 scale-[1.02]'
					: 'border-surface-700/50 hover:border-surface-600'} {plan.gradient}"
			>
				{#if plan.badge}
					<div
						class="absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold {plan.highlighted
							? 'bg-emerald-500/20 text-emerald-400'
							: 'bg-purple-500/20 text-purple-400'}"
					>
						{plan.badge}
					</div>
				{/if}

				<div class="p-8">
					<!-- Plan Header -->
					<div class="mb-6">
						<div class="mb-2 flex items-center gap-2">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-xl {plan.highlighted
									? 'bg-emerald-500/10'
									: plan.name === 'premium'
										? 'bg-purple-500/10'
										: 'bg-surface-700'}"
							>
								{#if plan.name === 'free'}
									<svg
										class="h-5 w-5 {plan.iconColor}"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								{:else if plan.name === 'pro'}
									<svg
										class="h-5 w-5 {plan.iconColor}"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13 10V3L4 14h7v7l9-11h-7z"
										/>
									</svg>
								{:else}
									<svg
										class="h-5 w-5 {plan.iconColor}"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
										/>
									</svg>
								{/if}
							</div>
						</div>
						<h3 class="text-2xl font-bold text-white">{plan.title}</h3>
						<p class="mt-1 text-sm text-surface-400">{plan.description}</p>
					</div>

					<!-- Price -->
					<div class="mb-8">
						<div class="flex items-baseline gap-1">
							<span class="text-4xl font-bold text-white">{getPrice(plan)}</span>
							<span class="text-base text-surface-400">{getPeriod(plan)}</span>
						</div>
						{#if getYearlySavings(plan)}
							<div class="mt-2">
								<span
									class="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400"
								>
									{getYearlySavings(plan)}
								</span>
							</div>
						{/if}
					</div>

					<!-- Features -->
					<ul class="mb-8 space-y-3">
						{#each plan.features as feature}
							<li class="flex items-start gap-3 text-sm text-surface-300">
								<svg
									class="mt-0.5 h-4 w-4 flex-shrink-0 {plan.highlighted
										? 'text-emerald-400'
										: plan.name === 'premium'
											? 'text-purple-400'
											: 'text-surface-500'}"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
								{feature}
							</li>
						{/each}
					</ul>

					<!-- CTA -->
					<div class="mt-auto">
						{#if plan.name === currentPlanName}
							<div
								class="w-full rounded-xl border border-surface-600 px-4 py-3 text-center text-sm font-medium text-surface-400"
							>
								Current Plan
							</div>
						{:else if plan.name === 'free'}
							{#if currentPlanName !== 'free'}
								<div
									class="w-full rounded-xl border border-surface-700 px-4 py-3 text-center text-sm text-surface-500"
								>
									Included with all plans
								</div>
							{:else}
								<div
									class="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-center text-sm text-emerald-400"
								>
									Your Current Plan
								</div>
							{/if}
						{:else}
							<form
								method="POST"
								action="?/checkout"
								use:enhance={() => {
									checkoutLoading = plan.name;
									return async ({ update }) => {
										checkoutLoading = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="planId" value={getPlanId(plan.name) || ''} />
								<input type="hidden" name="interval" value={billingInterval} />
								<Button
									variant={plan.highlighted ? 'primary' : 'secondary'}
									class="w-full !rounded-xl !py-3 {plan.highlighted
										? '!bg-emerald-600 hover:!bg-emerald-500'
										: ''}"
									type="submit"
									loading={checkoutLoading === plan.name}
								>
									{#if currentPlanName === 'free'}
										Get Started
										{:else if plan.name === 'premium'}
											Upgrade to Premium
										{:else}
											Switch to {plan.title}
										{/if}
								</Button>
							</form>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Feature Comparison Table -->
	<Card>
		<h2 class="text-2xl font-bold text-white">Compare all features</h2>
		<p class="mt-1 text-sm text-surface-400">See exactly what you get with each plan.</p>

		<div class="mt-6 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-surface-700">
						<th class="py-4 pr-6 text-left font-medium text-surface-400">Feature</th>
						<th class="px-6 py-4 text-center font-medium text-surface-400">Free</th>
						<th class="px-6 py-4 text-center font-medium text-emerald-400">Pro</th>
						<th class="px-6 py-4 text-center font-medium text-purple-400">Premium</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-700/50">
					{#each comparisonFeatures as feature}
						<tr class="transition-colors hover:bg-surface-700/20">
							<td class="py-4 pr-6 text-surface-300">{feature.name}</td>
							{#each ['free', 'pro', 'premium'] as tier}
								{@const val = feature[tier as keyof typeof feature]}
								<td class="px-6 py-4 text-center">
									{#if typeof val === 'boolean'}
										{#if val}
											<svg
												class="mx-auto h-5 w-5 {tier === 'pro'
													? 'text-emerald-400'
													: tier === 'premium'
														? 'text-purple-400'
														: 'text-primary-500'}"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										{:else}
											<svg
												class="mx-auto h-5 w-5 text-surface-600"
												viewBox="0 0 20 20"
												fill="currentColor"
											>
												<path
													fill-rule="evenodd"
													d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
													clip-rule="evenodd"
												/>
											</svg>
										{/if}
									{:else}
										<span
											class={tier === 'free'
												? 'text-surface-400'
												: tier === 'pro'
													? 'font-medium text-white'
													: 'font-medium text-white'}>{val}</span
										>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Card>

	<!-- FAQ Section -->
	<Card>
		<h2 class="text-2xl font-bold text-white">Frequently Asked Questions</h2>
		<div class="mt-6 grid gap-6 sm:grid-cols-2">
			<div>
				<h3 class="text-sm font-semibold text-white">Can I cancel anytime?</h3>
				<p class="mt-2 text-sm text-surface-400">
					Yes, you can cancel your subscription at any time. You'll continue to have access to
					premium features until the end of your current billing period.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-white">What happens when I downgrade?</h3>
				<p class="mt-2 text-sm text-surface-400">
					When you downgrade, your premium features remain active until the end of your billing
					period. After that, you'll return to the free plan with its limitations.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-white">Is my payment information secure?</h3>
				<p class="mt-2 text-sm text-surface-400">
					All payments are processed securely through Stripe. We never store your credit card
					details on our servers.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-white">Can I switch plans at any time?</h3>
				<p class="mt-2 text-sm text-surface-400">
					Absolutely. You can upgrade or downgrade at any time. When upgrading, you'll be prorated
					for the remainder of your billing cycle.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-white">
					What's the difference between monthly and yearly?
				</h3>
				<p class="mt-2 text-sm text-surface-400">
					Yearly plans save you approximately 17% compared to monthly billing. You're billed once
					per year instead of twelve times.
				</p>
			</div>
				<div>
					<h3 class="text-sm font-semibold text-white">Do you offer a free trial?</h3>
					<p class="mt-2 text-sm text-surface-400">
						Trials can vary by workspace and billing setup. The checkout flow will show any active
						introductory offer before you confirm a paid plan.
					</p>
				</div>
			</div>
		</Card>
	</div>
