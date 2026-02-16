<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button, Input } from '$components/ui';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let searchQuery = $state('');
	let expandedItems = $state<Set<string>>(new Set());
	let contactSubmitting = $state(false);
	let showContactForm = $state(false);

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
					answer: 'Visit our registration page and sign up with your email address. You can also sign up using Google or Apple authentication. Once registered, you will be guided through connecting your first bank account.'
				},
				{
					id: 'gs-2',
					question: 'Is Finance Owl free to use?',
					answer: 'Yes, we offer a free plan that includes linking up to 2 accounts, basic budget tracking, subscription detection, and monthly spending reports. Premium features like AI insights, bill negotiation tools, and unlimited accounts are available with our paid plans starting at $4.99/month.'
				},
				{
					id: 'gs-3',
					question: 'How do I connect my bank accounts?',
					answer: 'Go to Dashboard and click "Add Account" or navigate to Settings > Banking. We use Plaid to securely connect to your bank. Simply search for your bank, log in with your banking credentials (entered directly into Plaid\'s secure interface), and select the accounts you want to link.'
				},
				{
					id: 'gs-4',
					question: 'Which banks and institutions are supported?',
					answer: 'We support over 12,000 financial institutions in the US, Canada, and UK through Plaid, including major banks (Chase, Bank of America, Wells Fargo, Citi), credit unions, investment brokerages, and credit card companies. If your bank is not listed, contact us and we will look into adding support.'
				},
				{
					id: 'gs-5',
					question: 'Can I use Finance Owl on my phone?',
					answer: 'Yes. Finance Owl is a progressive web app (PWA) that works beautifully on mobile browsers. You can add it to your home screen for a native app-like experience on both iOS and Android. Look for the "Add to Home Screen" prompt when visiting in your mobile browser.'
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
					answer: 'Absolutely. We use Plaid, a trusted service used by thousands of financial apps. Your bank credentials are entered directly into Plaid\'s secure interface -- we never see or store them. We only have read-only access to your account data, meaning we cannot move money or make changes to your accounts. All data is encrypted with AES-256 encryption.'
				},
				{
					id: 'bc-2',
					question: 'Why is my bank connection showing an error?',
					answer: 'Connection errors can occur when your bank changes its login flow, requires additional verification, or experiences temporary outages. Try reconnecting the account from Settings > Banking. If the issue persists, it may be a temporary issue with your bank\'s connection to Plaid. Wait a few hours and try again.'
				},
				{
					id: 'bc-3',
					question: 'How often does transaction data sync?',
					answer: 'Transaction data syncs automatically every 6-12 hours. You can also manually trigger a sync by pulling down on the dashboard (pull-to-refresh) or clicking the refresh button. Note that some banks may have a 1-2 day delay before transactions appear.'
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
					answer: 'With the Family plan, you can create shared budgets visible to all household members. You can split transactions between categories, assign expenses to specific family members, and track household spending together.'
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
					answer: 'We provide cancellation guides with step-by-step instructions, direct cancellation links, and phone numbers for each detected subscription. Some cancellations can be initiated through our platform, but most require you to contact the provider directly. We make the process as easy as possible.'
				},
				{
					id: 's-3',
					question: 'How does bill negotiation work?',
					answer: 'Our bill negotiation feature provides you with guided scripts, comparison rates from other providers, and tips for negotiating lower rates on services like internet, cable, insurance, and phone plans. Premium users get access to advanced negotiation playbooks and success rate data.'
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
					question: 'How do I upgrade to Premium?',
					answer: 'Go to Settings > Billing and select your preferred plan. You can choose between monthly ($4.99/mo) or annual ($49.99/yr, save 17%) billing. We accept all major credit cards through our secure payment processor, Stripe.'
				},
				{
					id: 'bp-2',
					question: 'Can I cancel my subscription anytime?',
					answer: 'Yes, you can cancel at any time from Settings > Billing. When you cancel, you will retain access to premium features until the end of your current billing period. After that, your account will revert to the free plan. No data is lost when downgrading.'
				},
				{
					id: 'bp-3',
					question: 'Do you offer refunds?',
					answer: 'We do not offer prorated refunds for partial billing periods. However, if you are unsatisfied within the first 14 days of a new subscription, contact support and we will work with you on a resolution. Trial periods are always free with no obligation.'
				},
				{
					id: 'bp-4',
					question: 'What happens to my data if I downgrade?',
					answer: 'Your data is never deleted when downgrading. All your transaction history, budgets, and settings are preserved. However, some premium features (like AI insights and advanced reports) will become read-only until you upgrade again.'
				},
				{
					id: 'bp-5',
					question: 'How does the Family plan work?',
					answer: 'The Family plan ($9.99/mo) includes everything in Premium plus support for up to 5 family members, each with their own account. Members can share budgets, savings goals, and household spending views while maintaining privacy over personal transactions.'
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
					answer: 'All data is encrypted using AES-256 encryption at rest and TLS 1.3 in transit. We use the same security standards as banks. Your bank credentials are never stored on our servers -- they are handled exclusively by Plaid. We also support two-factor authentication and passkeys for account security.'
				},
				{
					id: 'sec-2',
					question: 'Can Finance Owl access my money?',
					answer: 'No. We have read-only access to your account data. We can see your transactions and balances, but we cannot initiate transfers, make payments, or modify your accounts in any way. This is enforced at the API level through Plaid.'
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
					answer: 'Immediately change your password and enable 2FA from Settings > Security. Review your recent account activity and disconnect any suspicious sessions. Contact us at security@financeowl.com if you need additional assistance. We can help you secure your account and investigate any unauthorized access.'
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

	// Contact form state
	let contactSubject = $state('');
	let contactCategory = $state('');
	let contactMessage = $state('');

	// Sync form data when server action returns values
	$effect(() => {
		if (form?.subject) contactSubject = form.subject;
		if (form?.category) contactCategory = form.category;
		if (form?.message) contactMessage = form.message;
	});
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
					Try different keywords, or <button onclick={() => (showContactForm = true)} class="text-primary-400 underline hover:text-primary-300">contact our support team</button> for help.
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
				Our support team typically responds within 24 hours.
			</p>
		</div>

		{#if form?.success}
			<Card class="mt-6">
				<div class="py-6 text-center">
					<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-600/20 text-primary-400">
						<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h3 class="mt-4 text-lg font-semibold text-white">Message Sent</h3>
					<p class="mt-2 text-sm text-surface-400">{form.message}</p>
					<button
						onclick={() => { showContactForm = false; contactSubject = ''; contactCategory = ''; contactMessage = ''; }}
						class="mt-4 text-sm text-primary-400 underline hover:text-primary-300"
					>
						Send another message
					</button>
				</div>
			</Card>
		{:else}
			<div class="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center">
				{#if !showContactForm}
					<button
						onclick={() => (showContactForm = true)}
						class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-900/30 transition-all hover:bg-primary-500"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
						</svg>
						Contact Support
					</button>
					<a
						href="mailto:support@financeowl.com"
						class="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-600 bg-surface-800 px-6 py-3 text-sm font-medium text-surface-200 transition hover:border-surface-500 hover:bg-surface-700 hover:text-white"
					>
						Email: support@financeowl.com
					</a>
				{/if}
			</div>

			{#if showContactForm}
				<Card class="mt-6">
					<form
						method="POST"
						action="?/contact"
						use:enhance={() => {
							contactSubmitting = true;
							return async ({ update }) => {
								contactSubmitting = false;
								await update();
							};
						}}
					>
						<div class="space-y-4">
							<h3 class="text-lg font-semibold text-white">Contact Support</h3>

							{#if form?.error}
								<div class="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-400">
									{form.error}
								</div>
							{/if}

							<div>
								<label for="category" class="mb-1.5 block text-sm font-medium text-surface-300">Category</label>
								<select
									id="category"
									name="category"
									bind:value={contactCategory}
									class="w-full rounded-lg border border-surface-600/80 bg-surface-700/50 px-3 py-2.5 text-white transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
								>
									<option value="">Select a category...</option>
									<option value="account">Account Issues</option>
									<option value="billing">Billing & Subscription</option>
									<option value="bank-connection">Bank Connection</option>
									<option value="bug">Bug Report</option>
									<option value="feature">Feature Request</option>
									<option value="security">Security Concern</option>
									<option value="other">Other</option>
								</select>
							</div>

							<Input
								id="subject"
								name="subject"
								label="Subject"
								placeholder="Brief description of your issue"
								bind:value={contactSubject}
								maxlength={200}
							/>

							<div>
								<label for="message" class="mb-1.5 block text-sm font-medium text-surface-300">Message</label>
								<textarea
									id="message"
									name="message"
									bind:value={contactMessage}
									rows="5"
									maxlength="5000"
									placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or relevant information..."
									class="w-full rounded-lg border border-surface-600/80 bg-surface-700/50 px-3 py-2.5 text-white placeholder:text-surface-500 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-y"
								></textarea>
								<p class="mt-1 text-xs text-surface-500">{contactMessage.length}/5000 characters</p>
							</div>

							<div class="flex items-center gap-3 pt-2">
								<Button type="submit" loading={contactSubmitting}>Send Message</Button>
								<button
									type="button"
									onclick={() => (showContactForm = false)}
									class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400 transition hover:bg-surface-700 hover:text-white"
								>
									Cancel
								</button>
							</div>
						</div>
					</form>
				</Card>
			{/if}
		{/if}
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
