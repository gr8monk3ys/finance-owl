<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { Button, Card, Badge } from '$components/ui';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let billingInterval = $state<'month' | 'year'>('month');
	let checkoutLoading = $state<string | null>(null);
	let portalLoading = $state(false);
	let cancelLoading = $state(false);
	let resumeLoading = $state(false);
	let showCancelConfirm = $state(false);

	const currentPlanName = $derived(data.subscription?.planName || data.features?.plan || 'free');
	const isScheduledForCancel = $derived(data.subscription?.cancelAtPeriodEnd === true);

	interface PlanDisplay {
		name: string;
		title: string;
		description: string;
		monthlyPrice: number;
		yearlyPrice: number;
		features: string[];
		highlighted: boolean;
		badge?: string;
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
			highlighted: false
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
				'Bill negotiation',
				'Smart savings',
				'Investment tracking',
				'Advanced reports & CSV export',
				'Custom categories',
				'Unlimited transaction history',
				'Priority support'
			],
			highlighted: true,
			badge: 'Most Popular'
		},
		{
			name: 'premium',
			title: 'Premium',
			description: 'Share finances and budgets with your household.',
			monthlyPrice: 19.99,
			yearlyPrice: 199.99,
			features: [
				'Everything in Pro',
				'Household sharing (up to 10)',
				'Family budgets & goals',
				'Advisor sharing',
				'API access',
				'Dedicated support'
			],
			highlighted: false
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
		return `Save $${savings.toFixed(2)}`;
	}

	function getPlanId(planName: string): string | undefined {
		const plan = data.plans?.find((p: any) => p.name === planName);
		return plan?.id;
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '--';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatCurrency(amount: number, currency: string = 'usd'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount);
	}

	function getStatusColor(
		status: string
	): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
		switch (status) {
			case 'active':
			case 'paid':
				return 'success';
			case 'trialing':
				return 'info';
			case 'past_due':
			case 'open':
				return 'warning';
			case 'canceled':
			case 'void':
				return 'error';
			default:
				return 'neutral';
		}
	}

	const tierOrder: Record<string, number> = { free: 0, pro: 1, premium: 2 };

	function isUpgrade(targetPlan: string): boolean {
		return (tierOrder[targetPlan] ?? 0) > (tierOrder[currentPlanName] ?? 0);
	}

	function formatLimit(value: number | string | undefined): string {
		if (value === undefined || value === null) return '--';
		if (value === 'unlimited' || value === -1) return 'Unlimited';
		return String(value);
	}
</script>

