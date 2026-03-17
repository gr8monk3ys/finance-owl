<script lang="ts">
	import { publicRoutes, publicMailto, publicSite } from '$lib/config/public';
	import { Card } from '$components/ui';
	import { enhance } from '$app/forms';

	let { form } = $props();

	let searchQuery = $state('');
	let expandedItems = $state<Set<string>>(new Set());
	let isSubmitting = $state(false);

	interface FaqItem {
		id: string;
		question: string;
		answer: string;
	}

	interface FaqSection {
		id: string;
		title: string;
		icon: string;
		iconColor: string;
		items: FaqItem[];
	}

	const faqSections: FaqSection[] = [
		{
			id: 'getting-started',
			title: 'Getting Started',
			icon: 'rocket',
			iconColor: 'text-primary-400 bg-primary-600/20',
				items: [
					{
						id: 'gs-1',
						question: 'How do I create an account?',
						answer: 'Visit the registration page and create your account with email and password. Google and Apple sign-in are not available yet. Once you are in, you can start with budgets and transaction review right away, then connect accounts when banking integrations are enabled for your workspace.'
					},
					{
						id: 'gs-2',
						question: 'Is Finance Owl free to use?',
						answer: 'Yes. Finance Owl includes a free plan for core budgeting and transaction tracking. Paid plans currently start with Pro at $9.99/month and Premium at $19.99/month, with yearly billing options available in the billing area.'
					},
				{
					id: 'gs-3',
					question: 'How do I connect my bank accounts?',
					answer: 'Go to Dashboard and click "Add Account" or navigate to Settings > Banking. If connected-account integrations are enabled for your workspace, you will be guided through the supported provider flow and can choose which accounts to link. If not, you can still add manual accounts and keep using budgets and transaction review.'
				},
				{
					id: 'gs-4',
					question: 'Which banks and institutions are supported?',
					answer: 'Coverage depends on the connected provider and the region enabled for your workspace. The account-link flow will show the institutions currently available to you. If your institution is missing, contact support so we can confirm whether it is on the current provider roadmap.'
				},
					{
						id: 'gs-5',
						question: 'Can I use Finance Owl on my phone?',
						answer: 'Yes. The web app works well on mobile browsers, and the current mobile experience focuses on dashboard, transactions, budgets, and account access. Some advanced settings and admin-style flows still open in the web app.'
					},
				{
					id: 'gs-6',
					question: 'How do I set up my first budget?',
					answer: 'Navigate to Budgets from the sidebar and click "Create Budget." You can choose from pre-built templates or create a custom budget. Our envelope-based system lets you assign every dollar a purpose. The AI assistant can also suggest a budget based on your spending patterns.'
				}
			]
		},
		{
			id: 'bank-connections',
			title: 'Bank Connections',
			icon: 'link',
			iconColor: 'text-blue-400 bg-blue-600/20',
			items: [
				{
					id: 'bc-1',
					question: 'Is it safe to connect my bank account?',
					answer: 'When connected-account access is enabled, authentication is handled by the linked provider rather than by Finance Owl directly. The core aggregation flows are designed for budgeting and transaction review, and sensitive credentials are not stored in the app itself. See the Security page for the current deployment and provider details.'
				},
				{
					id: 'bc-2',
					question: 'Why is my bank connection showing an error?',
					answer: 'Connection errors can happen when an institution changes its login flow, requires additional verification, or has a temporary outage. Try reconnecting the account from Settings > Banking. If the issue persists, wait a bit and try again or contact support with the institution name and any error details.'
				},
				{
					id: 'bc-3',
					question: 'How often does transaction data sync?',
					answer: 'Sync timing varies by institution and provider. Many connections refresh several times per day, but some banks delay posting transactions by a day or more. You can also trigger a manual refresh from the app when that action is available.'
				},
				{
					id: 'bc-4',
					question: 'Can I disconnect a bank account?',
					answer: 'Yes. Go to Settings > Banking, find the account you want to disconnect, and click "Remove." This immediately revokes our access to that institution. Historical transaction data will be retained unless you request deletion through Settings > Privacy.'
				},
				{
					id: 'bc-5',
					question: 'Why are some transactions missing?',
					answer: 'Pending transactions may not appear until they are posted by your bank (typically 1-3 business days). Some transaction types (like ATM withdrawals or wire transfers) may sync with a delay. If you consistently see missing transactions, try reconnecting the account.'
				}
			]
		},
		{
			id: 'budgets',
			title: 'Budgets & Envelopes',
			icon: 'target',
			iconColor: 'text-rose-400 bg-rose-600/20',
			items: [
				{
					id: 'b-1',
					question: 'What is envelope budgeting?',
					answer: 'Envelope budgeting is a method where you allocate specific amounts of money to different spending categories (envelopes) at the beginning of each month. When an envelope is empty, you stop spending in that category. It helps you live within your means and prioritize what matters most.'
				},
				{
					id: 'b-2',
					question: 'How does auto-categorization work?',
					answer: 'Our AI automatically categorizes your transactions based on merchant information, transaction descriptions, and your past categorization patterns. You can always manually recategorize a transaction, and the AI learns from your corrections to improve future accuracy.'
				},
				{
					id: 'b-3',
					question: 'Can I roll over unused budget amounts?',
					answer: 'Yes. In your budget settings, you can enable "rollover" for individual envelopes. Unused amounts will carry forward to the next month. This is great for savings categories or variable expenses like car maintenance.'
				},
					{
						id: 'b-4',
						question: 'How do I handle shared expenses?',
						answer: 'Household and shared-finance workflows live in the Premium tier. Use shared budgets, goals, and household views when multiple people need visibility into the same plan.'
					},
				{
					id: 'b-5',
					question: 'Can I create custom categories?',
					answer: 'Yes. Go to Settings > Categories to create, edit, or merge categories. You can also set up auto-categorization rules based on merchant name, transaction amount, or description keywords.'
				},
				{
					id: 'b-6',
					question: 'What happens if I overspend in a category?',
					answer: 'Overspent categories are highlighted in red on your budget view. You can either transfer money from another envelope to cover it, or the overspent amount will be deducted from next month\'s allocation. You will also receive a notification if you have spending alerts enabled.'
				}
			]
		},
		{
			id: 'subscriptions',
			title: 'Subscriptions & Bills',
			icon: 'repeat',
			iconColor: 'text-amber-400 bg-amber-600/20',
			items: [
				{
					id: 's-1',
					question: 'How does subscription detection work?',
					answer: 'We analyze your transaction history to automatically detect recurring charges. Our AI identifies patterns in merchant names, amounts, and billing intervals to surface subscriptions you may not be tracking. Detected subscriptions appear in your Subscriptions dashboard.'
				},
					{
						id: 's-2',
						question: 'Can Finance Owl cancel subscriptions for me?',
						answer: 'Finance Owl helps you identify recurring charges, review subscription history, and keep track of cancellation steps. Some providers include direct handoff links, but most cancellations are still completed with the provider.'
					},
					{
						id: 's-3',
						question: 'How does bill negotiation work?',
						answer: 'The bill negotiation workflow gives you structured prompts, prep notes, and a place to track the outcome when you call or message a provider. It is designed to help you run the conversation well, not to guarantee a lower rate.'
					},
				{
					id: 's-4',
					question: 'Can I set up bill reminders?',
					answer: 'Yes. Navigate to Bills and add your recurring bills with their due dates. You will receive reminders via email and/or push notification before each bill is due. You can customize reminder timing (1 day, 3 days, or 1 week before) in Settings > Notifications.'
				},
				{
					id: 's-5',
					question: 'What if a subscription is incorrectly detected?',
					answer: 'You can dismiss false detections from the Subscriptions page. Click the three-dot menu on any subscription and select "Not a subscription." Our AI will learn from this correction and improve its detection accuracy over time.'
				}
			]
		},
		{
			id: 'billing-plan',
			title: 'Plans & Billing',
			icon: 'credit-card',
			iconColor: 'text-green-400 bg-green-600/20',
			items: [
					{
						id: 'bp-1',
						question: 'How do I upgrade to Pro or Premium?',
						answer: 'Go to Settings > Billing and choose the plan that fits your workflow. Pro is $9.99/month or $99.99/year, and Premium is $19.99/month or $199.99/year. Billing is processed securely through Stripe when it is configured for your workspace.'
					},
				{
					id: 'bp-2',
					question: 'Can I cancel my subscription anytime?',
					answer: 'Yes, you can cancel at any time from Settings > Billing. When you cancel, you will retain access to premium features until the end of your current billing period. After that, your account will revert to the free plan. No data is lost when downgrading.'
				},
				{
					id: 'bp-3',
					question: 'Do you offer refunds?',
					answer: 'We do not offer prorated refunds for partial billing periods. Any introductory pricing or trial terms will be shown during checkout, and subscription-specific issues should be handled through support.'
				},
				{
					id: 'bp-4',
					question: 'What happens to my data if I downgrade?',
					answer: 'Your data is never deleted when downgrading. All your transaction history, budgets, and settings are preserved. However, some premium features (like AI insights and advanced reports) will become read-only until you upgrade again.'
				},
					{
						id: 'bp-5',
						question: 'How does Premium household sharing work?',
						answer: 'Premium includes household sharing for up to 10 members, along with shared budgets, shared goals, and advisor access. It is the plan to choose when multiple people need a coordinated financial view.'
					}
				]
			},
		{
			id: 'security-faq',
			title: 'Security & Privacy',
			icon: 'shield',
			iconColor: 'text-violet-400 bg-violet-600/20',
			items: [
				{
					id: 'sec-1',
					question: 'How is my financial data protected?',
					answer: 'Finance Owl uses encrypted transport in production, hashed passwords, signed auth tokens, and optional two-factor authentication or passkeys for account protection. If you connect external accounts, authentication happens through the linked provider flow rather than storing those credentials in the app.'
				},
				{
					id: 'sec-2',
					question: 'Can Finance Owl access my money?',
					answer: 'Core budgeting and account-aggregation flows are intended for visibility into balances and transactions, not moving money. If optional banking features are enabled for your workspace, they will ask for separate permissions and show the action clearly before any money movement is possible.'
				},
				{
					id: 'sec-3',
					question: 'How do I enable two-factor authentication?',
					answer: 'Go to Settings > Security and click "Enable 2FA." You can use an authenticator app (like Google Authenticator or Authy) or set up a passkey (fingerprint/face ID). We strongly recommend enabling 2FA for all accounts.'
				},
				{
					id: 'sec-4',
					question: 'Can I export or delete my data?',
					answer: 'Yes. You can export all your data in JSON or CSV format from Settings > Privacy > Data Export. To delete your account and all associated data, go to Settings > Privacy > Delete Account. Data is permanently removed within 30 days of deletion.'
				},
				{
					id: 'sec-5',
					question: 'Does Finance Owl sell my data?',
					answer: 'No. We will never sell your personal or financial data to third parties. Your data is used solely to provide the Service to you. We may use anonymized, aggregated data for improving our AI models and generating industry benchmarks, but this data can never be linked back to individual users.'
				},
				{
					id: 'sec-6',
					question: 'What should I do if I suspect unauthorized access?',
					answer: `Immediately change your password and enable 2FA from Settings > Security. Review your recent account activity and disconnect any suspicious sessions. Contact us at ${publicSite.securityEmail} if you need additional assistance. We can help you secure your account and investigate unauthorized access.`
				}
			]
		}
	];

	const filteredSections = $derived.by(() => {
		if (!searchQuery.trim()) return faqSections;
		const query = searchQuery.toLowerCase();
		return faqSections
			.map((section) => ({
				...section,
				items: section.items.filter(
					(item) =>
						item.question.toLowerCase().includes(query) ||
						item.answer.toLowerCase().includes(query)
				)
			}))
			.filter((section) => section.items.length > 0);
	});

	const totalResults = $derived(filteredSections.reduce((sum, s) => sum + s.items.length, 0));

	function toggleItem(id: string) {
		const next = new Set(expandedItems);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		expandedItems = next;
	}

	function isExpanded(id: string): boolean {
		return expandedItems.has(id);
	}