<svelte:head>
	<title>Billing - Finance Owl</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-white">Billing & Subscription</h1>
		<p class="mt-1 text-sm text-surface-400">
			Manage your subscription plan and billing details.
		</p>
	</div>

	{#if data.success}
		<div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
			Your subscription has been activated successfully. Welcome to your new plan!
		</div>
	{/if}

	{#if data.canceled}
		<div class="rounded-lg bg-yellow-900/50 px-4 py-3 text-sm text-yellow-300">
			Checkout was canceled. You can try again whenever you're ready.
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
			{form.success}
		</div>
	{/if}

	<!-- Current Plan -->
	<Card>
		<div class="flex items-start justify-between">
			<div>
				<h2 class="text-lg font-semibold text-white">Current Plan</h2>
				<div class="mt-2 flex items-center gap-3">
					<span
						class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {currentPlanName ===
						'pro'
							? 'bg-emerald-600/20 text-emerald-400'
							: currentPlanName === 'premium'
								? 'bg-purple-600/20 text-purple-400'
								: 'bg-surface-700 text-surface-300'}"
					>
						{currentPlanName === 'pro'
							? 'Pro'
							: currentPlanName === 'premium'
								? 'Premium'
								: 'Free'}
					</span>
					{#if data.subscription?.status === 'active'}
						<Badge variant="success" dot>Active</Badge>
					{:else if data.subscription?.status === 'trialing'}
						<Badge variant="info" dot>Trial</Badge>
					{:else if data.subscription?.status === 'past_due'}
						<Badge variant="warning" dot>Past Due</Badge>
					{:else if data.subscription?.status === 'canceled'}
						<Badge variant="error" dot>Canceled</Badge>
					{/if}
				</div>
				{#if data.subscription?.currentPeriodEnd}
					<p class="mt-2 text-xs text-surface-400">
						{#if isScheduledForCancel}
							Cancels on {formatDate(data.subscription.currentPeriodEnd)}
						{:else}
							Next billing date: {formatDate(data.subscription.currentPeriodEnd)}
						{/if}
					</p>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if currentPlanName !== 'free'}
					{#if isScheduledForCancel}
						<form
							method="POST"
							action="?/resume"
							use:enhance={() => {
								resumeLoading = true;
								return async ({ update }) => {
									resumeLoading = false;
									await update();
								};
							}}
						>
							<Button variant="primary" size="sm" type="submit" loading={resumeLoading}>
								Resume Subscription
							</Button>
						</form>
					{:else}
						<form
							method="POST"
							action="?/portal"
							use:enhance={() => {
								portalLoading = true;
								return async ({ update }) => {
									portalLoading = false;
									await update();
								};
							}}
						>
							<Button variant="secondary" size="sm" type="submit" loading={portalLoading}>
								Manage Subscription
							</Button>
						</form>
						<Button
							variant="secondary"
							size="sm"
							onclick={() => (showCancelConfirm = !showCancelConfirm)}
						>
							Cancel
						</Button>
					{/if}
				{/if}
				{#if currentPlanName === 'free' || currentPlanName === 'pro'}
					<a href="/pricing">
						<Button variant="primary" size="sm">
							{currentPlanName === 'free' ? 'Upgrade' : 'Upgrade to Premium'}
						</Button>
					</a>
				{/if}
			</div>
		</div>

		<!-- Cancel Confirmation -->
		{#if showCancelConfirm && currentPlanName !== 'free'}
			<div class="mt-4 rounded-lg border border-red-800/50 bg-red-900/20 p-4">
				<h3 class="text-sm font-semibold text-red-300">Cancel Subscription</h3>
				<p class="mt-1 text-sm text-surface-400">
					Your subscription will remain active until the end of the current billing period. After
					that, you'll be downgraded to the Free plan.
				</p>
				<div class="mt-3 flex items-center gap-2">
					<form
						method="POST"
						action="?/cancel"
						use:enhance={() => {
							cancelLoading = true;
							return async ({ update }) => {
								cancelLoading = false;
								showCancelConfirm = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="atPeriodEnd" value="true" />
						<Button variant="secondary" size="sm" type="submit" loading={cancelLoading}>
							Cancel at Period End
						</Button>
					</form>
					<Button
						variant="secondary"
						size="sm"
						onclick={() => (showCancelConfirm = false)}
					>
						Keep Subscription
					</Button>
				</div>
			</div>
		{/if}

		<!-- Usage Indicators / Feature Limits -->
		{#if data.features?.limits}
			<div class="mt-4 border-t border-surface-700 pt-4">
				<h3 class="text-sm font-medium text-surface-300">Your Usage & Limits</h3>
				<div class="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div class="rounded-lg bg-surface-900 p-3">
						<p class="text-xs text-surface-400">AI Chat / Day</p>
						<p class="mt-1 text-sm font-medium text-white">
							{formatLimit(data.features.limits.ai_chat_daily)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-900 p-3">
						<p class="text-xs text-surface-400">Linked Accounts</p>
						<p class="mt-1 text-sm font-medium text-white">
							{formatLimit(data.features.limits.linked_accounts)}
						</p>
					</div>
					<div class="rounded-lg bg-surface-900 p-3">
						<p class="text-xs text-surface-400">Transaction History</p>
						<p class="mt-1 text-sm font-medium text-white">
							{data.features.limits.transaction_history_months === 'unlimited'
								? 'Unlimited'
								: `${data.features.limits.transaction_history_months} months`}
						</p>
					</div>
					{#if data.features.limits.household_members}
						<div class="rounded-lg bg-surface-900 p-3">
							<p class="text-xs text-surface-400">Household Members</p>
							<p class="mt-1 text-sm font-medium text-white">
								{data.features.limits.household_members}
							</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</Card>

	<!-- Plan Comparison -->
	<div>
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-white">Choose a Plan</h2>

			<!-- Billing Toggle -->
			<div class="flex items-center gap-2 rounded-lg bg-surface-800 p-1">
				<button
					class="rounded-md px-3 py-1.5 text-sm font-medium transition {billingInterval ===
					'month'
						? 'bg-surface-700 text-white'
						: 'text-surface-400 hover:text-surface-200'}"
					onclick={() => (billingInterval = 'month')}
				>
					Monthly
				</button>
				<button
					class="relative rounded-md px-3 py-1.5 text-sm font-medium transition {billingInterval ===
					'year'
						? 'bg-surface-700 text-white'
						: 'text-surface-400 hover:text-surface-200'}"
					onclick={() => (billingInterval = 'year')}
				>
					Yearly
					<span
						class="absolute -right-1 -top-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white"
					>
						-17%
					</span>
				</button>
			</div>
		</div>

		<div class="mt-4 grid gap-4 sm:grid-cols-3">
			{#each planDisplays as plan}
				<div
					class="relative flex flex-col rounded-xl border p-6 {plan.highlighted
						? 'border-emerald-500/50 bg-surface-800'
						: 'border-surface-700 bg-surface-800'}"
				>
					{#if plan.badge}
						<div
							class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-medium text-white"
						>
							{plan.badge}
						</div>
					{/if}

					<div class="mb-4">
						<h3 class="text-lg font-semibold text-white">{plan.title}</h3>
						<p class="mt-1 text-xs text-surface-400">{plan.description}</p>
					</div>

					<div class="mb-6">
						<span class="text-3xl font-bold text-white">{getPrice(plan)}</span>
						<span class="text-sm text-surface-400">{getPeriod(plan)}</span>
						{#if getYearlySavings(plan)}
							<span
								class="ml-2 rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-400"
							>
								{getYearlySavings(plan)}
							</span>
						{/if}
					</div>

					<ul class="mb-6 flex-1 space-y-2">
						{#each plan.features as feature}
							<li class="flex items-start gap-2 text-sm text-surface-300">
								<svg
									class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
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

					<div class="mt-auto">
						{#if plan.name === currentPlanName}
							<div
								class="w-full rounded-lg border border-surface-600 px-4 py-2 text-center text-sm font-medium text-surface-400"
							>
								Current Plan
							</div>
						{:else if plan.name === 'free'}
							{#if currentPlanName !== 'free'}
								<form
									method="POST"
									action="?/portal"
									use:enhance={() => {
										portalLoading = true;
										return async ({ update }) => {
											portalLoading = false;
											await update();
										};
									}}
								>
									<Button
										variant="secondary"
										class="w-full"
										type="submit"
										loading={portalLoading}
									>
										Downgrade
									</Button>
								</form>
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
									class="w-full"
									type="submit"
									loading={checkoutLoading === plan.name}
								>
									{isUpgrade(plan.name) ? 'Upgrade' : 'Switch'} to {plan.title}
								</Button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Payment History / Invoices -->
	{#if data.invoices && data.invoices.length > 0}
		<Card>
			<h2 class="text-lg font-semibold text-white">Payment History</h2>
			<div class="mt-4 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-surface-700">
							<th class="py-3 pr-4 text-left font-medium text-surface-400">Date</th>
							<th class="px-4 py-3 text-left font-medium text-surface-400">Description</th>
							<th class="px-4 py-3 text-right font-medium text-surface-400">Amount</th>
							<th class="px-4 py-3 text-center font-medium text-surface-400">Status</th>
							<th class="py-3 pl-4 text-right font-medium text-surface-400">Invoice</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-surface-700/50">
						{#each data.invoices as invoice}
							<tr>
								<td class="py-3 pr-4 text-surface-300">
									{formatDate(invoice.paidAt || invoice.createdAt)}
								</td>
								<td class="px-4 py-3 text-surface-300">
									{invoice.description || 'Subscription payment'}
								</td>
								<td class="px-4 py-3 text-right text-white">
									{formatCurrency(invoice.amount, invoice.currency)}
								</td>
								<td class="px-4 py-3 text-center">
									<Badge variant={getStatusColor(invoice.status)} size="sm">
										{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
									</Badge>
								</td>
								<td class="py-3 pl-4 text-right">
									{#if invoice.invoiceUrl}
										<a
											href={invoice.invoiceUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="text-xs text-primary-400 hover:text-primary-300 hover:underline"
										>
											View
										</a>
									{:else}
										<span class="text-xs text-surface-500">--</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}

	<!-- Feature Comparison Table -->
	<Card>
		<h2 class="text-lg font-semibold text-white">Feature Comparison</h2>
		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-surface-700">
						<th class="py-3 pr-4 text-left font-medium text-surface-400">Feature</th>
						<th class="px-4 py-3 text-center font-medium text-surface-400">Free</th>
						<th class="px-4 py-3 text-center font-medium text-emerald-400">Pro</th>
						<th class="px-4 py-3 text-center font-medium text-purple-400">Premium</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-700/50">
					{#each [
						{
							feature: 'Linked Bank Accounts',
							free: '2',
							pro: 'Unlimited',
							premium: 'Unlimited'
						},
						{
							feature: 'AI Chat Messages',
							free: '5 / day',
							pro: 'Unlimited',
							premium: 'Unlimited'
						},
						{
							feature: 'Transaction History',
							free: '3 months',
							pro: 'Unlimited',
							premium: 'Unlimited'
						},
						{ feature: 'Subscription Tracking', free: false, pro: true, premium: true },
						{ feature: 'Bill Negotiation', free: false, pro: true, premium: true },
						{ feature: 'Smart Savings', free: false, pro: true, premium: true },
						{ feature: 'Investment Tracking', free: false, pro: true, premium: true },
						{ feature: 'Advanced Reports', free: false, pro: true, premium: true },
						{ feature: 'CSV Export', free: false, pro: true, premium: true },
						{ feature: 'Custom Categories', free: false, pro: true, premium: true },
						{ feature: 'Household Sharing', free: false, pro: false, premium: 'Up to 10' },
						{ feature: 'Family Budgets & Goals', free: false, pro: false, premium: true },
						{ feature: 'Advisor Sharing', free: false, pro: false, premium: true },
						{ feature: 'API Access', free: false, pro: false, premium: true },
						{ feature: 'Priority Support', free: false, pro: true, premium: true },
						{ feature: 'Dedicated Support', free: false, pro: false, premium: true }
					] as row}
						<tr>
							<td class="py-3 pr-4 text-surface-300">{row.feature}</td>
							{#each ['free', 'pro', 'premium'] as tier}
								{@const val = row[tier as keyof typeof row]}
								<td class="px-4 py-3 text-center">
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

	<!-- FAQ -->
	<Card>
		<h2 class="text-lg font-semibold text-white">Frequently Asked Questions</h2>
		<div class="mt-4 space-y-4">
			<div>
				<h3 class="text-sm font-medium text-white">Can I cancel anytime?</h3>
				<p class="mt-1 text-sm text-surface-400">
					Yes, you can cancel your subscription at any time. You'll continue to have access to
					premium features until the end of your current billing period.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-medium text-white">What happens when I downgrade?</h3>
				<p class="mt-1 text-sm text-surface-400">
					When you downgrade, your premium features remain active until the end of your billing
					period. After that, you'll return to the free plan with its limitations.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-medium text-white">Is my payment information secure?</h3>
				<p class="mt-1 text-sm text-surface-400">
					All payments are processed securely through Stripe. We never store your credit card
					details on our servers.
				</p>
			</div>
			<div>
				<h3 class="text-sm font-medium text-white">Can I switch plans at any time?</h3>
				<p class="mt-1 text-sm text-surface-400">
					Yes, you can upgrade or downgrade at any time. When upgrading, you'll be prorated for
					the remainder of your billing cycle.
				</p>
			</div>
		</div>
	</Card>
</div>