</script>

<svelte:head>
	<title>Help Center - Finance Owl</title>
	<meta name="description" content="Get help with Finance Owl. Browse FAQs, learn about features, or contact our support team." />
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8">
	<!-- Page Header -->
	<div class="text-center">
		<h1 class="text-2xl font-bold text-white sm:text-3xl">Help Center</h1>
		<p class="mt-2 text-surface-400">Find answers to common questions or reach out to our support team.</p>
	</div>

	<!-- Search -->
	<div class="relative">
		<div class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
			</svg>
		</div>
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search for help topics..."
			class="w-full rounded-xl border border-surface-600/80 bg-surface-800 py-3.5 pl-12 pr-4 text-white placeholder:text-surface-500 transition-all duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
		/>
		{#if searchQuery.trim()}
			<div class="absolute right-4 top-1/2 -translate-y-1/2">
				<button
					onclick={() => (searchQuery = '')}
					class="rounded-lg p-1 text-surface-400 transition hover:bg-surface-700 hover:text-white"
					aria-label="Clear search"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- Search results count -->
	{#if searchQuery.trim()}
		<p class="text-sm text-surface-400">
			{totalResults} result{totalResults !== 1 ? 's' : ''} found for "{searchQuery}"
		</p>
	{/if}

	<!-- FAQ Sections -->
	{#if filteredSections.length === 0}
		<Card>
			<div class="py-8 text-center">
				<svg class="mx-auto h-12 w-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-white">No results found</h3>
				<p class="mt-2 text-sm text-surface-400">
					Try different keywords, or <a href={publicRoutes.support} class="text-primary-400 underline hover:text-primary-300">visit support</a> for help.
				</p>
			</div>
		</Card>
	{:else}
		<div class="space-y-6">
			{#each filteredSections as section}
				<div>
					<!-- Section Header -->
					<div class="mb-3 flex items-center gap-3">
						<div class="flex h-9 w-9 items-center justify-center rounded-lg {section.iconColor}">
							{#if section.icon === 'rocket'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
								</svg>
							{:else if section.icon === 'link'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
								</svg>
							{:else if section.icon === 'target'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
								</svg>
							{:else if section.icon === 'repeat'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
								</svg>
							{:else if section.icon === 'credit-card'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
								</svg>
							{:else if section.icon === 'shield'}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
								</svg>
							{:else}
								<svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" />
								</svg>
							{/if}
						</div>
						<h2 class="text-lg font-semibold text-white">{section.title}</h2>
						<span class="rounded-full bg-surface-700 px-2 py-0.5 text-xs font-medium text-surface-400">
							{section.items.length}
						</span>
					</div>

					<!-- FAQ Items -->
					<Card padding="none">
						<div class="divide-y divide-surface-700/50">
							{#each section.items as item}
								{@const expanded = isExpanded(item.id)}
								<div>
									<button
										onclick={() => toggleItem(item.id)}
										class="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-surface-700/30"
										aria-expanded={expanded}
									>
										<span class="pr-4 text-sm font-medium {expanded ? 'text-primary-400' : 'text-white'}">
											{item.question}
										</span>
										<svg
											class="h-4 w-4 shrink-0 text-surface-400 transition-transform duration-200
												{expanded ? 'rotate-180' : ''}"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
										</svg>
									</button>
									{#if expanded}
										<div class="border-t border-surface-700/30 bg-surface-800/30 px-5 py-4">
											<p class="text-sm leading-relaxed text-surface-300">{item.answer}</p>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</Card>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Contact Support Section -->
	<div class="border-t border-surface-700/50 pt-8">
		<div class="text-center">
			<h2 class="text-xl font-semibold text-white">Still need help?</h2>
			<p class="mt-2 text-sm text-surface-400">
				Submit a support request below or use the external contact paths.
			</p>
		</div>

		<!-- Contact Form -->
		<Card>
			{#if form && !('error' in form)}
				<div class="py-8 text-center">
					<svg class="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h3 class="mt-4 text-lg font-medium text-white">Request submitted</h3>
					<p class="mt-2 text-sm text-surface-400">{form.message}</p>
				</div>
			{:else}
				<form
					method="POST"
					action="?/contact"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-5"
				>
					<h3 class="text-base font-semibold text-white">Contact Support</h3>

					{#if form?.error}
						<div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
							<p class="text-sm text-red-400">{form.error}</p>
						</div>
					{/if}

					<div>
						<label for="contact-subject" class="mb-1.5 block text-sm font-medium text-surface-300">Subject</label>
						<input
							id="contact-subject"
							name="subject"
							type="text"
							required
							minlength="3"
							maxlength="200"
							value={form?.subject ?? ''}
							placeholder="Brief description of your issue"
							class="w-full rounded-lg border border-surface-600 bg-surface-800 px-3.5 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
						/>
					</div>

					<div>
						<label for="contact-category" class="mb-1.5 block text-sm font-medium text-surface-300">Category</label>
						<select
							id="contact-category"
							name="category"
							required
							class="w-full rounded-lg border border-surface-600 bg-surface-800 px-3.5 py-2.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
						>
							<option value="" disabled selected={!form?.category}>Select a category</option>
							<option value="account" selected={form?.category === 'account'}>Account Issue</option>
							<option value="billing" selected={form?.category === 'billing'}>Billing & Payments</option>
							<option value="bank-connection" selected={form?.category === 'bank-connection'}>Bank Connection</option>
							<option value="budgets" selected={form?.category === 'budgets'}>Budgets & Categories</option>
							<option value="bug" selected={form?.category === 'bug'}>Bug Report</option>
							<option value="feature" selected={form?.category === 'feature'}>Feature Request</option>
							<option value="security" selected={form?.category === 'security'}>Security Concern</option>
							<option value="other" selected={form?.category === 'other'}>Other</option>
						</select>
					</div>

					<div>
						<label for="contact-message" class="mb-1.5 block text-sm font-medium text-surface-300">Message</label>
						<textarea
							id="contact-message"
							name="message"
							required
							minlength="10"
							maxlength="5000"
							rows="5"
							placeholder="Describe your issue or question in detail..."
							class="w-full rounded-lg border border-surface-600 bg-surface-800 px-3.5 py-2.5 text-sm text-white placeholder:text-surface-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
						>{form?.message ?? ''}</textarea>
					</div>

					<div class="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							class="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isSubmitting ? 'Submitting...' : 'Submit Request'}
						</button>
					</div>
				</form>
			{/if}
		</Card>

		<div class="mt-6 grid gap-4 sm:grid-cols-2">
			<a
				href={publicRoutes.support}
				class="rounded-2xl border border-surface-600 bg-surface-800 px-6 py-5 text-left transition hover:border-surface-500 hover:bg-surface-700"
			>
				<h3 class="text-sm font-semibold text-white">Open Support</h3>
				<p class="mt-2 text-sm leading-relaxed text-surface-400">
					View the current support contacts, legal links, and security reporting path.
				</p>
			</a>
			<a
				href={publicMailto.support}
				class="rounded-2xl border border-surface-600 bg-surface-800 px-6 py-5 text-left transition hover:border-surface-500 hover:bg-surface-700"
			>
				<h3 class="text-sm font-semibold text-white">Email Support</h3>
				<p class="mt-2 text-sm leading-relaxed text-surface-400">{publicSite.supportEmail}</p>
			</a>
		</div>
	</div>

	<!-- Quick Links -->
	<Card>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h3 class="text-sm font-semibold text-white">Legal & Policies</h3>
				<p class="mt-1 text-xs text-surface-400">Review our policies and security practices.</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<a
					href="/privacy"
					class="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-300 transition hover:border-surface-500 hover:bg-surface-700 hover:text-white"
				>
					Privacy Policy
				</a>
				<a
					href="/terms"
					class="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-300 transition hover:border-surface-500 hover:bg-surface-700 hover:text-white"
				>
					Terms of Service
				</a>
				<a
					href="/security"
					class="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-300 transition hover:border-surface-500 hover:bg-surface-700 hover:text-white"
				>
					Security
				</a>
			</div>
		</div>
	</Card>
</div>
